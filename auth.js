// "Sign in with Zoho" (OAuth 2.0). Gives us the employee's name and email.
// Sessions are kept in a signed cookie, so no database is needed.
import crypto from "node:crypto";

const {
  ZOHO_ACCOUNTS_URL = "https://accounts.zoho.in",
  ZOHO_LOGIN_CLIENT_ID,
  ZOHO_LOGIN_CLIENT_SECRET,
  APP_URL = "http://localhost:3000",
  SESSION_SECRET,
  ALLOWED_EMAIL_DOMAINS = ""
} = process.env;

export function checkLoginSettings() {
  const missing = ["ZOHO_LOGIN_CLIENT_ID", "ZOHO_LOGIN_CLIENT_SECRET", "SESSION_SECRET"].filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing Zoho sign-in settings in .env: ${missing.join(", ")}`);
    console.error("Create a 'Server-based Application' client at https://api-console.zoho.in with redirect URI:");
    console.error(`  ${APP_URL}/auth/callback`);
    process.exit(1);
  }
}

const REDIRECT_URI = `${APP_URL}/auth/callback`;
const SECURE = APP_URL.startsWith("https://");
const SESSION_COOKIE = "itfb_session";
const STATE_COOKIE = "itfb_state";
const SESSION_HOURS = 8;
const allowedDomains = ALLOWED_EMAIL_DOMAINS.split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
// Zoho may send users from another data center back with their own accounts server.
const ZOHO_ACCOUNTS_RE = /^https:\/\/accounts\.zoho\.(com|in|eu|com\.au|jp|com\.cn|sa|ca|uk)$/;

// ---------- cookie helpers ----------
const sign = data => crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");

function seal(obj) {
  const data = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${data}.${sign(data)}`;
}
function unseal(value) {
  if (!value || !value.includes(".")) return null;
  const [data, sig] = value.split(".");
  const expected = sign(data);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const obj = JSON.parse(Buffer.from(data, "base64url").toString());
    return obj.exp && obj.exp > Date.now() ? obj : null;
  } catch { return null; }
}
function readCookies(req) {
  return Object.fromEntries((req.headers.cookie ?? "").split(";").map(c => {
    const i = c.indexOf("=");
    return i < 0 ? [c.trim(), ""] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }));
}
const cookieOpts = maxAgeMs => ({ httpOnly: true, sameSite: "lax", secure: SECURE, maxAge: maxAgeMs, path: "/" });

export function currentUser(req) {
  return unseal(readCookies(req)[SESSION_COOKIE]);
}

// ---------- routes ----------
export function registerAuthRoutes(app) {
  app.get("/auth/login", (req, res) => {
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie(STATE_COOKIE, seal({ state, exp: Date.now() + 10 * 60_000 }), cookieOpts(10 * 60_000));
    const url = new URL(`${ZOHO_ACCOUNTS_URL}/oauth/v2/auth`);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: ZOHO_LOGIN_CLIENT_ID,
      scope: "AaaServer.profile.Read",
      redirect_uri: REDIRECT_URI,
      access_type: "online",
      state
    });
    res.redirect(url.toString());
  });

  app.get("/auth/callback", async (req, res) => {
    const fail = reason => {
      console.error("Sign-in failed:", reason);
      res.redirect("/?login_error=" + encodeURIComponent(typeof reason === "string" && reason.startsWith("!") ? reason.slice(1) : "Sign-in failed. Please try again."));
    };
    try {
      const saved = unseal(readCookies(req)[STATE_COOKIE]);
      res.clearCookie(STATE_COOKIE, { path: "/" });
      if (req.query.error) return fail(`Zoho returned: ${req.query.error}`);
      if (!saved || saved.state !== req.query.state) return fail("State mismatch (expired or forged request)");
      if (!req.query.code) return fail("No code returned");

      const server = ZOHO_ACCOUNTS_RE.test(req.query["accounts-server"] ?? "") ? req.query["accounts-server"] : ZOHO_ACCOUNTS_URL;

      const tokenRes = await fetch(`${server}/oauth/v2/token`, {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: ZOHO_LOGIN_CLIENT_ID,
          client_secret: ZOHO_LOGIN_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          code: String(req.query.code)
        })
      });
      const token = await tokenRes.json();
      if (!token.access_token) return fail(`Token exchange failed: ${JSON.stringify(token)}`);

      const infoRes = await fetch(`${server}/oauth/user/info`, {
        headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` }
      });
      const info = await infoRes.json();
      const email = String(info.Email ?? "").toLowerCase();
      const name = String(info.Display_Name || [info.First_Name, info.Last_Name].filter(Boolean).join(" ") || email);
      if (!email) return fail(`No email in user info: ${JSON.stringify(info)}`);

      if (allowedDomains.length && !allowedDomains.includes(email.split("@")[1])) {
        return fail("!Please sign in with your company Zoho account.");
      }

      const exp = Date.now() + SESSION_HOURS * 3600_000;
      res.cookie(SESSION_COOKIE, seal({ name, email, exp }), cookieOpts(SESSION_HOURS * 3600_000));
      res.redirect("/");
    } catch (err) {
      fail(err.message);
    }
  });

  app.get("/api/me", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false });
    res.json({ ok: true, name: user.name, email: user.email });
  });

  app.post("/auth/logout", (req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  });
}

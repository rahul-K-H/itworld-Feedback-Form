// One-time helper: exchanges a Zoho grant code for a refresh token.
// Usage: npm run get-token -- <grant_code>
const code = process.argv[2];
const { ZOHO_ACCOUNTS_URL = "https://accounts.zoho.in", ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET } = process.env;

if (!code) {
  console.error("Usage: npm run get-token -- <grant_code>");
  process.exit(1);
}
if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
  console.error("Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
  method: "POST",
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    code
  })
});
const data = await res.json();

if (!data.refresh_token) {
  console.error("Zoho did not return a refresh token:", data);
  console.error("Grant codes expire quickly and work only once. Generate a new one and retry.");
  process.exit(1);
}
console.log("\nSuccess! Add this line to your .env file:\n");
console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}\n`);

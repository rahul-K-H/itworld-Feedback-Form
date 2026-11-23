import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSettings, addRow, readTab, readColumn } from "./zoho.js";
import {
  BRANDS, LOCATIONS, SETUP_ITEMS, PROBLEMS, APPS, CHANGES, NOT_USED, MAX_TEXT, sheetColumns
} from "./public/form-config.js";

checkSettings();
const PORT = process.env.PORT ?? 3000;

// ---------- Validation (mirrors the browser checks) ----------
const str = (v, max = MAX_TEXT) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const rating1to5 = v => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
const pickMany = (v, allowed) => (Array.isArray(v) ? v.filter(x => allowed.includes(x)) : []);
// Stop spreadsheet formula injection (cells starting with = + - @)
const safe = s => (/^[=+\-@]/.test(s) ? "'" + s : s);

// ---------- Master data (Employees + Stores tabs) ----------
const MASTER_TTL_MS = 10 * 60 * 1000;
let master = null, masterLoadedAt = 0, masterLoading = null;

// Serves the cached copy instantly; when it is older than the TTL it refreshes in the background
// (a failed refresh keeps the old copy). Only the very first load makes a caller wait.
async function getMaster() {
  if (master) {
    if (Date.now() - masterLoadedAt >= MASTER_TTL_MS)
      refreshMaster().catch(e => console.error("Master refresh failed:", e.message));
    return master;
  }
  return refreshMaster();
}

function refreshMaster() {
  masterLoading ??= (async () => {
    const [emps, stores] = await Promise.all([readTab("Employees", 6), readTab("Stores", 6)]);
    const employees = new Map();
    for (const e of emps) {
      const id = e["Employee ID"];
      if (id) employees.set(id.toUpperCase(), { id, name: e["Employee Name"] ?? "", role: e["Role"] ?? "" });
    }
    const storeList = stores.filter(s => s.location_name)
      .map(s => ({ name: s.location_name, city: s.business_city ?? "" }));
    const roles = [...new Set([...employees.values()].map(e => e.role).filter(Boolean))].sort();
    master = { employees, stores: storeList, storeNames: new Set(storeList.map(s => s.name)), roles, roleSet: new Set(roles) };
    masterLoadedAt = Date.now();
    return master;
  })().finally(() => { masterLoading = null; });
  return masterLoading;
}

// Employee IDs that already submitted. Loaded from the sheet once, then kept up to date in memory.
let submitted = null, submittedLoading = null;
const inFlight = new Set();

async function getSubmitted() {
  if (submitted) return submitted;
  submittedLoading ??= (async () => {
    const col = sheetColumns().indexOf("Employee ID") + 1;
    submitted = new Set((await readColumn(col)).map(v => v.toUpperCase()));
    return submitted;
  })().finally(() => { submittedLoading = null; });
  return submittedLoading;
}

const EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAINS ?? "").split(",")[0].trim().toLowerCase() || "it-world.in";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(body, m) {
  const errors = {};
  const location = str(body.location, 50);
  const overall = rating1to5(body.overall);

  const empId = str(body.employee_id, 50).toUpperCase();
  const emp = m.employees.get(empId);
  const brand = str(body.brand, 50);
  const branch = str(body.branch, 100);
  const role = str(body.role, 100);

  const email = str(body.email, 100).toLowerCase();
  if (!email) errors.email = "Please enter your email address.";
  else if (!EMAIL_RE.test(email)) errors.email = "Please enter a valid email address.";

  if (!empId) errors.employee_id = "Please enter your Employee ID.";
  else if (!emp) errors.employee_id = "Employee ID not found. Please check it and try again.";
  if (!BRANDS.includes(brand)) errors.brand = "Please choose your brand.";
  if (!m.storeNames.has(branch)) errors.branch = "Please choose your store / branch from the list.";
  if (!m.roleSet.has(role)) errors.role = "Please choose your role from the list.";
  if (!LOCATIONS.includes(location)) errors.location = "Please choose where you work.";
  if (overall === null) errors.overall = "Please give an overall rating (1-5).";

  const setup = body.setup ?? {};
  const apps = body.apps ?? {};

  const row = {
    "Submitted At": new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    "Name": emp ? safe(emp.name) : "",
    "Email": safe(email),
    "Employee ID": emp ? safe(emp.id) : "",
    "Employee Name": emp ? safe(emp.name) : "",
    "Brand": brand,
    "Work Location": location,
    "Store / Branch": safe(branch),
    "Role": safe(role),
    "Overall IT Rating": overall
  };
  for (const item of SETUP_ITEMS) row[item.column] = rating1to5(setup[item.key]) ?? "";
  row["Common Problems"] = pickMany(body.problems, PROBLEMS).join(", ");
  for (const app of APPS) {
    const v = apps[app.key];
    row[app.column] = v === NOT_USED ? NOT_USED : rating1to5(v) ?? "";
  }
  row["App Problems"] = safe(str(body.app_problems));
  row["Changes Wanted"] = pickMany(body.changes, CHANGES).join(", ");
  row["New Features Wanted"] = safe(str(body.features));
  row["Other Comments"] = safe(str(body.comments));

  return { errors, row, empId };
}

// ---------- Web server ----------
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Dropdown lists for the form (employees are NOT sent to the browser)
app.get("/api/master", async (req, res) => {
  try {
    const m = await getMaster();
    res.json({ ok: true, emailDomain: EMAIL_DOMAIN, brands: BRANDS, stores: m.stores, roles: m.roles });
  } catch (err) {
    console.error(err.message);
    res.status(502).json({ ok: false, message: "Could not load store and role lists. Please try again later." });
  }
});

// Checks one Employee ID: exists? already submitted? Also returns name + role to pre-fill.
app.get("/api/employee", async (req, res) => {
  const id = str(req.query.id, 50).toUpperCase();
  try {
    const [m, done] = await Promise.all([getMaster(), getSubmitted()]);
    const emp = m.employees.get(id);
    if (!emp) return res.json({ ok: true, found: false });
    res.json({ ok: true, found: true, duplicate: done.has(id) || inFlight.has(id), name: emp.name, role: emp.role });
  } catch (err) {
    console.error(err.message);
    res.status(502).json({ ok: false, message: "Could not check the Employee ID. Please try again." });
  }
});

app.post("/api/feedback", async (req, res) => {
  let reserved = null;
  try {
    const [m, done] = await Promise.all([getMaster(), getSubmitted()]);
    const { errors, row, empId } = validate(req.body ?? {}, m);
    if (!errors.employee_id && (done.has(empId) || inFlight.has(empId)))
      errors.employee_id = "Feedback has already been submitted for this Employee ID.";
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

    inFlight.add(empId); reserved = empId;   // blocks a simultaneous second submit
    await addRow(row);
    done.add(empId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.message);
    res.status(502).json({ ok: false, message: "Could not save your feedback. Please try again later." });
  } finally {
    if (reserved) inFlight.delete(reserved);
  }
});

app.listen(PORT, () => {
  console.log(`Feedback form running at http://localhost:${PORT}`);
  // Warm the caches now so the first visitor does not wait for Zoho Sheet.
  getMaster().then(m => console.log(`Master data loaded: ${m.employees.size} employees, ${m.stores.length} stores, ${m.roles.length} roles`))
    .catch(e => console.error("Could not preload master data:", e.message));
  getSubmitted().then(s => console.log(`Already submitted: ${s.size} employee IDs`))
    .catch(e => console.error("Could not preload submitted IDs:", e.message));
});

// =====================================================================
//  SURVEY SETTINGS: edit the lists below to change the form.
//  Used by both the web page and the server, so they always match.
//  After adding, removing or renaming an item that has a "column",
//  run:  npm run setup-sheet   (updates the Zoho Sheet header row)
// =====================================================================

// Brand / business the employee belongs to (searchable dropdown)
export const BRANDS = ["HP", "Samsung", "Rayban", "Back Office"];

// "Where do you work?" choices
export const LOCATIONS = ["Store", "Back Office", "Warehouse"];

// Things in the current IT setup that people rate 1-5
export const SETUP_ITEMS = [
  { key: "devices",  label: "Computers & billing / POS machines", column: "Rating: Computers & POS" },
  { key: "internet", label: "Internet & Wi-Fi",                   column: "Rating: Internet & Wi-Fi" },
  { key: "printers", label: "Printers & barcode scanners",        column: "Rating: Printers & Scanners" },
  { key: "handhelds", label: "Handheld devices, tablets & mobiles",  column: "Rating: Mobile Devices" },
  { key: "support",  label: "IT support (how fast & how helpful)", column: "Rating: IT Support" }
];

// Common problems (tick all that apply)
export const PROBLEMS = [
  "Slow computer / POS",
  "Internet keeps dropping",
  "Printer or scanner issues",
  "Login / password problems",
  "Software hangs or crashes",
  "Billing / POS slow at the counter (retail)",
  "Stock in system does not match physical stock (retail)",
  "Reports missing, late or wrong (back office)",
  "Approvals or data entry take too long (back office)",
  "IT help takes too long",
  "No major problems"
];

// Applications people rate 1-5 (or "I don't use this")
export const APPS = [
  { key: "pos",       label: "SimplicITi (our ERP)",                column: "App: SimplicITi" },
  { key: "email",     label: "Email",                             column: "App: Email" },
  { key: "zoho",      label: "Zoho apps (Cliq, Sheet, WorkDrive…)", column: "App: Zoho Apps" },
  { key: "reports",   label: "Reports & dashboards",              column: "App: Reports" },
  { key: "backoffice", label: "Back-office tools (Accounts, HR, Purchase, Warehouse)", column: "App: Back Office Tools" }
];

// Changes people would like (tick all that apply)
export const CHANGES = [
  "Faster computers / devices",
  "Better internet / Wi-Fi",
  "Simpler, easier software",
  "Mobile app for daily tasks",
  "Training on how to use apps",
  "Faster IT support"
];

export const RATINGS = [
  [5, "Excellent"], [4, "Good"], [3, "Average"], [2, "Poor"], [1, "Very poor"]
];
export const NOT_USED = "Don't use";
export const MAX_TEXT = 2000;

// Column headers for row 1 of the Zoho Sheet, in order.
export function sheetColumns() {
  return [
    "Submitted At", "Name", "Email", "Employee ID", "Employee Name", "Brand",
    "Work Location", "Store / Branch", "Role",
    "Overall IT Rating",
    ...SETUP_ITEMS.map(i => i.column),
    "Common Problems",
    ...APPS.map(a => a.column),
    "App Problems",
    "Changes Wanted",
    "New Features Wanted",
    "Other Comments"
  ];
}

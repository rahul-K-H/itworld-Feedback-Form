// Small Zoho Sheet client: login token handling + the calls we need.
const {
  ZOHO_ACCOUNTS_URL = "https://accounts.zoho.in",
  ZOHO_SHEET_API_URL = "https://sheet.zoho.in/api/v2",
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_SHEET_RESOURCE_ID,
  ZOHO_WORKSHEET_NAME = "Sheet1"
} = process.env;

export function checkSettings() {
  const missing = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_SHEET_RESOURCE_ID"]
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing settings in .env: ${missing.join(", ")}`);
    process.exit(1);
  }
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: ZOHO_REFRESH_TOKEN,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  return cachedToken;
}

async function sheetCall(params, worksheet = ZOHO_WORKSHEET_NAME) {
  const token = await getAccessToken();
  const res = await fetch(`${ZOHO_SHEET_API_URL}/${ZOHO_SHEET_RESOURCE_ID}`, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    body: new URLSearchParams({ worksheet_name: worksheet, ...params })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    if (res.status === 401) cachedToken = null; // force refresh next time
    throw new Error(`Zoho Sheet error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export const addRow = row =>
  sheetCall({ method: "worksheet.records.add", header_row: "1", json_data: JSON.stringify([row]) });

export async function getRow(n, lastColumn = 60) {
  const data = await sheetCall({
    method: "range.content.get", start_row: n, start_column: 1, end_row: n, end_column: lastColumn
  });
  return data.range_details?.[0]?.row_details ?? [];
}

const csvCell = v => `"${String(v).replace(/"/g, '""')}"`;

export const setRow = (n, values) =>
  sheetCall({ method: "worksheet.csvdata.set", row: n, column: 1, data: values.map(csvCell).join(",") });

export const worksheetName = ZOHO_WORKSHEET_NAME;

// ---------- Reading whole tabs (master data) ----------
const CHUNK = 500;

// Returns the tab as an array of objects keyed by the header names in row 1.
export async function readTab(worksheet, lastColumn = 12) {
  const header = await sheetCall({
    method: "range.content.get", start_row: 1, start_column: 1, end_row: 1, end_column: lastColumn
  }, worksheet);
  const names = (header.range_details?.[0]?.row_details ?? []).map(c => String(c.content ?? "").trim());

  const out = [];
  for (let start = 2; ; start += CHUNK) {
    const data = await sheetCall({
      method: "range.content.get", start_row: start, start_column: 1,
      end_row: start + CHUNK - 1, end_column: lastColumn
    }, worksheet);
    const rows = data.range_details ?? [];
    let any = false;
    for (const r of rows) {
      const obj = {};
      (r.row_details ?? []).forEach((c, i) => { if (names[i]) obj[names[i]] = String(c.content ?? "").trim(); });
      if (Object.values(obj).some(v => v)) { out.push(obj); any = true; }
    }
    if (!any || rows.length < CHUNK) break;
  }
  return out;
}

// Returns every non-empty value in one column of the feedback sheet (from row 2 down).
export async function readColumn(columnIndex) {
  const out = [];
  for (let start = 2; ; start += CHUNK) {
    const data = await sheetCall({
      method: "range.content.get", start_row: start, start_column: columnIndex,
      end_row: start + CHUNK - 1, end_column: columnIndex
    });
    const rows = data.range_details ?? [];
    let any = false;
    for (const r of rows) {
      const v = String(r.row_details?.[0]?.content ?? "").trim();
      if (v) { out.push(v); any = true; }
    }
    if (!any || rows.length < CHUNK) break;
  }
  return out;
}

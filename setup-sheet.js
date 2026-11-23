// Writes the column headers (from public/form-config.js) into row 1 of the sheet.
// Run after changing the form's lists:  npm run setup-sheet
import { checkSettings, getRow, setRow, worksheetName } from "./zoho.js";
import { sheetColumns } from "./public/form-config.js";

checkSettings();

const columns = sheetColumns();
const before = await getRow(1);
const lastOld = Math.max(0, ...before.map(c => c.column_index));

// Pad with blanks so any old headers beyond the new last column are cleared.
const values = [...columns, ...Array(Math.max(0, lastOld - columns.length)).fill("")];
await setRow(1, values);

const after = await getRow(1);
console.log(`Worksheet "${worksheetName}" row 1 now has ${after.length} headers:`);
console.log(after.map(c => c.content).join(" | "));

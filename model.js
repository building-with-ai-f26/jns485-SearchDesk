// SearchDesk financial model: the approved template is the ONLY source of financial math.
//
// - Reads model/searchdesk-model-template.xlsx (never modifies it).
// - fillTemplate(): writes the deal inputs and the user's assumptions into the template's input cells only,
//   by editing those cells inside an in-memory copy of the file. Every formula, format, dropdown, and
//   conditional format is left exactly as it was, and Excel is told to fully recalculate on open.
// - calculate(): evaluates the filled template with HyperFormula (a spreadsheet formula engine) and
//   returns the headline numbers. There is no hand-written financial math in this file.
// Nothing is ever written to disk.

import fs from "node:fs";
import path from "node:path";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { HyperFormula } from "hyperformula";

export const TEMPLATE_PATH = path.join(import.meta.dirname, "model", "searchdesk-model-template.xlsx");
const INPUT_SHEET = "Assumptions";
const SUMMARY_SHEET = "Scenario Summary";

// ----- The only cells SearchDesk writes (all on the Assumptions sheet) -----
// kind: money | number | pct (fraction, 0.8 = 80%) | years (whole number) | yesno | earningsType | text
export const DEAL_FIELDS = [
  { key: "businessName", cell: "B5", kind: "text", maxLength: 100, label: "Business name" },
  { key: "earningsType", cell: "B6", kind: "earningsType", label: "Earnings type" },
  { key: "revenue", cell: "B7", kind: "money", min: 1, max: 10e9, required: true, label: "Revenue (TTM)" },
  { key: "earnings", cell: "B8", kind: "money", min: -1e9, max: 10e9, required: true, label: "Earnings (TTM)" },
  { key: "askingPrice", cell: "B9", kind: "money", min: 1, max: 10e9, required: true, label: "Asking price" },
  { key: "offerPrice", cell: "B10", kind: "money", min: 1, max: 10e9, optional: true, label: "Offer price" },
  { key: "subtractSalary", cell: "B18", kind: "yesno", label: "Subtract buyer salary from EBITDA" },
];
export const ASSUMPTION_FIELDS = [
  // Financing (% of total uses)
  { key: "seniorIsSba", cell: "B27", kind: "yesno", label: "Senior loan is SBA" },
  { key: "seniorPct", cell: "B28", kind: "pct", min: 0, max: 1, label: "Senior loan %" },
  { key: "seniorRate", cell: "B29", kind: "pct", min: 0, max: 0.3, label: "Senior loan rate" },
  { key: "seniorTerm", cell: "B30", kind: "years", min: 1, max: 30, label: "Senior loan term" },
  { key: "sellerPct", cell: "B31", kind: "pct", min: 0, max: 1, label: "Seller note %" },
  { key: "sellerRate", cell: "B32", kind: "pct", min: 0, max: 0.3, label: "Seller note rate" },
  { key: "sellerStandby", cell: "B33", kind: "years", min: 0, max: 10, label: "Seller note standby" },
  { key: "sellerAmort", cell: "B34", kind: "years", min: 1, max: 30, label: "Seller note amortization" },
  { key: "investorPct", cell: "B64", kind: "pct", min: 0, max: 1, label: "Outside investor equity %" },
  // Deal costs
  { key: "closingCostPct", cell: "B22", kind: "pct", min: 0, max: 0.25, label: "Closing costs %" },
  { key: "cushionMonths", cell: "B23", kind: "number", min: 0, max: 24, label: "Extra cash cushion (months)" },
  { key: "sbaFeePct", cell: "B24", kind: "pct", min: 0, max: 0.1, label: "SBA fee %" },
  // Operating
  { key: "buyerSalary", cell: "B17", kind: "money", min: 0, max: 2e6, label: "Buyer salary" },
  { key: "capexPct", cell: "B38", kind: "pct", min: 0, max: 0.5, label: "Capex % of revenue" },
  { key: "taxRate", cell: "B39", kind: "pct", min: 0, max: 0.6, label: "Tax rate" },
  { key: "targetDscr", cell: "B40", kind: "number", min: 0.5, max: 5, label: "Target DSCR" },
  { key: "targetIrr", cell: "B76", kind: "pct", min: 0, max: 2, label: "Target IRR" },
];

// ----- Where the headline numbers live (Scenario Summary sheet) -----
const SCENARIO_COLUMNS = ["B", "C", "D", "E"];
const OUTPUTS = {
  totalUses: "B7",
  buyerEquity: "B8",
  scenarioName: 11,
  lowestDscr: 17,
  maxPrice: 19,
  priceCheck: 22,
  irr: 26,
  moic: 27,
};

export class ModelInputError extends Error {}
export class ModelEngineError extends Error {}

// ================= Reading the template =================
const xmlUnescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
function parseRef(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return { col: colIndex(m[1]), row: Number(m[2]) - 1 };
}
const CELL_RE = /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs;

// Parse one worksheet's cells: { ref, attrs, inner, formula, value }
function parseCells(xml) {
  const cells = [];
  for (const m of xml.matchAll(CELL_RE)) {
    const [whole, ref, attrs, inner = ""] = m;
    const type = (/\bt="([^"]+)"/.exec(attrs) || [])[1] || "n";
    const f = /<f(?:\s[^>]*)?>(.*?)<\/f>/s.exec(inner);
    const v = /<v>(.*?)<\/v>/s.exec(inner);
    const t = /<is>.*?<t(?:\s[^>]*)?>(.*?)<\/t>.*?<\/is>/s.exec(inner);
    let value = null;
    if (type === "inlineStr") value = t ? xmlUnescape(t[1]) : "";
    else if (v) value = type === "n" ? Number(v[1]) : type === "b" ? v[1] === "1" : xmlUnescape(v[1]);
    cells.push({ ref, whole, attrs, formula: f ? xmlUnescape(f[1]) : null, formulaRaw: f ? f[1] : null, value, type });
  }
  return cells;
}

function loadTemplate() {
  const files = unzipSync(new Uint8Array(fs.readFileSync(TEMPLATE_PATH)));
  const workbookXml = strFromU8(files["xl/workbook.xml"]);
  const rels = strFromU8(files["xl/_rels/workbook.xml.rels"]);
  const sheets = [];
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)) {
    const name = xmlUnescape(m[1]);
    const target = new RegExp(`Id="${m[2]}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${m[2]}"`).exec(rels);
    const t = target[1] || target[2];
    const file = t.startsWith("/") ? t.slice(1) : "xl/" + t;
    const xml = strFromU8(files[file]);
    sheets.push({ name, file, xml, cells: parseCells(xml) });
  }
  return { files, sheets };
}

const TEMPLATE = loadTemplate();
const inputSheet = TEMPLATE.sheets.find((s) => s.name === INPUT_SHEET);
const inputCell = (ref) => inputSheet.cells.find((c) => c.ref === ref);
export const FORMULA_COUNT = TEMPLATE.sheets.reduce((n, s) => n + s.cells.filter((c) => c.formula).length, 0);

// Defaults = the values typed into the template's own input cells (nothing hard-coded here).
function templateValue(field) {
  const c = inputCell(field.cell);
  return c && c.value !== null && c.value !== "" ? c.value : null;
}
export function getTemplateDefaults() {
  const out = { assumptions: {}, deal: {} };
  for (const f of ASSUMPTION_FIELDS) out.assumptions[f.key] = templateValue(f);
  for (const f of DEAL_FIELDS) out.deal[f.key] = templateValue(f);
  return out;
}

// ================= Validating inputs =================
function cleanValue(field, raw) {
  const blank = raw === undefined || raw === null || raw === "";
  if (field.kind === "text") {
    if (blank) return null;
    if (typeof raw !== "string") throw new ModelInputError(`${field.label} must be text.`);
    // Strip control characters; written as plain text, never as a formula.
    const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, field.maxLength);
    return text || null;
  }
  if (field.kind === "yesno") {
    if (raw !== "Yes" && raw !== "No") throw new ModelInputError(`${field.label} must be Yes or No.`);
    return raw;
  }
  if (field.kind === "earningsType") {
    if (raw !== "SDE" && raw !== "EBITDA") throw new ModelInputError(`${field.label} must be SDE or EBITDA.`);
    return raw;
  }
  if (blank) {
    if (field.optional) return null;
    throw new ModelInputError(`${field.label} is required.`);
  }
  const n = typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) throw new ModelInputError(`${field.label} must be a number.`);
  if (field.kind === "years" && !Number.isInteger(n)) throw new ModelInputError(`${field.label} must be a whole number of years.`);
  if (n < field.min || n > field.max) {
    const fmt = (x) => (field.kind === "pct" ? `${+(x * 100).toFixed(4)}%` : x.toLocaleString("en-US"));
    throw new ModelInputError(`${field.label} must be between ${fmt(field.min)} and ${fmt(field.max)}.`);
  }
  return n;
}

// Returns { [cellRef]: value } for every input cell, or throws ModelInputError with a plain message.
export function validateInputs(deal, assumptions) {
  if (!deal || typeof deal !== "object" || Array.isArray(deal)) throw new ModelInputError("Missing deal inputs.");
  if (!assumptions || typeof assumptions !== "object" || Array.isArray(assumptions)) throw new ModelInputError("Missing assumptions.");
  const cells = {};
  for (const f of DEAL_FIELDS) cells[f.cell] = cleanValue(f, deal[f.key]);
  for (const f of ASSUMPTION_FIELDS) cells[f.cell] = cleanValue(f, assumptions[f.key]);
  const financed = cells.B28 + cells.B31 + cells.B64;
  if (financed > 1 + 1e-9) {
    throw new ModelInputError(`Senior loan + seller note + outside investors add up to ${+(financed * 100).toFixed(2)}% of total uses. Your equity can't be negative; lower one of them.`);
  }
  return cells;
}

// ================= Calculating with the formula engine =================
function buildEngine(overrides) {
  const sheetsData = {};
  for (const s of TEMPLATE.sheets) {
    const grid = [];
    for (const c of s.cells) {
      const { row, col } = parseRef(c.ref);
      let content;
      if (s.name === INPUT_SHEET && c.ref in overrides) content = overrides[c.ref]; // user/deal input
      else if (c.formula !== null) content = "=" + c.formula;
      else content = c.value;
      (grid[row] ||= [])[col] = content === "" ? null : content;
    }
    for (let r = 0; r < grid.length; r++) grid[r] = Array.from(grid[r] || [], (v) => (v === undefined ? null : v));
    sheetsData[s.name] = grid;
  }
  return HyperFormula.buildFromSheets(sheetsData, {
    licenseKey: "gpl-v3",
    evaluateNullToZero: true, // like Excel: a formula pointing at an empty cell gives 0
    smartRounding: false,
  });
}

function readCell(hf, sheetName, ref) {
  const sheet = hf.getSheetId(sheetName);
  const v = hf.getCellValue({ sheet, ...parseRef(ref) });
  if (v && typeof v === "object" && "type" in v) {
    throw new ModelEngineError(`The formula engine couldn't evaluate '${sheetName}'!${ref} (${v.value}${v.message ? ": " + v.message : ""}).`);
  }
  return v;
}

// Headline numbers from the filled template. Throws ModelEngineError if a needed formula can't be evaluated.
export function calculate(cells) {
  const hf = buildEngine(cells);
  try {
    const S = SUMMARY_SHEET;
    const num = (ref) => { const v = readCell(hf, S, ref); return typeof v === "number" ? v : null; }; // "n/a" -> null
    const scenarios = SCENARIO_COLUMNS.map((col) => ({
      name: String(readCell(hf, S, col + OUTPUTS.scenarioName)),
      lowestDscr: num(col + OUTPUTS.lowestDscr),
      maxPrice: num(col + OUTPUTS.maxPrice),
      priceCheck: String(readCell(hf, S, col + OUTPUTS.priceCheck)),
      irr: num(col + OUTPUTS.irr),
      moic: num(col + OUTPUTS.moic),
    }));
    return {
      totalUses: num(OUTPUTS.totalUses),
      buyerEquity: num(OUTPUTS.buyerEquity),
      purchasePrice: num("B5"),
      targetDscr: num("B9"),
      scenarios,
    };
  } finally {
    hf.destroy();
  }
}

// Every formula's value from the engine, keyed "Sheet!A1" (used by the tests and the filled file).
export function evaluateAll(cells) {
  const hf = buildEngine(cells);
  try {
    const out = {};
    for (const s of TEMPLATE.sheets) {
      const sheet = hf.getSheetId(s.name);
      for (const c of s.cells) if (c.formula !== null) out[`${s.name}!${c.ref}`] = hf.getCellValue({ sheet, ...parseRef(c.ref) });
    }
    return out;
  } finally {
    hf.destroy();
  }
}

// The template's own saved results for every formula (what Excel calculated for the sample deal).
export function templateSavedResults() {
  const out = {};
  for (const s of TEMPLATE.sheets) for (const c of s.cells) if (c.formula !== null) out[`${s.name}!${c.ref}`] = c.value;
  return out;
}

// ================= Writing the filled file =================
function attr(attrs, name) { return (new RegExp(`\\b${name}="([^"]*)"`).exec(attrs) || [])[1]; }
function cellXml(ref, attrs, inner, type) {
  const s = attr(attrs, "s");
  return `<c r="${ref}"${s !== undefined ? ` s="${s}"` : ""}${type ? ` t="${type}"` : ""}>${inner}</c>`;
}
function inputCellXml(cell, value) {
  if (value === null) return cellXml(cell.ref, cell.attrs, "", "n"); // blank
  if (typeof value === "number") return cellXml(cell.ref, cell.attrs, `<v>${value}</v>`, "n");
  return cellXml(cell.ref, cell.attrs, `<is><t xml:space="preserve">${xmlEscape(value)}</t></is>`, "inlineStr");
}
// Same formula text (unchanged), with its saved result updated to the engine's value.
function formulaCellXml(cell, value) {
  const f = `<f>${cell.formulaRaw}</f>`;
  if (typeof value === "number") return cellXml(cell.ref, cell.attrs, `${f}<v>${value}</v>`);
  if (typeof value === "boolean") return cellXml(cell.ref, cell.attrs, `${f}<v>${value ? 1 : 0}</v>`, "b");
  if (typeof value === "string") return cellXml(cell.ref, cell.attrs, `${f}<v>${xmlEscape(value)}</v>`, "str");
  if (value && typeof value === "object" && "value" in value) return cellXml(cell.ref, cell.attrs, `${f}<v>${xmlEscape(String(value.value))}</v>`, "e");
  return cellXml(cell.ref, cell.attrs, f); // empty result: no saved value
}

// Returns the filled .xlsx as a Uint8Array (in memory only).
export function fillTemplate(cells) {
  const results = evaluateAll(cells);
  const out = { ...TEMPLATE.files }; // untouched parts keep their exact bytes
  for (const s of TEMPLATE.sheets) {
    let xml = s.xml;
    for (const c of s.cells) {
      let replacement = null;
      if (s.name === INPUT_SHEET && c.ref in cells) replacement = inputCellXml(c, cells[c.ref]);
      else if (c.formula !== null) replacement = formulaCellXml(c, results[`${s.name}!${c.ref}`]);
      if (replacement !== null && replacement !== c.whole) xml = xml.replace(c.whole, () => replacement);
    }
    if (xml !== s.xml) out[s.file] = strToU8(xml);
  }
  // Make sure Excel fully recalculates when the file is opened.
  let wb = strFromU8(TEMPLATE.files["xl/workbook.xml"]);
  if (/<calcPr\b[^>]*fullCalcOnLoad="1"/.test(wb)) { /* already set in the template */ }
  else if (/<calcPr\b/.test(wb)) wb = wb.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"');
  else wb = wb.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
  out["xl/workbook.xml"] = strToU8(wb);
  return zipSync(out, { level: 6 });
}

// A safe download name based on the business name.
export function downloadName(businessName) {
  const base = String(businessName || "").replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "Deal";
  return `${base} - SearchDesk model.xlsx`;
}

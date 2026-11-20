// Automated tests for the financial model connection (run: npm test).
// They check that SearchDesk's numbers come from the approved template, unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import {
  TEMPLATE_PATH, FORMULA_COUNT, getTemplateDefaults, validateInputs, calculate, evaluateAll,
  templateSavedResults, fillTemplate, downloadName, ModelInputError,
} from "../model.js";

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const TEMPLATE_HASH_BEFORE = sha256(fs.readFileSync(TEMPLATE_PATH));
const defaults = getTemplateDefaults();

// The template's sample deal, with the template's default assumptions.
const SAMPLE_DEAL = { businessName: "Sample Deal (fictional)", earningsType: "SDE", revenue: 3000000, earnings: 750000, askingPrice: 2600000, offerPrice: null, subtractSalary: "No" };

const within = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: got ${actual}, expected ${expected} ± ${tol}`);

test("defaults are read from the template's own input cells", () => {
  assert.deepEqual(defaults.deal, SAMPLE_DEAL);
  assert.equal(defaults.assumptions.seniorPct, 0.8);
  assert.equal(defaults.assumptions.seniorIsSba, "Yes");
  assert.equal(defaults.assumptions.targetDscr, 1.4);
  assert.equal(defaults.assumptions.targetIrr, 0.25);
  for (const [k, v] of Object.entries(defaults.assumptions)) assert.notEqual(v, null, `default for ${k} missing`);
});

test("sample deal matches the template's results (within $1, 0.01x, 0.1%)", () => {
  const r = calculate(validateInputs(SAMPLE_DEAL, defaults.assumptions));
  within(r.totalUses, 2989242, 1, "total uses");
  within(r.buyerEquity, 298924, 1, "buyer equity");
  const expected = [
    { name: "Flat", dscr: 1.06, maxPrice: 1884031, irr: 0.432 },
    { name: "Base", dscr: 1.17, maxPrice: 2088768, irr: 0.664 },
    { name: "Upside", dscr: 1.28, maxPrice: 2339282, irr: 1.046 },
    { name: "Cost improvement", dscr: 1.16, maxPrice: 2072430, irr: 0.620 },
  ];
  expected.forEach((e, i) => {
    const s = r.scenarios[i];
    assert.equal(s.name, e.name);
    within(s.lowestDscr, e.dscr, 0.01, `${e.name} lowest DSCR`);
    within(s.maxPrice, e.maxPrice, 1, `${e.name} max price`);
    within(s.irr, e.irr, 0.001, `${e.name} IRR`);
    assert.equal(s.priceCheck, "Above max", `${e.name} price check`);
    assert.ok(typeof s.moic === "number" && s.moic > 1, `${e.name} MOIC`);
  });
});

test("the engine reproduces every one of the template's saved formula results", () => {
  const got = evaluateAll(validateInputs(SAMPLE_DEAL, defaults.assumptions));
  const saved = templateSavedResults();
  assert.equal(Object.keys(saved).length, FORMULA_COUNT);
  assert.equal(FORMULA_COUNT, 877);
  const problems = [];
  for (const [cell, want] of Object.entries(saved)) {
    const have = got[cell];
    if (have && typeof have === "object") { problems.push(`${cell}: engine error ${have.value}`); continue; }
    if (typeof want === "number") {
      // Tiny floating-point noise (e.g. 1e-9 left on a paid-off loan) is allowed.
      const ok = typeof have === "number" && (Math.abs(have - want) <= 1e-6 || Math.abs(have - want) / Math.abs(want) <= 1e-9);
      if (!ok) problems.push(`${cell}: ${have} vs ${want}`);
    } else if (have !== want) problems.push(`${cell}: ${JSON.stringify(have)} vs ${JSON.stringify(want)}`);
  }
  assert.deepEqual(problems, []);
});

test("changing an assumption (senior loan 70%) changes the results and is written into the file", () => {
  const base = calculate(validateInputs(SAMPLE_DEAL, defaults.assumptions));
  const changedAssumptions = { ...defaults.assumptions, seniorPct: 0.7 };
  const cells = validateInputs(SAMPLE_DEAL, changedAssumptions);
  const changed = calculate(cells);
  assert.notEqual(changed.totalUses, base.totalUses, "total uses should change (SBA fee depends on loan size)");
  assert.ok(changed.buyerEquity > base.buyerEquity + 250000, "buyer equity should rise by roughly 10% of uses");
  assert.ok(changed.scenarios[0].irr < base.scenarios[0].irr, "more equity in should lower the IRR");

  const xlsx = unzipSync(fillTemplate(cells));
  const template = unzipSync(new Uint8Array(fs.readFileSync(TEMPLATE_PATH)));
  const sheet2 = strFromU8(xlsx["xl/worksheets/sheet2.xml"]);
  assert.match(sheet2, /<c r="B28" s="14" t="n"><v>0\.7<\/v><\/c>/, "B28 should hold 0.7");
  // The saved result in the file is the engine's new number (Sources & Uses B18 = buyer equity).
  const sheet3 = strFromU8(xlsx["xl/worksheets/sheet3.xml"]);
  const b18 = Number(/<c r="B18"[^>]*><f>[^<]*<\/f><v>([^<]+)<\/v>/.exec(sheet3)[1]);
  within(b18, changed.buyerEquity, 0.01, "saved buyer equity in file");
});

test("the filled file keeps every formula, format, dropdown, and conditional format", () => {
  const cells = validateInputs({ ...SAMPLE_DEAL, businessName: "Project <Test> & Co", offerPrice: 2400000, subtractSalary: "Yes", earningsType: "EBITDA" },
    { ...defaults.assumptions, seniorPct: 0.7, investorPct: 0.05, seniorIsSba: "No" });
  const out = unzipSync(fillTemplate(cells));
  const tpl = unzipSync(new Uint8Array(fs.readFileSync(TEMPLATE_PATH)));
  assert.deepEqual(Object.keys(out), Object.keys(tpl), "same files, same order");
  const formulas = (xml) => [...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*><f>(.*?)<\/f>/gs)].map((m) => m[1] + "=" + m[2]);
  const block = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}\\b.*?</${tag}>`, "gs"))].map((m) => m[0]).join("");
  const styles = (xml) => [...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?\bs="(\d+)"/g)].map((m) => m[1] + ":" + m[2]).join(",");
  let formulaTotal = 0;
  for (const name of Object.keys(tpl)) {
    if (!name.startsWith("xl/worksheets/")) {
      if (name !== "xl/workbook.xml") assert.deepEqual(out[name], tpl[name], `${name} should be byte-identical`);
      continue;
    }
    const a = strFromU8(tpl[name]), b = strFromU8(out[name]);
    assert.deepEqual(formulas(b), formulas(a), `${name}: formulas unchanged`);
    formulaTotal += formulas(b).length;
    assert.equal(block(b, "dataValidations"), block(a, "dataValidations"), `${name}: dropdowns unchanged`);
    assert.equal(block(b, "conditionalFormatting"), block(a, "conditionalFormatting"), `${name}: conditional formatting unchanged`);
    assert.equal(styles(b), styles(a), `${name}: cell formats unchanged`);
    for (const tag of ["cols", "mergeCells", "sheetViews", "pageMargins"]) assert.equal(block(b, tag), block(a, tag), `${name}: ${tag} unchanged`);
  }
  assert.equal(formulaTotal, 877);
  assert.match(strFromU8(out["xl/workbook.xml"]), /<calcPr[^>]*fullCalcOnLoad="1"/, "Excel must fully recalculate on open");
  const sheet2 = strFromU8(out["xl/worksheets/sheet2.xml"]);
  assert.match(sheet2, /<c r="B5" s="7" t="inlineStr"><is><t xml:space="preserve">Project &lt;Test&gt; &amp; Co<\/t><\/is><\/c>/);
  assert.match(sheet2, /<c r="B6" s="\d+" t="inlineStr"><is><t xml:space="preserve">EBITDA<\/t>/);
  assert.match(sheet2, /<c r="B10" s="9" t="n"><v>2400000<\/v><\/c>/);
  assert.match(sheet2, /<c r="B18" s="\d+" t="inlineStr"><is><t xml:space="preserve">Yes<\/t>/);
  assert.match(sheet2, /<c r="B64" s="14" t="n"><v>0\.05<\/v><\/c>/);
  assert.match(sheet2, /<c r="B65" s="14" t="n"><v>0<\/v><\/c>/, "Investors 2-5 are left as in the template");
});

test("bad inputs are rejected with plain messages", () => {
  const A = defaults.assumptions;
  const bad = [
    [{ ...SAMPLE_DEAL, earningsType: "Cash" }, A, /SDE or EBITDA/],
    [{ ...SAMPLE_DEAL, subtractSalary: "maybe" }, A, /Yes or No/],
    [{ ...SAMPLE_DEAL, revenue: null }, A, /Revenue .* is required/],
    [{ ...SAMPLE_DEAL, askingPrice: -5 }, A, /Asking price must be between/],
    [{ ...SAMPLE_DEAL, earnings: "750000" }, A, /must be a number/],
    [{ ...SAMPLE_DEAL, revenue: Infinity }, A, /must be a number/],
    [SAMPLE_DEAL, { ...A, seniorPct: 1.5 }, /Senior loan % must be between/],
    [SAMPLE_DEAL, { ...A, seniorTerm: 7.5 }, /whole number/],
    [SAMPLE_DEAL, { ...A, seniorRate: 0.9 }, /Senior loan rate must be between/],
    [SAMPLE_DEAL, { ...A, seniorPct: 0.8, sellerPct: 0.2, investorPct: 0.1 }, /can't be negative/],
    [SAMPLE_DEAL, { ...A, seniorIsSba: true }, /Yes or No/],
    [null, A, /Missing deal/],
    [SAMPLE_DEAL, [], /Missing assumptions/],
  ];
  for (const [deal, a, msg] of bad) assert.throws(() => validateInputs(deal, a), (e) => e instanceof ModelInputError && msg.test(e.message), String(msg));
  // A formula-looking name is stored as plain text, never as a formula.
  const cells = validateInputs({ ...SAMPLE_DEAL, businessName: "=HYPERLINK(\"http://x\")\n" }, A);
  assert.equal(cells.B5, "=HYPERLINK(\"http://x\")");
  const sheet2 = strFromU8(unzipSync(fillTemplate(cells))["xl/worksheets/sheet2.xml"]);
  assert.match(sheet2, /<c r="B5" s="7" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK/);
});

test("download name is safe", () => {
  assert.equal(downloadName("Project Harbor"), "Project Harbor - SearchDesk model.xlsx");
  assert.equal(downloadName('a/b\\c:*?"<>|d'), "abcd - SearchDesk model.xlsx");
  assert.equal(downloadName(""), "Deal - SearchDesk model.xlsx");
});

test("POST /api/model and GET /api/model/defaults work through the server", async (t) => {
  const PORT = 3199;
  const env = { ...process.env, PORT: String(PORT), ANTHROPIC_API_KEY: "paste-your-key-here" };
  delete env.RENDER;
  const server = spawn(process.execPath, [path.join(import.meta.dirname, "..", "server.js")], { env, stdio: "ignore" });
  t.after(() => server.kill());
  const base = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 50; i++) { try { await fetch(base + "/"); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const post = (body, q = "", headers = {}) => fetch(base + "/api/model" + q, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...headers }, body: JSON.stringify(body) });

  const d = await (await fetch(base + "/api/model/defaults")).json();
  assert.deepEqual(d.assumptions, defaults.assumptions);

  const r = await post({ deal: SAMPLE_DEAL, assumptions: defaults.assumptions });
  assert.equal(r.status, 200);
  const j = await r.json();
  within(j.results.totalUses, 2989242, 1, "route total uses");

  const bad = await post({ deal: { ...SAMPLE_DEAL, earningsType: "X" }, assumptions: defaults.assumptions });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error.message, /SDE or EBITDA/);

  const evil = await post({ deal: SAMPLE_DEAL, assumptions: defaults.assumptions }, "", { Origin: "https://evil.example.com" });
  assert.equal(evil.status, 403);

  const dl = await post({ deal: { ...SAMPLE_DEAL, businessName: "Project Harbor" }, assumptions: { ...defaults.assumptions, seniorPct: 0.7 } }, "?download=1");
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get("content-type"), /spreadsheetml/);
  assert.match(dl.headers.get("content-disposition"), /Project Harbor - SearchDesk model\.xlsx/);
  const file = unzipSync(new Uint8Array(await dl.arrayBuffer()));
  assert.match(strFromU8(file["xl/worksheets/sheet2.xml"]), /<c r="B28" s="14" t="n"><v>0\.7<\/v><\/c>/);

  // Rate limit: 60 per 15 minutes per visitor. 3 calls above counted (the other-website call was refused
  // before counting, and the defaults route isn't limited), so 57 more are allowed, then 429.
  const statuses = [];
  for (let i = 0; i < 60; i++) statuses.push((await post({ deal: SAMPLE_DEAL, assumptions: defaults.assumptions })).status);
  assert.equal(statuses.filter((s) => s === 200).length, 57, "57 more allowed after the first 3");
  assert.deepEqual(statuses.slice(57), [429, 429, 429]);
});

test("the template file itself was not modified", () => {
  assert.equal(sha256(fs.readFileSync(TEMPLATE_PATH)), TEMPLATE_HASH_BEFORE);
  assert.equal(TEMPLATE_HASH_BEFORE, "0d7f4c1916bedbdf15b64b776f8f2e9074eadf33b9a585fc1cc054ed05b886b6");
});

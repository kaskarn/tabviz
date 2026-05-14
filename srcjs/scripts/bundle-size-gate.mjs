#!/usr/bin/env node
//
// bundle-size-gate.mjs — fail CI when a vendored bundle exceeds the
// checked-in budget by more than 10%.
//
// Reads `srcjs/bundle-size-budget.json` (an object mapping bundle path
// → committed byte count). Compares the current on-disk size of each
// bundle and exits non-zero if any has grown >10% past its budget.
//
// Workflow:
//   * Author edits frontend code, runs `npm run build` (or CI does).
//   * `npm run check:size` runs this script. Under the 10% threshold:
//     pass. Over: fail with a per-bundle report telling the author
//     what to bump.
//   * Intentional growth (new feature, etc.): the author bumps the
//     budget in `bundle-size-budget.json` in the same PR and notes
//     why in the PR description. The 10% headroom catches accidental
//     growth — minor wobble (chunking, minification) stays under.
//
// Why bytes (not gzip): gzip ratio fluctuates with content arrangement
// in ways the author can't reason about locally. Raw byte size is
// authoritative and parse-cost-correlated.

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BUDGET_FILE = path.resolve(__dirname, "..", "bundle-size-budget.json");
const THRESHOLD = 1.10; // 10% headroom over budget

const budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));

let worst = 0;
const rows = [];
let failures = 0;

for (const [relPath, budgetBytes] of Object.entries(budget)) {
  const full = path.resolve(REPO_ROOT, relPath);
  let actual = null;
  try {
    actual = statSync(full).size;
  } catch {
    rows.push({ path: relPath, status: "MISSING", actual: null, budget: budgetBytes, ratio: null });
    failures++;
    continue;
  }
  const ratio = actual / budgetBytes;
  worst = Math.max(worst, ratio);
  const status = ratio <= 1 ? "OK" : ratio <= THRESHOLD ? "WARN" : "FAIL";
  if (status === "FAIL") failures++;
  rows.push({ path: relPath, status, actual, budget: budgetBytes, ratio });
}

const colWidth = Math.max(...rows.map((r) => r.path.length));
console.log(`Bundle size gate — threshold ${((THRESHOLD - 1) * 100).toFixed(0)}% over budget`);
console.log("".padEnd(colWidth + 40, "─"));
for (const r of rows) {
  const actualStr = r.actual == null ? "(missing)" : (r.actual / 1024).toFixed(1) + " kB";
  const budgetStr = (r.budget / 1024).toFixed(1) + " kB";
  const ratioStr = r.ratio == null ? "n/a" : `${(r.ratio * 100).toFixed(1)}%`;
  console.log(
    `${r.path.padEnd(colWidth)}  ${r.status.padEnd(4)}  ${actualStr.padStart(10)}  /  ${budgetStr.padStart(10)}  (${ratioStr})`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} bundle(s) over the ${((THRESHOLD - 1) * 100).toFixed(0)}% threshold. Either reduce size or bump bundle-size-budget.json with a justification in the PR description.`);
  process.exit(1);
}
console.log(`\nWorst ratio: ${(worst * 100).toFixed(1)}%`);

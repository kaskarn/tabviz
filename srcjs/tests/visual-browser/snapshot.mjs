#!/usr/bin/env node
/**
 * Browser visual-regression harness for tabviz.
 *
 * Given a directory of self-contained widget HTML files, renders each
 * in headless Chromium, captures a PNG of the `.tabviz-container`
 * element, and diffs against baseline PNGs. Mismatches are reported
 * with a side-by-side composite PNG (baseline | actual | diff) for
 * eyeball review.
 *
 * Usage:
 *   node tests/visual-browser/snapshot.mjs [--update]
 *
 *   --update    Treat current output as the new baseline (overwrite
 *               baseline PNGs with what just rendered). Use this
 *               after intentionally changing rendering, with a
 *               commit message explaining what changed.
 *   --html-dir  Directory with input *.html files (default:
 *               tests/visual-browser/fixtures/)
 *   --baseline  Baseline PNG directory (default:
 *               tests/visual-browser/baseline/)
 *   --output    Actual + diff output directory (default:
 *               tests/visual-browser/output/)
 *   --threshold Per-pixel match tolerance, 0–1 (default 0.1)
 *
 * Exit codes:
 *   0  all snapshots match (or --update successful)
 *   1  at least one mismatch
 *   2  fatal harness error
 */

import puppeteer from "puppeteer";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

// ────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
function flag(name) { return argv.includes(`--${name}`); }
function opt(name, dflt) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
}

const HERE      = path.dirname(new URL(import.meta.url).pathname);
const HTML_DIR  = path.resolve(opt("html-dir", path.join(HERE, "fixtures")));
const BASELINE  = path.resolve(opt("baseline", path.join(HERE, "baseline")));
const OUTPUT    = path.resolve(opt("output",   path.join(HERE, "output")));
const THRESHOLD = parseFloat(opt("threshold", "0.1"));
const UPDATE    = flag("update");

if (!existsSync(HTML_DIR)) {
  console.error(`visual-browser: html dir not found: ${HTML_DIR}`);
  process.exit(2);
}
mkdirSync(BASELINE, { recursive: true });
mkdirSync(OUTPUT,   { recursive: true });

// ────────────────────────────────────────────────────────────────────
// Snapshot loop
// ────────────────────────────────────────────────────────────────────

const fixtures = readdirSync(HTML_DIR)
  .filter((f) => f.endsWith(".html"))
  .sort();

if (fixtures.length === 0) {
  console.error(`visual-browser: no .html fixtures in ${HTML_DIR}`);
  process.exit(2);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const results = []; // { name, status: "match" | "diff" | "new" | "error", ... }

try {
  for (const f of fixtures) {
    const name    = f.replace(/\.html$/, "");
    const inPath  = path.join(HTML_DIR, f);
    const actPath = path.join(OUTPUT,   `${name}.actual.png`);
    const basPath = path.join(BASELINE, `${name}.png`);
    const dffPath = path.join(OUTPUT,   `${name}.diff.png`);

    let pngBuf;
    try {
      pngBuf = await snapshotOne(browser, inPath);
    } catch (e) {
      results.push({ name, status: "error", message: String(e?.message ?? e) });
      continue;
    }

    writeFileSync(actPath, pngBuf);

    if (UPDATE) {
      copyFileSync(actPath, basPath);
      results.push({ name, status: "match" });
      continue;
    }

    if (!existsSync(basPath)) {
      results.push({ name, status: "new", path: actPath });
      continue;
    }

    const diff = comparePNG(basPath, actPath, dffPath, THRESHOLD);
    if (diff.match) {
      results.push({ name, status: "match" });
    } else {
      results.push({ name, status: "diff", ...diff });
    }
  }
} finally {
  await browser.close();
}

// ────────────────────────────────────────────────────────────────────
// Report
// ────────────────────────────────────────────────────────────────────

const counts = { match: 0, diff: 0, new: 0, error: 0 };
for (const r of results) counts[r.status]++;

console.log(`\nVisual snapshot results — ${fixtures.length} fixtures`);
console.log("─".repeat(60));
for (const r of results) {
  const tag =
    r.status === "match" ? "✓ MATCH" :
    r.status === "new"   ? "+ NEW  " :
    r.status === "diff"  ? "✗ DIFF " :
                           "! ERROR";
  let detail = "";
  if (r.status === "diff")  detail = ` (${r.diffPixels} px, ${r.diffRatio.toFixed(3)}%)`;
  if (r.status === "new")   detail = ` (no baseline; saved actual.png)`;
  if (r.status === "error") detail = ` ${r.message}`;
  console.log(`${tag}  ${r.name}${detail}`);
}
console.log("─".repeat(60));
console.log(`match: ${counts.match}  diff: ${counts.diff}  new: ${counts.new}  error: ${counts.error}`);

if (UPDATE) {
  console.log("\n(--update) baselines overwritten with current output.");
  process.exit(0);
}

if (counts.diff > 0 || counts.error > 0) {
  console.log(`\nDiff PNGs written to ${path.relative(process.cwd(), OUTPUT)}/`);
  console.log("Review the .diff.png and .actual.png files, then either:");
  console.log("  - fix the regression, OR");
  console.log("  - re-run with --update if the change was intentional");
  process.exit(1);
}

if (counts.new > 0) {
  console.log("\nNew fixtures without baselines. Once you've eyeballed the .actual.png,");
  console.log("re-run with --update to seed the baseline.");
  process.exit(1);
}

process.exit(0);

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

async function snapshotOne(browser, htmlPath) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector(".tabviz-container", { timeout: 10000 });
    // Small settling delay — covers async measurement passes that
    // run shortly after first mount (column auto-width, axis ticks).
    await new Promise((r) => setTimeout(r, 500));
    const el = await page.$(".tabviz-container");
    if (!el) throw new Error("no .tabviz-container after mount");
    return await el.screenshot({ type: "png" });
  } finally {
    await page.close();
  }
}

function comparePNG(basPath, actPath, dffPath, threshold) {
  const bas = PNG.sync.read(readFileSync(basPath));
  const act = PNG.sync.read(readFileSync(actPath));
  if (bas.width !== act.width || bas.height !== act.height) {
    return {
      match: false,
      diffPixels: -1,
      diffRatio: NaN,
      message: `dimension mismatch baseline=${bas.width}x${bas.height} actual=${act.width}x${act.height}`,
    };
  }
  const diff = new PNG({ width: bas.width, height: bas.height });
  const diffPixels = pixelmatch(
    bas.data, act.data, diff.data, bas.width, bas.height, { threshold },
  );
  if (diffPixels === 0) {
    return { match: true };
  }
  writeFileSync(dffPath, PNG.sync.write(diff));
  const diffRatio = (diffPixels / (bas.width * bas.height)) * 100;
  return { match: false, diffPixels, diffRatio };
}


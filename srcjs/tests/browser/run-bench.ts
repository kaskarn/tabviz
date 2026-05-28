/**
 * Browser-based bench harness for tabviz.
 *
 * Launches headless Chromium via Puppeteer, loads a static HTML page
 * with an HTMLWidgets shim, injects a tabviz bundle as a script tag,
 * and times `renderValue(spec)` against synthetic fixtures of varying
 * scale and split shapes.
 *
 * Usage:
 *   bun run tests/browser/run-bench.ts                 # current build
 *   bun run tests/browser/run-bench.ts --bundle <path> # specific build
 *   bun run tests/browser/run-bench.ts --out <path>    # write JSON results
 *
 * Designed for before/after diffing. Capture a baseline with
 *   bun run tests/browser/run-bench.ts --out tests/browser/baseline.json
 * then change the bundle (e.g. rebuild after a refactor) and rerun with a
 * different --out to compare.
 */

import puppeteer, { type Page } from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";
import {
  getSingleFixtures,
  getSplitFixtures,
  type BenchFixture,
  type SplitBenchFixture,
} from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const DEFAULT_BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const DEFAULT_CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");

// ─────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────

interface CLIOpts {
  bundle: string;
  cssPath: string;
  out: string | null;
  iters: number;
  headed: boolean;
}

function parseArgs(): CLIOpts {
  const args = process.argv.slice(2);
  const opts: CLIOpts = {
    bundle: DEFAULT_BUNDLE,
    cssPath: DEFAULT_CSS,
    out: null,
    iters: 5,
    headed: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--bundle") opts.bundle = path.resolve(args[++i]);
    else if (a === "--css") opts.cssPath = path.resolve(args[++i]);
    else if (a === "--out") opts.out = path.resolve(args[++i]);
    else if (a === "--iters") opts.iters = parseInt(args[++i], 10);
    else if (a === "--headed") opts.headed = true;
    else if (a === "--help") {
      console.log(
        "Usage: bun run tests/browser/run-bench.ts [--bundle <path>] [--css <path>] [--out <path>] [--iters N] [--headed]"
      );
      process.exit(0);
    }
  }
  return opts;
}

// ─────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────

interface SampleStats {
  iterations: number;
  medianMs: number;
  meanMs: number;
  stddev: number;
  minMs: number;
  maxMs: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 0 ? (s[n / 2 - 1] + s[n / 2]) / 2 : s[(n - 1) / 2];
}
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stddev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}
function summarize(samples: number[]): SampleStats {
  return {
    iterations: samples.length,
    medianMs: median(samples),
    meanMs: mean(samples),
    stddev: stddev(samples),
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Browser-side helpers (serialized into page.evaluate)
// ─────────────────────────────────────────────────────────────────────────

// Browser-side bench API exposed on window.__bench:
//   - putSpec(key, spec)  — cache a spec under a string key (one transfer)
//   - mountOnce(key)      — single fresh mount, returns ms elapsed
//
// We deliberately keep the browser-side loop body small (one mount per
// `page.evaluate`) so Chrome's GC has time to clean up between renders.
// Batching multiple 5k-row mounts inside a single evaluate triggers
// memory pressure and trips the CDP `protocolTimeout` even with headroom.
async function installHarness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      HTMLWidgets: { find: (name: string) => unknown };
      __bench: {
        specs: Record<string, unknown>;
        putSpec: (key: string, spec: unknown) => void;
        mountOnce: (key: string) => number;
      };
    };
    const binding = w.HTMLWidgets.find("tabviz") as
      | {
          factory: (
            el: HTMLElement,
            width: number,
            height: number,
          ) => { renderValue: (s: unknown) => void; resize?: (w: number, h: number) => void };
        }
      | undefined;
    if (!binding) throw new Error("tabviz binding not found on window.HTMLWidgets");

    const specs: Record<string, unknown> = {};
    w.__bench = {
      specs,
      putSpec(key, spec) { specs[key] = spec; },
      mountOnce(key) {
        const spec = specs[key];
        if (!spec) throw new Error(`spec ${key} not registered`);
        const host = document.getElementById("widget");
        if (!host) throw new Error("missing #widget container");
        host.innerHTML = "";
        const inner = document.createElement("div");
        inner.style.width = "1200px";
        inner.style.height = "800px";
        host.appendChild(inner);

        const instance = binding.factory(inner, 1200, 800);
        const t0 = performance.now();
        instance.renderValue(spec);
        const t1 = performance.now();
        return t1 - t0;
      },
    };
  });
}

async function registerSpec(page: Page, key: string, spec: unknown): Promise<void> {
  await page.evaluate(
    (k, s) => {
      (window as unknown as { __bench: { putSpec: (k: string, s: unknown) => void } })
        .__bench.putSpec(k, s);
    },
    key,
    spec,
  );
}

async function mountOnce(page: Page, key: string): Promise<number> {
  return (await page.evaluate(
    (k) =>
      (window as unknown as { __bench: { mountOnce: (k: string) => number } })
        .__bench.mountOnce(k),
    key,
  )) as number;
}

// Wall-clock budget per scenario. If a 5k-row render + warm-ups can't
// complete in this budget, we record "timeout" and move on instead of
// chasing protocol-timeout configuration forever.
const SCENARIO_BUDGET_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function benchScenario(
  page: Page,
  key: string,
  iters: number,
): Promise<SampleStats | "timeout"> {
  // Warm-up — JIT, layout cache, font load priming. Two warm calls outside
  // the recorded samples. Each is its own evaluate so Chrome can settle
  // between them.
  const samples: number[] = [];
  try {
    await withTimeout(mountOnce(page, key), SCENARIO_BUDGET_MS, `${key}:warm1`);
    await withTimeout(mountOnce(page, key), SCENARIO_BUDGET_MS, `${key}:warm2`);
    for (let i = 0; i < iters; i++) {
      const ms = await withTimeout(
        mountOnce(page, key),
        SCENARIO_BUDGET_MS,
        `${key}:${i}`,
      );
      samples.push(ms);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [timeout/error] ${key}: ${msg}`);
    return "timeout";
  }
  return summarize(samples);
}

// ─────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────

interface Result {
  scenario: string;
  fixture: string;
  rows: number;
  columns: number;
  subsets?: number;
  /** Either timing stats or the literal string "timeout" when the
   *  scenario didn't complete in `SCENARIO_BUDGET_MS`. */
  stats: SampleStats | "timeout";
}

function fmtMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(3)} ms`;
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

function printTable(results: Result[]): void {
  const colScenario = Math.max(10, ...results.map((r) => r.scenario.length));
  const colFixture = Math.max(8, ...results.map((r) => r.fixture.length));
  const colWidths = [colScenario, colFixture, 6, 12, 12, 12, 12];
  const headers = ["scenario", "fixture", "iters", "median", "mean", "min", "max"];
  const sep = colWidths.map((w) => "─".repeat(w)).join("  ");
  console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join("  "));
  console.log(sep);
  for (const r of results) {
    let row: string[];
    if (r.stats === "timeout") {
      row = [
        r.scenario.padEnd(colWidths[0]),
        r.fixture.padEnd(colWidths[1]),
        "—".padStart(colWidths[2]),
        "TIMEOUT".padStart(colWidths[3]),
        "—".padStart(colWidths[4]),
        "—".padStart(colWidths[5]),
        "—".padStart(colWidths[6]),
      ];
    } else {
      row = [
        r.scenario.padEnd(colWidths[0]),
        r.fixture.padEnd(colWidths[1]),
        String(r.stats.iterations).padStart(colWidths[2]),
        fmtMs(r.stats.medianMs).padStart(colWidths[3]),
        fmtMs(r.stats.meanMs).padStart(colWidths[4]),
        fmtMs(r.stats.minMs).padStart(colWidths[5]),
        fmtMs(r.stats.maxMs).padStart(colWidths[6]),
      ];
    }
    console.log(row.join("  "));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log(`Browser bench — bundle: ${opts.bundle}`);
  console.log(`               iters:  ${opts.iters}`);

  const browser = await puppeteer.launch({
    headless: opts.headed ? false : true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // Default is 30s; the long mounts at 5k rows + 7-iter scenario plans
    // overrun it. With per-scenario withTimeout, the bench bails cleanly
    // after the first overrun; this larger headroom buys us slack for
    // the warm-up mounts.
    protocolTimeout: 600_000,
  });
  const results: Result[] = [];
  let writeAndExit = () => {
    printTable(results);
    if (opts.out) {
      writeFileSync(
        opts.out,
        JSON.stringify(
          {
            bundle: opts.bundle,
            iters: opts.iters,
            timestamp: new Date().toISOString(),
            results,
          },
          null,
          2,
        ),
      );
      console.log(`\nResults written: ${opts.out}`);
    }
  };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });

    // Load the fixture HTML.
    await page.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" });
    // Inject the CSS (the widget reads --tv-* custom properties; CSS isn't
    // strictly required for measurement-correctness but the bundle expects
    // it to be present for some layout sizing).
    await page.addStyleTag({ path: opts.cssPath });
    // Inject the bundle. This is the only place the bundle version varies.
    await page.addScriptTag({ path: opts.bundle });
    // Build the harness helpers on `window.__bench`.
    await installHarness(page);

    // Surface browser-side console errors loudly — they otherwise vanish.
    page.on("pageerror", (err) => console.error("[browser error]", err));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("[browser console]", msg.text());
    });

    // After the first timeout, Chrome's still mid-render and subsequent
    // mounts can't recover cleanly inside the same page. Rather than
    // restart the browser between scenarios (more plumbing than this
    // bench needs), bail and mark remaining scenarios as timeouts so the
    // output is at least a complete record of what we tried.
    let bailed = false;

    // ── Single specs ──────────────────────────────────────────────────
    const singles: BenchFixture[] = getSingleFixtures();
    for (const fx of singles) {
      if (bailed) {
        results.push({ scenario: "renderValue", fixture: fx.name, rows: fx.rows, columns: fx.columns, stats: "timeout" });
        continue;
      }
      const key = `single_${fx.name}`;
      await registerSpec(page, key, fx.spec);
      const stats = await benchScenario(page, key, opts.iters);
      results.push({ scenario: "renderValue", fixture: fx.name, rows: fx.rows, columns: fx.columns, stats });
      console.error(
        `  ${fx.name}: ${stats === "timeout" ? "TIMEOUT" : `median ${stats.medianMs.toFixed(1)}ms`}`,
      );
      if (stats === "timeout") bailed = true;
    }

    // ── Split scenarios ───────────────────────────────────────────────
    const splits: SplitBenchFixture[] = getSplitFixtures();
    const splitIters = Math.max(2, Math.min(opts.iters, 3));
    for (const sfx of splits) {
      if (bailed) {
        results.push({ scenario: "split.renderAll", fixture: sfx.name, rows: sfx.rowsPerSubset, columns: sfx.columns, subsets: sfx.subsets, stats: "timeout" });
        continue;
      }
      // Register each subset spec under its own key. Cheaper than
      // re-transferring per iteration.
      const keys = sfx.specs.map((_, i) => `${sfx.name}_${i}`);
      for (let i = 0; i < sfx.specs.length; i++) {
        await registerSpec(page, keys[i], sfx.specs[i]);
      }
      const subsetTotals: number[] = [];
      let timedOut = false;
      try {
        for (let iter = 0; iter < splitIters && !timedOut; iter++) {
          let total = 0;
          for (const k of keys) {
            total += await withTimeout(mountOnce(page, k), SCENARIO_BUDGET_MS, `${sfx.name}:${k}`);
          }
          subsetTotals.push(total);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [timeout/error] ${sfx.name}: ${msg}`);
        timedOut = true;
      }
      const stats: SampleStats | "timeout" =
        timedOut || subsetTotals.length === 0 ? "timeout" : summarize(subsetTotals);
      results.push({
        scenario: "split.renderAll",
        fixture: sfx.name,
        rows: sfx.rowsPerSubset,
        columns: sfx.columns,
        subsets: sfx.subsets,
        stats,
      });
      console.error(
        `  ${sfx.name}: ${stats === "timeout" ? "TIMEOUT" : `median ${stats.medianMs.toFixed(1)}ms`} (${sfx.subsets} subsets)`,
      );
      if (stats === "timeout") bailed = true;
    }

    writeAndExit();
  } catch (err) {
    console.error("[bench-error]", err);
    // Save whatever we got before the exception, so a partial-run JSON
    // still lands on disk for diffing against another version.
    writeAndExit();
  } finally {
    try { await browser.close(); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

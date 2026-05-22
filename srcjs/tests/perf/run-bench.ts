/**
 * tabviz performance benchmark runner.
 *
 *   bun run tests/perf/run-bench.ts
 *
 * No browser, no R. Measures the algorithmic hot paths against synthetic
 * fixtures. See README.md for fixture/scenario taxonomy. Total runtime
 * budget: <60s; if a single scenario exceeds 5s, lower its iteration count
 * or shrink the fixture.
 */

import { FIXTURES, type Fixture } from "./fixtures";
import { estimateTextWidth } from "../../src/lib/width-utils";
import {
  measureString,
  registerFontMetrics,
  _resetFontMetricsRegistry,
  measureFontMetricsFromCanvas,
  type FontKey,
  type FontMetrics,
} from "../../src/lib/width-measure";
import { resolveTheme } from "../../src/lib/theme-resolve";
import { COCHRANE_DRAFT } from "../../src/lib/theme-presets-inputs";
import { buildThemeCSS } from "../../src/lib/theme-css";
import { getColumnDisplayText } from "../../src/lib/formatters";

// ─────────────────────────────────────────────────────────────────────────
// Benchmark harness
// ─────────────────────────────────────────────────────────────────────────

interface Result {
  scenario: string;
  fixture: string;
  iterations: number;
  medianMs: number;
  meanMs: number;
  stddev: number;
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

/**
 * Run `fn` `iters` times, warm twice first. Returns timing stats in ms.
 * Times are wall-clock via performance.now().
 */
function bench(
  scenario: string,
  fixture: string,
  fn: () => unknown,
  iters = 5,
): Result {
  // Warm-up — JIT, branch prediction, allocation caches.
  fn();
  fn();
  const samples: number[] = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return {
    scenario,
    fixture,
    iterations: iters,
    medianMs: median(samples),
    meanMs: mean(samples),
    stddev: stddev(samples),
  };
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
  const headers = ["scenario", "fixture", "iters", "median", "mean", "stddev"];
  const colWidths = [colScenario, colFixture, 6, 12, 12, 12];
  const sep = colWidths.map((w) => "─".repeat(w)).join("  ");
  console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join("  "));
  console.log(sep);
  for (const r of results) {
    const row = [
      r.scenario.padEnd(colWidths[0]),
      r.fixture.padEnd(colWidths[1]),
      String(r.iterations).padStart(colWidths[2]),
      fmtMs(r.medianMs).padStart(colWidths[3]),
      fmtMs(r.meanMs).padStart(colWidths[4]),
      fmtMs(r.stddev).padStart(colWidths[5]),
    ];
    console.log(row.join("  "));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────────────

const FONT_DATA: FontKey = { family: "Inter, system-ui, sans-serif", weight: 400 };
const FONT_HEADER: FontKey = { family: "Inter, system-ui, sans-serif", weight: 600 };
const FONT_SIZE = 14;

/** Synthetic per-character widths matching the estimator's tuning, so the
 *  registered-mode path measures the same algorithmic shape (sum-per-char)
 *  as a real bundled table would. Values are em-units. */
function fakeBundledMetrics(): FontMetrics {
  // Use the estimator's class widths to seed values; this is what a build-
  // time bundled table would look like for a font we'd shipped.
  const map = new Map<string, number>();
  const set = (s: string, em: number) => { for (const c of s) map.set(c, em); };
  set("ilI1.,;:|!()[]{}' -", 0.35);
  set("×−", 0.4);
  set("mwMW@%", 0.85);
  set("0123456789", 0.6);
  set("ABCDEFGHJKLNOPQRSTUVXYZ", 0.68);
  set("abcdefghjklnopqrstuvxyz", 0.55);
  set("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻", 0.15);
  return { charWidths: map, fallbackCharWidth: 0.55 };
}

/** Total-width sum over header + all displayable cells. Stand-in for the
 *  inner loop of `doMeasurement.measureLeafColumn`. */
function totalWidthEstimator(fx: Fixture): number {
  let total = 0;
  for (const col of fx.columns) {
    if (col.header) total += estimateTextWidth(col.header, FONT_SIZE, 600);
    for (const row of fx.rows) {
      const text = getColumnDisplayText(row, col);
      if (text) total += estimateTextWidth(text, FONT_SIZE, 400);
    }
  }
  return total;
}

function totalWidthMeasureString(fx: Fixture): number {
  let total = 0;
  for (const col of fx.columns) {
    if (col.header) total += measureString(col.header, FONT_HEADER, FONT_SIZE);
    for (const row of fx.rows) {
      const text = getColumnDisplayText(row, col);
      if (text) total += measureString(text, FONT_DATA, FONT_SIZE);
    }
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

function main(): void {
  const results: Result[] = [];

  // Materialize fixtures once so generation time doesn't pollute scenario
  // timings. Generation isn't on any hot path the user perceives.
  const single: Record<string, Fixture> = {
    small_mixed:  FIXTURES.small_mixed(),
    medium_mixed: FIXTURES.medium_mixed(),
    large_mixed:  FIXTURES.large_mixed(),
    xl_mixed:     FIXTURES.xl_mixed(),
  };
  const split: Record<string, Fixture[]> = {
    split_small:  FIXTURES.split_small(),
    split_medium: FIXTURES.split_medium(),
    split_large:  FIXTURES.split_large(),
  };

  // ── Width measurement ──────────────────────────────────────────────────
  for (const [name, fx] of Object.entries(single)) {
    _resetFontMetricsRegistry();
    results.push(bench("measure.estimator", name, () => totalWidthEstimator(fx)));
    _resetFontMetricsRegistry();
    results.push(bench("measure.measureString", name, () => totalWidthMeasureString(fx)));
    // After bundled registration — exercises the lookup path.
    _resetFontMetricsRegistry();
    registerFontMetrics(FONT_DATA, fakeBundledMetrics());
    registerFontMetrics(FONT_HEADER, fakeBundledMetrics());
    results.push(bench("measure.measureString*", name, () => totalWidthMeasureString(fx)));
  }

  // ── Theme cascade + CSS emit ──────────────────────────────────────────
  // These don't scale with row count; one fixture for the lot.
  results.push(bench("theme.resolve",       "-", () => resolveTheme(COCHRANE_DRAFT)));
  // Materialize a resolved theme once for the CSS benchmarks; reusing the
  // same reference exercises the WeakMap cache on the second call.
  const resolved = resolveTheme(COCHRANE_DRAFT);
  results.push(bench("theme.cssBuild",       "-", () => buildThemeCSS(resolved), 3));
  results.push(bench("theme.cssBuild.cached","-", () => buildThemeCSS(resolved)));

  // ── Split-by composites ───────────────────────────────────────────────
  for (const [name, subsets] of Object.entries(split)) {
    _resetFontMetricsRegistry();
    registerFontMetrics(FONT_DATA, fakeBundledMetrics());
    registerFontMetrics(FONT_HEADER, fakeBundledMetrics());
    results.push(bench("split.measure", name, () => {
      let t = 0;
      for (const fx of subsets) t += totalWidthMeasureString(fx);
      return t;
    }));
    results.push(bench("split.themeBuild", name, () => {
      // Theme-build is shared across subsets (cache hit after first); this
      // measures the realistic per-render cost of N subsets reading shared
      // CSS.
      let s = 0;
      for (const _ of subsets) s += buildThemeCSS(resolved).length;
      return s;
    }));
  }

  // ── (Diagnostic) Canvas warm-up — runs only when Canvas exists. ───────
  // In Bun/Node this returns null and the bench is a no-op. Kept so the
  // same script reports something when run in a Canvas-capable environment.
  const m = measureFontMetricsFromCanvas(FONT_DATA);
  if (m) {
    results.push(bench("canvas.warmFont", "-", () => {
      measureFontMetricsFromCanvas(FONT_DATA);
    }, 3));
  }

  printTable(results);

  // Summary line for quick scanning at the bottom.
  const total = results.reduce((s, r) => s + r.medianMs * r.iterations, 0);
  console.log(`\nTotal sampled time: ${fmtMs(total)} (${results.length} scenarios)\n`);
}

main();

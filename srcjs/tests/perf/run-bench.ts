/**
 * tabviz performance benchmark runner.
 *
 *   bun run tests/perf/run-bench.ts                    # human table
 *   bun run tests/perf/run-bench.ts --write-baseline   # refresh baseline-current.json
 *   bun run tests/perf/run-bench.ts --gate             # CI regression gate
 *
 * No browser, no R. Measures the algorithmic hot paths against synthetic
 * fixtures. See README.md for fixture/scenario taxonomy. Total runtime
 * budget: <60s; if a single scenario exceeds 5s, lower its iteration count
 * or shrink the fixture.
 *
 * GATE MODE (roadmap M0-A, the last unchecked criterion): compares each
 * scenario's median against the checked-in baseline, NORMALIZED by a
 * runtime calibration workload so a laptop-recorded baseline transfers to
 * CI runners (machine speed cancels; only algorithmic drift remains).
 * Fails on: normalized regression > GATE_FACTOR on any scenario whose
 * baseline median ≥ NOISE_FLOOR_MS, or a baseline scenario that no longer
 * runs (the rot guard — this file itself rotted once: culled-preset
 * import, 2026-06-11). After an INTENTIONAL perf change, re-baseline with
 * --write-baseline and commit the diff alongside the change.
 */

import { FIXTURES, type Fixture } from "./fixtures";
import { estimateTextWidth } from "../../src/lib/width-utils";
import {
  rankTopK,
  measureExact,
  DEFAULT_TOP_K,
  type FontKey,
} from "../../src/lib/width-measure";
import { resolveTheme } from "../../src/lib/theme/resolve-theme";
import { createWire } from "../../src/lib/theme/theme-wire";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { NEJM } from "../../src/lib/theme/theme-presets-inputs";
import { buildThemeCSS } from "../../src/lib/theme/theme-css";
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

/** Stand-in for the OLD `doMeasurement.measureLeafColumn` inner loop:
 *  sum every cell's estimated width. Lets us hold the baseline visible
 *  even after the refactor — useful for comparing against the rank+top-K
 *  approach at the same scales. */
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

/** The CURRENT measurement strategy: per column, rank every cell by
 *  estimator, exact-measure the top-K, take the max. The exact pass
 *  returns the estimator value in V8 (no Canvas), so this scenario also
 *  reflects what V8 export does — `maxColumnEstimator` below isolates
 *  the rank-only cost for direct comparison. */
function maxColumnRankTopK(fx: Fixture): number {
  let total = 0;
  for (const col of fx.columns) {
    // Header pool (1 string).
    if (col.header) {
      const winners = rankTopK([col.header], FONT_SIZE, FONT_HEADER.weight, 1);
      for (const t of winners) {
        const w = measureExact(t, FONT_HEADER, FONT_SIZE)
          ?? estimateTextWidth(t, FONT_SIZE, FONT_HEADER.weight);
        if (w > total) total = w;
      }
    }
    // Cell pool.
    const candidates: string[] = [];
    for (const row of fx.rows) {
      const text = getColumnDisplayText(row, col);
      if (text) candidates.push(text);
    }
    const winners = rankTopK(candidates, FONT_SIZE, FONT_DATA.weight, DEFAULT_TOP_K);
    for (const t of winners) {
      const w = measureExact(t, FONT_DATA, FONT_SIZE)
        ?? estimateTextWidth(t, FONT_SIZE, FONT_DATA.weight);
      if (w > total) total = w;
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
  // `measure.estimator` is the OLD "estimator over every cell" baseline.
  // `measure.rankTopK` is the CURRENT strategy (rank arithmetic + exact top-K).
  // In Bun (no Canvas), the exact pass falls back to the estimator — so the
  // rankTopK scenario is dominated by the rank pass + ~30 estimator calls
  // for the top-K. In a real browser the top-K calls are Canvas-exact at
  // the same cost.
  for (const [name, fx] of Object.entries(single)) {
    results.push(bench("measure.estimator", name, () => totalWidthEstimator(fx)));
    results.push(bench("measure.rankTopK",  name, () => maxColumnRankTopK(fx)));
  }

  // ── Theme cascade + CSS emit ──────────────────────────────────────────
  // These don't scale with row count; one fixture for the lot.
  // (Repaired 2026-06-11: the bench imported the culled COCHRANE_DRAFT +
  // a resolveTheme that no longer existed — it had rotted EXACTLY like
  // the browser gates pre-M0. The CI perf gate below is why it can't
  // rot silently again.)
  results.push(bench("theme.resolve", "-",
    () => resolveTheme(createWire(NEJM, "nejm"))));
  // Materialize a built theme once for the CSS benchmarks; reusing the
  // same reference exercises the WeakMap cache on the second call.
  const built = buildTheme(NEJM, "nejm");
  results.push(bench("theme.cssBuild",       "-", () => buildThemeCSS(built), 3));
  results.push(bench("theme.cssBuild.cached","-", () => buildThemeCSS(built)));

  // ── Split-by composites ───────────────────────────────────────────────
  for (const [name, subsets] of Object.entries(split)) {
    results.push(bench("split.measure", name, () => {
      let t = 0;
      for (const fx of subsets) t += maxColumnRankTopK(fx);
      return t;
    }));
    results.push(bench("split.themeBuild", name, () => {
      // Theme-build is shared across subsets (cache hit after first); this
      // measures the realistic per-render cost of N subsets reading shared
      // CSS.
      let s = 0;
      for (const _ of subsets) s += buildThemeCSS(built).length;
      return s;
    }));
  }

  const mode = process.argv.includes("--gate") ? "gate"
    : process.argv.includes("--write-baseline") ? "write"
    : "table";

  if (mode === "table") {
    printTable(results);
    const total = results.reduce((s, r) => s + r.medianMs * r.iterations, 0);
    console.log(`\nTotal sampled time: ${fmtMs(total)} (${results.length} scenarios)\n`);
    return;
  }

  const calibrationMs = runCalibration();
  if (mode === "write") {
    writeBaseline(results, calibrationMs);
    return;
  }
  gate(results, calibrationMs);
}

// ─────────────────────────────────────────────────────────────────────────
// Regression gate (roadmap M0-A)
// ─────────────────────────────────────────────────────────────────────────

const BASELINE_PATH = new URL("./baseline-current.json", import.meta.url).pathname;
/** Normalized-median regression tolerance. Calibration removes machine
 *  speed; 1.75× absorbs JIT/allocator variance while still catching the
 *  real bug class (an accidental O(n²) lands at 10×+). */
const GATE_FACTOR = 1.75;
/** Scenarios faster than this at baseline are noise-DOMINATED — their
 *  relative variance swamps the GATE_FACTOR, so they flake (a scenario
 *  passes on one commit and breaches on the next with IDENTICAL code —
 *  observed 2026-06-13 on estimator/medium_mixed). Informational only,
 *  never gate. Set to 3ms: there is a clean ~1.5ms→6ms gap in the baseline
 *  medians, so this excludes the sub-2ms scenarios (estimator/rankTopK
 *  _mixed, split_small) while keeping every stable ≥6ms scenario — the
 *  large/xl ones where a real algorithmic regression lands clearly and
 *  consistently. */
const NOISE_FLOOR_MS = 3;

interface BaselineFile {
  meta: { date: string; calibrationMs: number; note: string };
  results: { scenario: string; fixture: string; medianMs: number }[];
}

/** Fixed pure-CPU workload measured at runtime on BOTH sides of the
 *  comparison. Uses the estimator (string + arithmetic — same flavor as
 *  the scenarios) over a deterministic corpus. */
function runCalibration(): number {
  const corpus: string[] = [];
  for (let i = 0; i < 2000; i++) {
    corpus.push(`Treatment arm ${i} (95% CI ${i * 0.37}, ${i * 1.61}) — pooled`);
  }
  const run = (): number => {
    let t = 0;
    for (const s of corpus) t += estimateTextWidth(s, 14, 400);
    return t;
  };
  run(); run(); // warm
  const samples: number[] = [];
  for (let i = 0; i < 7; i++) {
    const t0 = performance.now();
    run();
    samples.push(performance.now() - t0);
  }
  return median(samples);
}

function writeBaseline(results: Result[], calibrationMs: number): void {
  const file: BaselineFile = {
    meta: {
      date: new Date().toISOString().slice(0, 10),
      calibrationMs,
      note: "Regenerate with: bun run tests/perf/run-bench.ts --write-baseline " +
        "(commit alongside any intentional perf change).",
    },
    results: results.map((r) => ({
      scenario: r.scenario, fixture: r.fixture,
      medianMs: Math.round(r.medianMs * 1000) / 1000,
    })),
  };
  require("fs").writeFileSync(BASELINE_PATH, JSON.stringify(file, null, 2) + "\n");
  console.log(`baseline written: ${BASELINE_PATH} (calibration ${fmtMs(calibrationMs)})`);
}

function gate(results: Result[], calibrationMs: number): void {
  let baseline: BaselineFile;
  try {
    baseline = JSON.parse(require("fs").readFileSync(BASELINE_PATH, "utf8")) as BaselineFile;
  } catch {
    console.error(`PERF GATE: no baseline at ${BASELINE_PATH} — run --write-baseline first.`);
    process.exit(1);
  }
  const speedFactor = calibrationMs / baseline!.meta.calibrationMs;
  console.log(`calibration: baseline ${fmtMs(baseline!.meta.calibrationMs)} → here ` +
    `${fmtMs(calibrationMs)} (machine factor ${speedFactor.toFixed(2)}×)`);

  const now = new Map(results.map((r) => [`${r.scenario}/${r.fixture}`, r.medianMs]));
  const breaches: string[] = [];
  const infos: string[] = [];
  for (const b of baseline!.results) {
    const key = `${b.scenario}/${b.fixture}`;
    const cur = now.get(key);
    if (cur === undefined) {
      breaches.push(`${key}: baseline scenario MISSING from the run (bench rot — fix or re-baseline)`);
      continue;
    }
    now.delete(key);
    if (b.medianMs < NOISE_FLOOR_MS) continue; // noise floor — never gate
    const expected = b.medianMs * speedFactor;
    const ratio = cur / expected;
    const line = `${key}: ${fmtMs(cur)} vs expected ~${fmtMs(expected)} (${ratio.toFixed(2)}×)`;
    if (ratio > GATE_FACTOR) breaches.push(line);
    else infos.push(`  ok ${line}`);
  }
  for (const key of now.keys()) {
    infos.push(`  new scenario (not in baseline — consider --write-baseline): ${key}`);
  }
  console.log(infos.join("\n"));
  if (breaches.length > 0) {
    console.error(`\nPERF GATE: ${breaches.length} breach(es) [factor ${GATE_FACTOR}×]:`);
    for (const b of breaches) console.error(`  ✗ ${b}`);
    console.error("Intentional change? Re-baseline: bun run tests/perf/run-bench.ts --write-baseline");
    process.exit(1);
  }
  console.log(`\nPERF GATE PASSED (${baseline!.results.length} scenarios, factor ${GATE_FACTOR}×).`);
}

main();

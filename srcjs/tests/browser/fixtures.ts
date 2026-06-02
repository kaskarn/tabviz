/**
 * WebSpec generators for the browser bench. Reuses the synthetic data
 * shapes from `srcjs/tests/perf/fixtures.ts` and wraps them in the minimum
 * fields needed for the tabviz htmlwidget binding's `renderValue` to mount
 * the widget cleanly.
 *
 * Specs are intentionally minimal — defaults fill in everything the
 * renderer needs. The point is to exercise `measureAutoColumns` at scale,
 * not to assert on visual output.
 */

import { makeFixture, makeSplitFixture, type Fixture } from "../perf/fixtures";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { COCHRANE } from "../../src/lib/theme/theme-presets-inputs";

const THEME = buildTheme(COCHRANE, "cochrane");

function toWebSpec(fx: Fixture): unknown {
  return {
    version: "1.0",
    data: {
      rows: fx.rows,
      groups: [],
      summaries: [],
    },
    columns: fx.columns,
    theme: THEME,
    interaction: {
      enableExport: false,
      enableThemes: null,
      showGroupCounts: false,
    },
    layout: {
      plotWidth: 400,
      containerBorder: false,
    },
  };
}

export interface BenchFixture {
  name: string;
  spec: unknown;
  // Cardinality summary for reporting.
  rows: number;
  columns: number;
}

export interface SplitBenchFixture {
  name: string;
  specs: unknown[];
  subsets: number;
  rowsPerSubset: number;
  columns: number;
}

export function getSingleFixtures(): BenchFixture[] {
  // Browser bench skips the 10k tier — full DOM render of 150k cells trips
  // Puppeteer's protocol timeout in the slow path, and 10k is above the
  // target scale anyway (the user-stated comfortable ceiling is ~5k).
  // Stress at that scale belongs in the Bun bench (algorithmic only).
  const cfgs: { name: string; rows: number; cols: number }[] = [
    { name: "small_mixed",  rows: 100,    cols: 5 },
    { name: "medium_mixed", rows: 1_000,  cols: 10 },
    { name: "large_mixed",  rows: 5_000,  cols: 10 },
  ];
  return cfgs.map((c) => {
    const fx = makeFixture(c.name, c.rows, c.cols);
    return {
      name: c.name,
      spec: toWebSpec(fx),
      rows: c.rows,
      columns: c.cols,
    };
  });
}

export function getSplitFixtures(): SplitBenchFixture[] {
  const cfgs: { name: string; subsets: number; rows: number; cols: number }[] = [
    { name: "split_small",  subsets: 10, rows: 100,  cols: 8 },
    { name: "split_medium", subsets: 50, rows: 100,  cols: 8 },
    { name: "split_large",  subsets: 5,  rows: 1000, cols: 8 },
  ];
  return cfgs.map((c) => {
    const fxs = makeSplitFixture(c.name, c.subsets, c.rows, c.cols);
    return {
      name: c.name,
      specs: fxs.map(toWebSpec),
      subsets: c.subsets,
      rowsPerSubset: c.rows,
      columns: c.cols,
    };
  });
}

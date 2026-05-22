/**
 * Synthetic-fixture generators for performance benchmarks.
 *
 * These produce realistic-shape WebSpec-like structures at chosen scales
 * without R or actual rendering. The shape is just enough to feed the
 * algorithmic hot paths (width measurement, style serialization, theme
 * resolution, CSS emit). Not a full WebSpec — see in-file `Row` /
 * `ColumnSpec` shapes for the contract each bench function expects.
 */

import type { ColumnSpec, Row } from "../../src/types";

const STUDIES = [
  "Boston General", "Mass Eye & Ear", "Johns Hopkins", "Cleveland Clinic",
  "UCL Hospital", "Imperial College", "Charite Berlin", "LMU Munich",
  "Tokyo Medical", "Seoul National", "Stanford", "MGH Boston",
  "Mayo Clinic", "Penn Medicine", "UCSF", "Vanderbilt",
];

const FIRSTS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function studyLabel(i: number): string {
  if (i < STUDIES.length) return STUDIES[i];
  return `${STUDIES[i % STUDIES.length]} ${Math.floor(i / STUDIES.length) + 1}`;
}

// Deterministic pseudo-random so benchmarks are reproducible across runs.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makeRow(i: number, rand: () => number): Row {
  const p = 0.5 + rand() * 0.6;
  const lo = p - 0.15 - rand() * 0.1;
  const hi = p + 0.15 + rand() * 0.1;
  return {
    id: `r${i}`,
    label: studyLabel(i),
    metadata: {
      n: Math.floor(100 + rand() * 5000),
      events: Math.floor(rand() * 200),
      hr: Number(p.toFixed(3)),
      lower: Number(lo.toFixed(3)),
      upper: Number(hi.toFixed(3)),
      pvalue: Number((rand() * 0.5).toFixed(4)),
      subgroup: FIRSTS[i % FIRSTS.length],
      site: ["Americas", "Europe", "Asia"][i % 3],
      cohort: ["A", "B", "C", "D"][i % 4],
      progress: Math.floor(rand() * 100),
      category: ["High", "Medium", "Low"][i % 3],
      score: Number((rand() * 10).toFixed(2)),
      year: 2018 + Math.floor(rand() * 8),
      note: `Sample note ${i}`,
    },
    point: p,
    lower: lo,
    upper: hi,
  } as Row;
}

const COLUMN_DEFS: ColumnSpec[] = [
  { id: "label",    field: "label",    header: "Study",     type: "text",    width: "auto" } as ColumnSpec,
  { id: "n",        field: "n",        header: "N",         type: "numeric", width: "auto", options: { numeric: { thousandsSep: "," } } } as ColumnSpec,
  { id: "events",   field: "events",   header: "Events",    type: "numeric", width: "auto" } as ColumnSpec,
  { id: "hr",       field: "hr",       header: "HR",        type: "numeric", width: "auto", options: { numeric: { decimals: 2 } } } as ColumnSpec,
  { id: "lower",    field: "lower",    header: "Lower CI",  type: "numeric", width: "auto", options: { numeric: { decimals: 2 } } } as ColumnSpec,
  { id: "upper",    field: "upper",    header: "Upper CI",  type: "numeric", width: "auto", options: { numeric: { decimals: 2 } } } as ColumnSpec,
  { id: "pvalue",   field: "pvalue",   header: "P value",   type: "pvalue",  width: "auto" } as ColumnSpec,
  { id: "subgroup", field: "subgroup", header: "Subgroup",  type: "text",    width: "auto" } as ColumnSpec,
  { id: "site",     field: "site",     header: "Site",      type: "text",    width: "auto" } as ColumnSpec,
  { id: "cohort",   field: "cohort",   header: "Cohort",    type: "text",    width: "auto" } as ColumnSpec,
  { id: "category", field: "category", header: "Category",  type: "text",    width: "auto" } as ColumnSpec,
  { id: "score",    field: "score",    header: "Score",     type: "numeric", width: "auto", options: { numeric: { decimals: 1 } } } as ColumnSpec,
  { id: "year",     field: "year",     header: "Year",      type: "numeric", width: "auto" } as ColumnSpec,
  { id: "note",     field: "note",     header: "Note",      type: "text",    width: "auto" } as ColumnSpec,
  { id: "progress", field: "progress", header: "Progress",  type: "numeric", width: "auto" } as ColumnSpec,
];

export interface Fixture {
  name: string;
  rows: Row[];
  columns: ColumnSpec[];
}

export function makeFixture(name: string, nRows: number, nCols: number, seed = 42): Fixture {
  const rand = rng(seed);
  const rows: Row[] = [];
  for (let i = 0; i < nRows; i++) rows.push(makeRow(i, rand));
  const columns = COLUMN_DEFS.slice(0, Math.min(nCols, COLUMN_DEFS.length));
  return { name, rows, columns };
}

export function makeSplitFixture(name: string, nSubsets: number, rowsPerSubset: number, nCols: number, seed = 42): Fixture[] {
  const subsets: Fixture[] = [];
  for (let s = 0; s < nSubsets; s++) {
    subsets.push(makeFixture(`${name}/${s}`, rowsPerSubset, nCols, seed + s * 17));
  }
  return subsets;
}

export const FIXTURES = {
  small_mixed:     () => makeFixture("small_mixed",   100,    5),
  medium_mixed:    () => makeFixture("medium_mixed",  1_000, 10),
  large_mixed:     () => makeFixture("large_mixed",   5_000, 10),
  xl_mixed:        () => makeFixture("xl_mixed",     10_000, 15),
  split_small:     () => makeSplitFixture("split_small",   10,  100, 8),
  split_medium:    () => makeSplitFixture("split_medium",  50,  100, 8),
  split_large:     () => makeSplitFixture("split_large",    5, 1000, 8),
};

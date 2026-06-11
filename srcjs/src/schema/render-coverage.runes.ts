// Dual-target render sweep — the LIGHTWEIGHT completeness net
// (2026-06-11, harness-principles arc; vitest because init-dom imports
// Svelte components, which bun cannot load).
//
// The fixture-coverage lesson: the WYSIWYG matrix only ever exercises
// the columns its fixture happens to include, so a type whose renderer
// silently degrades can hide for months (the boot-split bug). This
// sweep is the per-type floor under all heavier harnesses: it walks
// EVERY concrete schema type, renders a sample value through the real
// dispatch in BOTH targets, and asserts the output is non-degenerate —
// no browser, milliseconds per type. Postures come from ONE place
// (coverage-rosters.ts), shared with boot-coverage.test.ts.
//
// It also enforces the intrinsic-height principle (the nejm-pill
// lesson): a type either registers a naturalHeight behavior or is on
// the SINGLE_LINE_HEIGHT roster — never silently neither.

import { describe, it, expect } from "vitest";
import "./init-dom"; // the FULL boot (Svelte renderers included)
import { SCHEMA_REGISTRY } from "./columns/index";
import { renderCell } from "./dispatch";
import { getBehaviors } from "./extend";
import { resolveSchema } from "./resolve";
import { SVG_TEXT_IS_CORRECT, OVERLAY_RENDERED, SINGLE_LINE_HEIGHT } from "./coverage-rosters";
import { buildTheme } from "../lib/theme/theme-adapter";
import { NEJM } from "../lib/theme/theme-presets-inputs";
import type { ColumnSpec } from "../types";
import type { RenderContext } from "./render-types";

const theme = buildTheme(NEJM, "nejm");

// Per-type sample columns + values. A type missing here fails the sweep
// by construction — add a sample when adding a type.
const SAMPLES: Record<string, { col: Record<string, unknown>; value: unknown; row?: Record<string, unknown> }> = {
  text:      { col: {}, value: "hello" },
  label:     { col: {}, value: "hello" },
  numeric:   { col: {}, value: 12.5 },
  n:         { col: {}, value: 245 },
  currency:  { col: { options: { numeric: { currency: "USD" } } }, value: 19.99 },
  percent:   { col: {}, value: 0.42 },
  date:      { col: {}, value: "2026-06-11" },
  pvalue:    { col: { options: { pvalue: { stars: true } } }, value: 0.004 },
  interval:  { col: { options: { interval: { point: "hr", lower: "lo", upper: "hi" } } }, value: 0.8, row: { hr: 0.8, lo: 0.6, hi: 1.0 } },
  events:    { col: { options: { events: { events: "ev", n: "n" } } }, value: 12, row: { ev: 12, n: 100 } },
  range:     { col: { options: { range: { minField: "lo", maxField: "hi" } } }, value: null, row: { lo: 1, hi: 9 } },
  reference: { col: { options: { reference: {} } }, value: "Smith 2020" },
  badge:     { col: { options: { badge: {} } }, value: "active" },
  icon:      { col: { options: { icon: { mapping: { ok: "check" } } } }, value: "ok" },
  img:       { col: { options: { img: {} } }, value: "https://x/y.png" },
  bar:       { col: { options: { bar: {} } }, value: 0.6 },
  progress:  { col: { options: { progress: {} } }, value: 0.6 },
  heatmap:   { col: { options: { heatmap: {} } }, value: 0.4 },
  ring:      { col: { options: { ring: {} } }, value: 0.7 },
  stars:     { col: { options: { stars: {} } }, value: 3 },
  pictogram: { col: { options: { pictogram: { glyph: "person" } } }, value: 4 },
  sparkline: { col: { options: { sparkline: {} } }, value: [1, 3, 2, 5] },
  custom:    { col: { options: {} }, value: "x" },
};

function ctxFor(sample: { row?: Record<string, unknown> }, target: "dom" | "svg"): RenderContext {
  return {
    cellWidth: 120,
    rowHeight: 24,
    row: sample.row ?? {},
    target: target === "dom" ? "browser" : "svg",
    naText: "—",
    theme,
    columnSummary: { min: 0, max: 10, sum: 10, mean: 5, count: 2 },
    rowIndex: 0,
    banks: undefined,
  } as unknown as RenderContext;
}

function colFor(key: string): ColumnSpec {
  const s = SAMPLES[key]!;
  const schema = SCHEMA_REGISTRY[key as keyof typeof SCHEMA_REGISTRY] as { type?: string };
  return { id: `c_${key}`, field: "v", type: schema.type ?? key, header: key, ...s.col } as unknown as ColumnSpec;
}

const concrete = Object.entries(SCHEMA_REGISTRY)
  .filter(([, s]) => !(s as { abstract?: boolean }).abstract)
  .map(([k]) => k)
  .filter((k) => !OVERLAY_RENDERED.has(k));

describe("dual-target render sweep (per-type completeness floor)", () => {
  it("every concrete type has a sample (sweep covers the registry by construction)", () => {
    const missing = concrete.filter((k) => !(k in SAMPLES));
    expect(missing, `add SAMPLES entries for: ${missing.join(", ")}`).toEqual([]);
  });

  for (const key of concrete) {
    if (!(key in SAMPLES)) continue;

    it(`${key}: DOM render is non-degenerate`, () => {
      const tree = renderCell(colFor(key), SAMPLES[key]!.value, ctxFor(SAMPLES[key]!, "dom"), undefined, "dom");
      // Every cell type must render SOMETHING in the browser. Text-ish
      // types may legitimately return null (TabvizPlot's legacy text
      // branch formats them) — but only the ones declared text-correct.
      if (!SVG_TEXT_IS_CORRECT.has(key)) {
        expect(tree, `${key} returned null from the dom dispatch`).not.toBeNull();
      }
    });

    it(`${key}: SVG render matches its declared posture`, () => {
      const tree = renderCell(colFor(key), SAMPLES[key]!.value, ctxFor(SAMPLES[key]!, "svg"), undefined, "svg");
      if (SVG_TEXT_IS_CORRECT.has(key)) return; // text fallback is correct
      expect(tree, `${key} has no svg renderer (export silently degrades to text — boot-split class)`).not.toBeNull();
      // Non-degenerate: an svg node must carry markup; text must carry value.
      const t = tree as { kind: string; markup?: string; value?: string } | null;
      if (t?.kind === "svg") expect(t.markup, `${key} svg renderer emitted empty markup for a real value`).not.toBe("");
      if (t?.kind === "text") expect(t.value).not.toBe("");
    });

    it(`${key}: declares its height posture (naturalHeight or SINGLE_LINE_HEIGHT)`, () => {
      // The nejm-pill principle: intrinsic height is never silently
      // undeclared. Walk the inheritance chain for a naturalHeight.
      const chain = resolveSchema(SCHEMA_REGISTRY[key as keyof typeof SCHEMA_REGISTRY] as never) as { key?: string }[];
      const hasHeight = chain.some((l) => l.key && getBehaviors(l.key)?.naturalHeight);
      expect(hasHeight || SINGLE_LINE_HEIGHT.has(key),
        `${key} neither registers naturalHeight nor sits on SINGLE_LINE_HEIGHT — declare its posture in coverage-rosters.ts (and verify the DOM box really is line-bound)`).toBe(true);
    });
  }
});

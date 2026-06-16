// Smoke tests for the Phase 4a text-only SVG renderers
// (pvalue / reference / range / img). They emit RenderText trees
// matching the legacy `svg-generator.ts::getCellValue` output for the
// same inputs — the dispatch on SVG export then takes over and the
// legacy per-type branches become unreachable.

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer, extractText } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { bootDomRenderers } from "../init-dom";
import "../init-dom";
import type { ColumnSpec } from "../../types";

// Earlier suites wipe registries via `__resetRuntimeRegistries()` —
// re-boot before each test so the dispatcher sees the SVG renderers.
beforeEach(() => {
  bootBuiltinBehaviors();
  bootDomRenderers();
});

function call(
  schemaKey: string,
  value: unknown,
  options: ColumnSpec["options"],
  ctx: Parameters<NonNullable<ReturnType<typeof dispatchRenderer>>>[2] = {
    cellWidth: 100,
    rowHeight: 24,
    row: {},
    target: "svg",
  },
): string {
  const fn = dispatchRenderer(schemaKey, "svg");
  if (!fn) throw new Error(`no svg renderer registered for ${schemaKey}`);
  return extractText(fn(value, options, ctx));
}

describe("Phase 4a — pvalue svg renderer", () => {
  test("formats p-value with default options", () => {
    expect(call("pvalue", 0.042, { pvalue: { digits: 2 } })).toBe("0.042");
  });

  test("uses scientific notation below expThreshold", () => {
    const out = call("pvalue", 1e-5, { pvalue: { digits: 2, expThreshold: 0.001 } });
    expect(out).toMatch(/^1\.0×10/);
  });

  test("null value returns naText", () => {
    expect(call("pvalue", null, {}, { cellWidth: 0, rowHeight: 0, row: {}, target: "svg", naText: "—" })).toBe("—");
  });
});

describe("Phase 4a — reference svg renderer", () => {
  test("returns the value when shorter than maxChars", () => {
    expect(call("reference", "see [1]", { reference: { maxChars: 30 } })).toBe("see [1]");
  });

  test("truncates to maxChars with ellipsis", () => {
    const long = "a very long reference text that should be cut";
    const out = call("reference", long, { reference: { maxChars: 10 } });
    expect(out.length).toBeLessThanOrEqual(11);
    expect(out.endsWith("…") || out.endsWith("...")).toBe(true);
  });

  test("null returns empty", () => {
    expect(call("reference", null, { reference: { maxChars: 30 } })).toBe("");
  });
});

describe("Phase 4a — range svg renderer", () => {
  test("formats min - max with default separator", () => {
    const out = call(
      "range",
      null,
      { range: { minField: "lo", maxField: "hi", decimals: 1 } },
      { cellWidth: 0, rowHeight: 0, row: { lo: 0.5, hi: 1.5 }, target: "svg" },
    );
    // default separator = the range schema default " - " (single source, mirrors CellRange.svelte)
    expect(out).toBe("0.5 - 1.5");
  });

  test("respects custom separator", () => {
    const out = call(
      "range",
      null,
      { range: { minField: "lo", maxField: "hi", separator: " to ", decimals: 0 } },
      { cellWidth: 0, rowHeight: 0, row: { lo: 10, hi: 20 }, target: "svg" },
    );
    expect(out).toBe("10 to 20");
  });

  test("EITHER bound missing → naText (matches CellRange; not a partial bound)", () => {
    // Was "missing min returns max only" (returned "20") — a DOM↔export
    // divergence: the DOM shows naText whenever either bound is missing.
    const mk = (row: Record<string, unknown>) =>
      call("range", null, { range: { minField: "lo", maxField: "hi", decimals: 0 } },
        { cellWidth: 0, rowHeight: 0, row, target: "svg", naText: "n/a" });
    expect(mk({ lo: null, hi: 20 })).toBe("n/a");
    expect(mk({ lo: 10, hi: null })).toBe("n/a");
  });

  test("both null returns empty", () => {
    const out = call(
      "range",
      null,
      { range: { minField: "lo", maxField: "hi" } },
      { cellWidth: 0, rowHeight: 0, row: { lo: null, hi: null }, target: "svg" },
    );
    expect(out).toBe("");
  });
});

describe("Phase 4a — img svg renderer", () => {
  test("emits custom fallback string", () => {
    expect(call("img", "https://x.png", { img: { fallback: "[picture]" } })).toBe("[picture]");
  });

  test("default fallback is [IMG]", () => {
    expect(call("img", "https://x.png", {})).toBe("[IMG]");
  });
});

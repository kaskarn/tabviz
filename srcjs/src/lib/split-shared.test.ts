import { describe, test, expect } from "bun:test";
import { computeSharedAxis, computeSharedWidths, type SubsetSpec } from "./split-shared";

function makeSubset(rows: Array<Record<string, unknown>>, overrides?: Partial<SubsetSpec>): SubsetSpec {
  // Pivot row-major test fixtures into the column-major wire shape.
  const fields = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) fields.add(k);
  const columns: Record<string, unknown[]> = {};
  for (const f of fields) columns[f] = rows.map((r) => r[f] ?? null);
  return {
    data: { columns },
    columns: [
      { id: "label",    type: "text",    field: "label",  header: "Study", width: "auto" },
      { id: "n",        type: "numeric", field: "n",      header: "N",     width: "auto" },
      { id: "hr",       type: "numeric", field: "hr",     header: "HR",    width: "auto" },
      { id: "forest",   type: "forest",  field: "hr",     header: "",      width: 300,
        options: { forest: { point: "hr", lower: "lower", upper: "upper", scale: "linear", nullValue: 0 } } },
    ],
    theme: { axis: { ciClipFactor: 3.0 } },
    ...overrides,
  };
}

describe("computeSharedAxis", () => {
  test("empty subsets returns a sensible default", () => {
    const out = computeSharedAxis({ subsets: [] });
    expect(out.rangeMin).toBe(0);
    expect(out.rangeMax).toBe(1);
  });

  test("spans union of subsets' point estimates", () => {
    const a = makeSubset([
      { label: "a1", hr: 0.5, lower: 0.4, upper: 0.6 },
      { label: "a2", hr: 0.7, lower: 0.55, upper: 0.85 },
    ]);
    const b = makeSubset([
      { label: "b1", hr: 1.1, lower: 0.9, upper: 1.3 },
      { label: "b2", hr: 1.5, lower: 1.2, upper: 1.8 },
    ]);
    const out = computeSharedAxis({ subsets: [a, b] });
    // Union point estimates: 0.5 .. 1.5; range expands to include CIs and
    // is then nice-rounded. min must be <= 0.4, max must be >= 1.8.
    expect(out.rangeMin).toBeLessThanOrEqual(0.4);
    expect(out.rangeMax).toBeGreaterThanOrEqual(1.8);
  });

  test("ignores subsets with no effect data (NA-only)", () => {
    const a = makeSubset([{ label: "a1", hr: 1.0, lower: 0.8, upper: 1.2 }]);
    const b = makeSubset([{ label: "b1", hr: null, lower: null, upper: null }]);
    const out = computeSharedAxis({ subsets: [a, b] });
    expect(Number.isFinite(out.rangeMin)).toBe(true);
    expect(Number.isFinite(out.rangeMax)).toBe(true);
    expect(out.rangeMin).toBeLessThanOrEqual(0.8);
    expect(out.rangeMax).toBeGreaterThanOrEqual(1.2);
  });

  test("log-scale: positive values only, multiplicative spread", () => {
    const a = makeSubset([{ label: "a1", hr: 0.5, lower: 0.3, upper: 0.8 }], {
      columns: [
        { id: "forest", type: "forest", field: "hr", header: "", width: 300,
          options: { forest: { point: "hr", lower: "lower", upper: "upper", scale: "log", nullValue: 1 } } },
      ],
    });
    const out = computeSharedAxis({ subsets: [a] });
    expect(out.rangeMin).toBeGreaterThan(0); // log domain must stay positive
    expect(out.rangeMax).toBeGreaterThan(out.rangeMin);
  });
});

describe("computeSharedWidths", () => {
  test("returns a width per auto-width text/numeric column", () => {
    const a = makeSubset([
      { label: "Alpha", n: 100, hr: 1.0, lower: 0.5, upper: 1.5 },
      { label: "Beta",  n: 200, hr: 1.1, lower: 0.6, upper: 1.6 },
    ]);
    const b = makeSubset([
      { label: "Gamma",       n: 300,    hr: 1.2, lower: 0.7, upper: 1.7 },
      { label: "Delta (long)", n: 250000, hr: 1.3, lower: 0.8, upper: 1.8 },
    ]);
    const out = computeSharedWidths({ subsets: [a, b] });
    // Only "auto" non-viz columns get a width; forest column (numeric width)
    // is skipped.
    expect(Object.keys(out.widths).sort()).toEqual(["hr", "label", "n"]);
    // All widths are reasonable positive numbers within the floor/ceiling.
    for (const w of Object.values(out.widths)) {
      expect(w).toBeGreaterThanOrEqual(40);
      expect(w).toBeLessThanOrEqual(480);
    }
    // "label" should be wider than "hr" (longer strings).
    expect(out.widths.label).toBeGreaterThan(out.widths.hr);
  });

  test("skips columns with explicit numeric width", () => {
    const a = makeSubset([{ label: "x", n: 1, hr: 1, lower: 0.5, upper: 1.5 }], {
      columns: [
        { id: "label", type: "text", field: "label", header: "Study", width: 200 },
        { id: "n",     type: "numeric", field: "n", header: "N",      width: "auto" },
      ],
    });
    const out = computeSharedWidths({ subsets: [a] });
    expect(out.widths.label).toBeUndefined();
    expect(out.widths.n).toBeDefined();
  });

  test("union determines width — longer string in subset B wins", () => {
    const a = makeSubset([{ label: "a", n: 1, hr: 1, lower: 0.5, upper: 1.5 }]);
    const b = makeSubset([{ label: "Some quite long label", n: 1, hr: 1, lower: 0.5, upper: 1.5 }]);
    const onlyA = computeSharedWidths({ subsets: [a] });
    const both  = computeSharedWidths({ subsets: [a, b] });
    expect(both.widths.label).toBeGreaterThan(onlyA.widths.label);
  });

  test("empty subsets returns no widths", () => {
    const out = computeSharedWidths({ subsets: [] });
    expect(out.widths).toEqual({});
  });
});

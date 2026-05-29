import { describe, test, expect, beforeAll } from "bun:test";
import { computeLayoutMetrics } from "./svg-generator";
import { sizingFixtures } from "./sizing-fixtures";
import { bootBuiltinBehaviors } from "../schema/init";

/**
 * Sizing regression gate.
 *
 * Snapshots the SVG/V8-path layout metrics for every fixture in the sizing
 * matrix. A refactor that changes any computed dimension surfaces as a clean
 * numeric diff — the protection the RowKind + computeTableMetrics work needs.
 *
 * Runs under bun (fixtures use stub themes, no @stdlib/oklch — see
 * sizing-fixtures.ts). Rounded to 3dp: estimateTextWidth is deterministic
 * arithmetic, so 3dp is well below real drift but absorbs float noise.
 *
 * Regenerate snapshots: bun test src/export/layout-metrics.test.ts --update-snapshots
 * See docs/dev/sizing-model.md §6b.
 */

beforeAll(() => bootBuiltinBehaviors());

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function roundMetrics(m: unknown): unknown {
  if (typeof m === "number") return round(m);
  if (Array.isArray(m)) return m.map(roundMetrics);
  if (m && typeof m === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) out[k] = roundMetrics(v);
    return out;
  }
  return m;
}

describe("layout metrics (sizing harness)", () => {
  const fixtures = sizingFixtures();

  test("produces a fixture for every matrix entry", () => {
    expect(fixtures.length).toBeGreaterThan(10);
  });

  for (const { name, spec } of fixtures) {
    test(`metrics: ${name}`, () => {
      const metrics = roundMetrics(computeLayoutMetrics(spec));
      expect(metrics).toMatchSnapshot();
    });
  }

  // Invariants that encode the box-model contract directly — they catch
  // regressions even before a snapshot is reviewed.
  describe("invariants", () => {
    const byName = new Map(fixtures.map((f) => [f.name, f]));

    test("density monotonicity: compact < comfortable < spacious rowHeight", () => {
      const h = (n: string) =>
        computeLayoutMetrics(byName.get(n)!.spec).spacing.rowHeight;
      expect(h("density-compact-flat")).toBeLessThan(h("density-comfortable-flat"));
      expect(h("density-comfortable-flat")).toBeLessThan(h("density-spacious-flat"));
    });

    test("spacer rows are shorter than data rows", () => {
      const m = computeLayoutMetrics(byName.get("spacers")!.spec);
      const spacer = m.rows.find((r) => r.kind === "spacer")!;
      const data = m.rows.find((r) => r.kind === "data")!;
      expect(spacer.height).toBeLessThan(data.height);
    });

    test("wrapping inflates at least one row past the base row height", () => {
      const m = computeLayoutMetrics(byName.get("wrap-comfortable")!.spec);
      const tallest = Math.max(...m.rows.map((r) => r.height));
      expect(tallest).toBeGreaterThan(m.spacing.rowHeight);
    });

    test("rowPositions are monotonic non-decreasing (no overlap)", () => {
      for (const { spec } of fixtures) {
        const m = computeLayoutMetrics(spec);
        for (let i = 1; i < m.rows.length; i++) {
          expect(m.rows[i].top).toBeGreaterThanOrEqual(m.rows[i - 1].top);
        }
      }
    });

    test("every column has positive width", () => {
      for (const { spec } of fixtures) {
        const m = computeLayoutMetrics(spec);
        for (const c of m.columns) expect(c.width).toBeGreaterThan(0);
      }
    });
  });
});

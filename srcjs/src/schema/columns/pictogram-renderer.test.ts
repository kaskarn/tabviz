// Tests for the pictogram cell renderer's DOM slot.
//
// The DOM slot returns a RenderComponent escape hatch that mounts the
// existing CellPictogram.svelte. The SVG slot was wired in
// schema-sprint Phase 4b.5 and is covered by
// pictogram-svg-renderer.test.ts — this file keeps the DOM-side
// regressions isolated.

import { describe, test, expect, beforeEach } from "bun:test";
import { renderCell } from "../dispatch";
import { getCellComponent } from "../../components/render-component-registry";
import { bootBuiltinBehaviors } from "../init";
import { bootDomRenderers } from "../init-dom";
import type { ColumnSpec } from "../../types";
import type { RenderComponent } from "../render-types";
import "../init-dom";

// Earlier test files (banks.test, extend.test) wipe runtime
// registries via `__resetRuntimeRegistries()` in their beforeEach.
// That clobbers the registration init-dom did on module load, so
// re-boot here so the dispatcher finds the pictogram dom renderer.
beforeEach(() => {
  bootBuiltinBehaviors();
  bootDomRenderers();
});

const col = (options: Record<string, unknown>): ColumnSpec =>
  ({
    id: "p", header: "P", field: "v", type: "pictogram",
    align: "left", sortable: false, isGroup: false, width: "auto", options,
  }) as unknown as ColumnSpec;

const ctx = (row: Record<string, unknown>) =>
  ({ cellWidth: 100, rowHeight: 20, row, target: "browser" as const });

describe("pictogram renderer — dom slot", () => {
  test("returns a RenderComponent node pointing at CellPictogram", () => {
    const c = col({ pictogram: { size: "base", layout: "row" } });
    const out = renderCell(c, 3, ctx({ v: 3 }), undefined, "dom") as RenderComponent;
    expect(out).not.toBeNull();
    expect(out.kind).toBe("component");
    expect(out.name).toBe("CellPictogram");
  });

  test("forwards value + pictogram options to component props", () => {
    const opts = { pictogram: { size: "lg", layout: "row", maxGlyphs: 5 } };
    const c = col(opts);
    const out = renderCell(c, 4, ctx({ v: 4 }), undefined, "dom") as RenderComponent;
    expect(out.props.value).toBe(4);
    expect(out.props.options).toEqual(opts.pictogram);
  });

  test("reads glyphSelector from row via glyphField", () => {
    const c = col({ pictogram: { glyph: { good: "leaf", bad: "skull" }, glyphField: "kind", layout: "row" } });
    const out = renderCell(c, 3, ctx({ v: 3, kind: "good" }), undefined, "dom") as RenderComponent;
    expect(out.props.glyphSelector).toBe("good");
  });

  test("glyphSelector is null when no glyphField is configured", () => {
    const c = col({ pictogram: { glyph: "star", layout: "row" } });
    const out = renderCell(c, 3, ctx({ v: 3 }), undefined, "dom") as RenderComponent;
    expect(out.props.glyphSelector).toBeNull();
  });
});

// SVG slot moved to pictogram-svg-renderer.test.ts (Phase 4b.5).

describe("pictogram renderer — component registration", () => {
  test("CellPictogram resolves via the component registry", () => {
    expect(getCellComponent("CellPictogram")).toBeDefined();
  });
});

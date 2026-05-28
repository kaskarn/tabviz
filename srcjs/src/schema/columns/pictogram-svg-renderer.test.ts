// Tests for the pictogram SVG renderer (schema-sprint Phase 4b.5).
//
// The dom slot still mounts CellPictogram.svelte; tests for that path
// live in pictogram-renderer.test.ts (existing). This file covers the
// new svg slot only.

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { THEME_PRESETS } from "../../lib/theme-presets";
import { __testing } from "./pictogram-renderer";
import type { RenderSvg, RenderContext } from "../render-types";
import "../init";

const { buildSlots, applyDomainRemap, resolveGlyphSpec, buildLabelText } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
});

const theme = THEME_PRESETS.bmj;

function callPicto(value: unknown, options: Record<string, unknown> = {}, row: Record<string, unknown> = {}): RenderSvg {
  const fn = dispatchRenderer("pictogram", "svg");
  if (!fn) throw new Error("pictogram svg renderer not registered");
  const ctx: RenderContext = { cellWidth: 100, rowHeight: 24, row, target: "svg", theme };
  const node = fn(value, options, ctx);
  if (node.kind !== "svg") throw new Error(`expected svg, got ${node.kind}`);
  return node;
}

describe("pictogram renderer — domain remap", () => {
  test("no domain returns clamped value", () => {
    expect(applyDomainRemap(3.5, null, 5)).toBeCloseTo(3.5);
    expect(applyDomainRemap(-1, null, 5)).toBe(0);
  });

  test("domain remaps to 0..maxGlyphs", () => {
    expect(applyDomainRemap(50, [0, 100], 5)).toBeCloseTo(2.5);
  });

  test("no remap when maxGlyphs is null", () => {
    expect(applyDomainRemap(50, [0, 100], null)).toBe(50);
  });
});

describe("pictogram renderer — buildSlots", () => {
  test("rating mode (maxGlyphs set): full / empty / half", () => {
    const slots = buildSlots(2, 5, false);
    expect(slots).toEqual([
      { state: "full" }, { state: "full" }, { state: "empty" }, { state: "empty" }, { state: "empty" },
    ]);
  });

  test("rating mode with halfGlyphs", () => {
    const slots = buildSlots(2.5, 5, true);
    expect(slots[2]).toEqual({ state: "half" });
  });

  test("count mode (maxGlyphs=null) emits N full glyphs", () => {
    const slots = buildSlots(3, null, false);
    expect(slots.length).toBe(3);
    expect(slots.every((s) => s.state === "full")).toBe(true);
  });

  test("count mode with halfGlyphs rounds up at 0.5", () => {
    expect(buildSlots(2.5, null, true).length).toBe(3);
    expect(buildSlots(2.4, null, true).length).toBe(2);
  });

  test("count mode caps at 999", () => {
    expect(buildSlots(10000, null, false).length).toBe(999);
  });
});

describe("pictogram renderer — glyph selection", () => {
  test("string glyph spec passes through", () => {
    expect(resolveGlyphSpec({ glyph: "person" } as never, {})).toBe("person");
  });

  test("value-keyed map looks up via glyphField", () => {
    expect(resolveGlyphSpec(
      { glyph: { a: "leaf", b: "skull" }, glyphField: "kind" } as never,
      { kind: "b" },
    )).toBe("skull");
  });

  test("missing field returns null", () => {
    expect(resolveGlyphSpec({ glyph: { a: "leaf" }, glyphField: "kind" } as never, {})).toBe(null);
  });
});

describe("pictogram renderer — label text", () => {
  test("integer format rounds", () => {
    expect(buildLabelText(2.7, { labelFormat: "integer" } as never)).toBe("3");
  });

  test("default decimal format respects labelDecimals", () => {
    expect(buildLabelText(2.456, { labelDecimals: 2 } as never)).toBe("2.46");
  });
});

describe("pictogram renderer — markup", () => {
  test("emits N glyph svgs in rating mode", () => {
    const node = callPicto(2, { pictogram: { glyph: "person", maxGlyphs: 5 } });
    const inner = (node.markup.match(/<svg/g) ?? []).length;
    expect(inner).toBe(5);
  });

  test("trailing label appears after glyphs", () => {
    const node = callPicto(2, {
      pictogram: { glyph: "person", maxGlyphs: 5, valueLabel: true, labelFormat: "integer" },
    });
    expect(node.markup).toContain("<text");
    // The trailing label "2" appears as the last text node
    const texts = node.markup.match(/<text[^>]*>(.*?)<\/text>/g) ?? [];
    expect(texts[texts.length - 1]).toContain(">2<");
  });

  test("stack layout flips vertical", () => {
    const node = callPicto(2, { pictogram: { glyph: "person", maxGlyphs: 3, layout: "stack" } });
    // stack mode: width = single glyph, height = N * glyphPx
    expect(node.width).toBeLessThanOrEqual(node.height);
  });

  test("non-numeric emits empty", () => {
    expect(callPicto("xx").markup).toBe("");
  });

  test("missing glyph spec emits empty", () => {
    expect(callPicto(3, {}).markup).toBe("");
  });

  test("half-glyph emits a clipPath", () => {
    const node = callPicto(2.5, {
      pictogram: { glyph: "person", maxGlyphs: 5, halfGlyphs: true },
    });
    expect(node.markup).toContain("clipPath");
  });
});

describe("pictogram renderer — dispatch", () => {
  test("registered on the pictogram schema's svg slot", () => {
    expect(dispatchRenderer("pictogram", "svg")).toBeDefined();
  });
});

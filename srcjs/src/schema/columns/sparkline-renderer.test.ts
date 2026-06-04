// Tests for the sparkline SVG renderer (schema-sprint Phase 4b.7).

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { THEME_PRESETS } from "../../lib/theme/theme-presets";
import { __testing } from "./sparkline-renderer";
import type { RenderSvg, RenderContext } from "../render-types";
import "../init";

const { resolveSparkColor } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
});

const theme = THEME_PRESETS.bmj;

function callSpark(value: unknown, options: Record<string, unknown> = {}, cellWidth = 120): RenderSvg {
  const fn = dispatchRenderer("sparkline", "svg");
  if (!fn) throw new Error("sparkline svg renderer not registered");
  const ctx: RenderContext = { cellWidth, rowHeight: 24, row: {}, target: "svg", theme };
  const node = fn(value, options, ctx);
  if (node.kind !== "svg") throw new Error(`expected svg, got ${node.kind}`);
  return node;
}

describe("sparkline renderer — color resolution", () => {
  test("explicit color wins over theme defaults", () => {
    expect(resolveSparkColor({ color: "#abc" }, undefined, undefined, theme)).toBe("#abc");
  });

  test("falls back to brand accent (V4: theme.inputs.primary cascade dropped)", () => {
    expect(resolveSparkColor({}, undefined, undefined, theme)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("sparkline renderer — variants", () => {
  const data = [1, 3, 2, 4, 3, 5];

  test("line variant emits a <path> + end-dot circle", () => {
    const node = callSpark(data, { sparkline: { type: "line" } });
    expect(node.markup).toContain("<path");
    expect(node.markup).toContain("<circle");
  });

  test("area variant emits two <path>s (filled + curve)", () => {
    const node = callSpark(data, { sparkline: { type: "area" } });
    expect((node.markup.match(/<path/g) ?? []).length).toBe(2);
    expect(node.markup).toContain('opacity=');
  });

  test("bar variant emits one <rect> per sample", () => {
    const node = callSpark(data, { sparkline: { type: "bar" } });
    expect((node.markup.match(/<rect/g) ?? []).length).toBe(data.length);
  });

  test("default variant is line", () => {
    const node = callSpark(data, { sparkline: {} });
    expect(node.markup).toContain("<circle"); // end-dot is line-only
  });
});

describe("sparkline renderer — input handling", () => {
  test("nested array (number[][]) takes the first series", () => {
    const node = callSpark([[1, 2, 3], [4, 5, 6]], { sparkline: { type: "line" } });
    expect(node.markup).toContain("<path");
  });

  test("non-array value emits empty", () => {
    expect(callSpark(42).markup).toBe("");
    expect(callSpark(null).markup).toBe("");
  });

  test("empty data array emits empty markup but reserves dims", () => {
    const node = callSpark([]);
    expect(node.markup).toBe("");
    expect(node.height).toBe(16);
  });
});

describe("sparkline renderer — dispatch", () => {
  test("registered on the sparkline schema's svg slot", () => {
    expect(dispatchRenderer("sparkline", "svg")).toBeDefined();
  });
});

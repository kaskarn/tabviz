// Tests for the progress SVG renderer (schema-sprint Phase 4b.6).

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { THEME_PRESETS } from "../../lib/theme/theme-presets";
import { __testing } from "./progress-renderer";
import type { RenderSvg, RenderContext } from "../render-types";
import "../init";

const { resolveProgressColor, PROGRESS_BAR_HEIGHT } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
});

const theme = THEME_PRESETS.bmj;

function callProgress(value: unknown, options: Record<string, unknown> = {}, cellWidth = 120): RenderSvg {
  const fn = dispatchRenderer("progress", "svg");
  if (!fn) throw new Error("progress svg renderer not registered");
  const ctx: RenderContext = { cellWidth, rowHeight: 24, row: {}, target: "svg", theme };
  const node = fn(value, options, ctx);
  if (node.kind !== "svg") throw new Error(`expected svg, got ${node.kind}`);
  return node;
}

describe("progress renderer — color cascade", () => {
  test("explicit color wins", () => {
    expect(resolveProgressColor({ color: "#abc" }, undefined, undefined, theme)).toBe("#abc");
  });

  test("falls back to brand accent (V4: theme.inputs.primary cascade dropped)", () => {
    expect(resolveProgressColor({}, undefined, undefined, theme)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("progress renderer — markup", () => {
  test("emits track + fill rects + label", () => {
    const node = callProgress(75, { progress: { maxValue: 100, showLabel: true } });
    const rects = (node.markup.match(/<rect/g) ?? []).length;
    expect(rects).toBe(2);
    expect(node.markup).toContain("<text");
    expect(node.markup).toContain("75%");
  });

  test("showLabel:false drops the label and reclaims space", () => {
    const node = callProgress(50, { progress: { maxValue: 100, showLabel: false } });
    expect(node.markup).not.toContain("<text");
    expect((node.markup.match(/<rect/g) ?? []).length).toBe(2);
  });

  test("0 clamps to zero-width fill", () => {
    const node = callProgress(0, { progress: { maxValue: 100 } });
    expect(node.markup).toContain('width="0"');
  });

  test("over-max clamps to 100%", () => {
    const node = callProgress(150, { progress: { maxValue: 100 } });
    expect(node.markup).toContain("100%");
  });

  test("non-finite emits empty", () => {
    expect(callProgress("x").markup).toBe("");
    expect(callProgress(NaN).markup).toBe("");
  });

  test("height tracks PROGRESS_BAR_HEIGHT minimum", () => {
    const node = callProgress(50, { progress: { maxValue: 100, showLabel: false } });
    expect(node.height).toBeGreaterThanOrEqual(PROGRESS_BAR_HEIGHT);
  });
});

describe("progress renderer — dispatch", () => {
  test("registered on the progress schema's svg slot", () => {
    expect(dispatchRenderer("progress", "svg")).toBeDefined();
  });
});

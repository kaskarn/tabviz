// Tests for the heatmap renderer.

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { bootDomRenderers } from "../init-dom";
import { THEME_PRESETS } from "../../lib/theme/theme-presets";
import { __testing } from "./heatmap-renderer";
import type { RenderSvg, RenderComponent, RenderContext } from "../render-types";
import "../init-dom";

const { parseHex, interpolatePalette } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
  bootDomRenderers();
});

const theme = THEME_PRESETS.bmj;

function callDom(value: unknown, options: Record<string, unknown> = {}, ctx: Partial<RenderContext> = {}): RenderComponent {
  const fn = dispatchRenderer("heatmap", "dom");
  if (!fn) throw new Error("heatmap dom renderer not registered");
  const node = fn(value, options, { cellWidth: 100, rowHeight: 24, row: {}, target: "browser", theme, ...ctx });
  if (node.kind !== "component") throw new Error(`expected component, got ${node.kind}`);
  return node;
}

function callSvg(value: unknown, options: Record<string, unknown> = {}, ctx: Partial<RenderContext> = {}): RenderSvg {
  const fn = dispatchRenderer("heatmap", "svg");
  if (!fn) throw new Error("heatmap svg renderer not registered");
  const node = fn(value, options, { cellWidth: 100, rowHeight: 24, row: {}, target: "svg", theme, ...ctx });
  if (node.kind !== "svg") throw new Error(`expected svg, got ${node.kind}`);
  return node;
}

describe("heatmap renderer — palette + interpolation", () => {
  test("parseHex returns RGB triple", () => {
    expect(parseHex("#ff0000")).toEqual([255, 0, 0]);
    expect(parseHex("00ff00")).toEqual([0, 255, 0]);
  });

  test("interpolation at 0 returns first stop", () => {
    const { rgb } = interpolatePalette(["#000000", "#ffffff"], 0);
    expect(rgb).toEqual([0, 0, 0]);
  });

  test("interpolation at midpoint", () => {
    const { rgb } = interpolatePalette(["#000000", "#ffffff"], 0.5);
    // Midpoint of black→white is roughly mid-gray.
    expect(rgb[0]).toBeGreaterThanOrEqual(120);
    expect(rgb[0]).toBeLessThanOrEqual(135);
  });
});

describe("heatmap renderer — dom slot", () => {
  test("emits a RenderComponent mounting CellHeatmap", () => {
    const node = callDom(0.5, { heatmap: { minValue: 0, maxValue: 1 } });
    expect(node.name).toBe("CellHeatmap");
    expect(node.props.minValue).toBe(0);
    expect(node.props.maxValue).toBe(1);
  });

  test("reads ctx.columnSummary for min/max when absent", () => {
    const node = callDom(0.5, { heatmap: {} }, { columnSummary: { min: 0.1, max: 0.9 } });
    expect(node.props.minValue).toBe(0.1);
    expect(node.props.maxValue).toBe(0.9);
  });
});

describe("heatmap renderer — svg slot", () => {
  test("emits background rect + value text", () => {
    const node = callSvg(0.5, { heatmap: { minValue: 0, maxValue: 1, decimals: 2 } });
    expect(node.markup).toContain("<rect");
    expect(node.markup).toContain("<text");
    expect(node.markup).toContain(">0.50<");
  });

  test("showValue:false drops the label", () => {
    const node = callSvg(0.5, { heatmap: { minValue: 0, maxValue: 1, showValue: false } });
    expect(node.markup).not.toContain("<text");
  });

  test("non-finite emits empty", () => {
    expect(callSvg("xx").markup).toBe("");
    expect(callSvg(NaN).markup).toBe("");
  });

  test("uses ctx.columnSummary when options.min/max absent", () => {
    const node = callSvg(0.7, { heatmap: { decimals: 1 } }, { columnSummary: { min: 0, max: 1 } });
    expect(node.markup).toContain(">0.7<");
  });

  test("custom palette flows through", () => {
    const node = callSvg(1, {
      heatmap: { minValue: 0, maxValue: 1, palette: ["#ff0000", "#00ff00"], showValue: false },
    });
    // At 1.0 we should get the second stop (green).
    expect(node.markup).toContain("rgb(0,255,0)");
  });
});

describe("heatmap renderer — dispatch", () => {
  test("registered on the heatmap schema's dom + svg slots", () => {
    expect(dispatchRenderer("heatmap", "dom")).toBeDefined();
    expect(dispatchRenderer("heatmap", "svg")).toBeDefined();
  });
});

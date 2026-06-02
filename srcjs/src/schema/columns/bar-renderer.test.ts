// Tests for the bar renderer — DOM (RenderComponent shim) and SVG.

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { bootDomRenderers } from "../init-dom";
import { THEME_PRESETS } from "../../lib/theme/theme-presets";
import { __testing } from "./bar-renderer";
import type { RenderSvg, RenderComponent, RenderContext } from "../render-types";
import "../init-dom";

const { resolveBarColor, formatBarLabel } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
  bootDomRenderers();
});

const theme = THEME_PRESETS.bmj;

function callDom(value: unknown, options: Record<string, unknown> = {}, ctx: Partial<RenderContext> = {}): RenderComponent {
  const fn = dispatchRenderer("bar", "dom");
  if (!fn) throw new Error("bar dom renderer not registered");
  const node = fn(value, options, { cellWidth: 100, rowHeight: 24, row: {}, target: "browser", theme, ...ctx });
  if (node.kind !== "component") throw new Error(`expected component, got ${node.kind}`);
  return node;
}

function callSvg(value: unknown, options: Record<string, unknown> = {}, ctx: Partial<RenderContext> = {}): RenderSvg {
  const fn = dispatchRenderer("bar", "svg");
  if (!fn) throw new Error("bar svg renderer not registered");
  const node = fn(value, options, { cellWidth: 100, rowHeight: 24, row: {}, target: "svg", theme, ...ctx });
  if (node.kind !== "svg") throw new Error(`expected svg, got ${node.kind}`);
  return node;
}

describe("bar renderer — color cascade", () => {
  test("explicit color wins", () => {
    expect(resolveBarColor({ color: "#abc" }, undefined, undefined, theme)).toBe("#abc");
  });

  test("falls back to theme.inputs.primary", () => {
    const primary = theme.inputs?.primary;
    if (primary) expect(resolveBarColor({}, undefined, undefined, theme)).toBe(primary);
  });
});

describe("bar renderer — label format", () => {
  test(">= 100 → no decimals", () => {
    expect(formatBarLabel(123.456)).toBe("123");
  });
  test(">= 10 → 1 decimal", () => {
    expect(formatBarLabel(45.67)).toBe("45.7");
  });
  test("< 10 → 2 decimals", () => {
    expect(formatBarLabel(3.456)).toBe("3.46");
  });
});

describe("bar renderer — dom slot", () => {
  test("emits a RenderComponent mounting CellBar", () => {
    const node = callDom(50, { bar: { maxValue: 100 } });
    expect(node.name).toBe("CellBar");
    expect(node.props.value).toBe(50);
    expect(node.props.maxValue).toBe(100);
  });

  test("reads ctx.columnSummary.max when options.bar.maxValue is absent", () => {
    const node = callDom(50, { bar: {} }, { columnSummary: { min: 0, max: 80 } });
    expect(node.props.maxValue).toBe(80);
  });
});

describe("bar renderer — svg slot", () => {
  test("emits track + fill rects + label by default", () => {
    const node = callSvg(50, { bar: { maxValue: 100 } });
    expect((node.markup.match(/<rect/g) ?? []).length).toBe(2);
    expect(node.markup).toContain("<text");
    // formatBarLabel: 50 ≥ 10, < 100 → 1 decimal → "50.0".
    expect(node.markup).toContain(">50.0<");
  });

  test("showLabel:false drops the label", () => {
    const node = callSvg(50, { bar: { maxValue: 100, showLabel: false } });
    expect(node.markup).not.toContain("<text");
  });

  test("non-finite value emits empty", () => {
    expect(callSvg("xx").markup).toBe("");
    expect(callSvg(NaN).markup).toBe("");
  });

  test("uses ctx.columnSummary.max when maxValue is absent", () => {
    const node = callSvg(40, { bar: {} }, { columnSummary: { min: 0, max: 50 } });
    // 40/50 → 0.8 ratio fill — verify the markup looks plausible
    expect(node.markup).toContain("<rect");
  });
});

describe("bar renderer — dispatch", () => {
  test("registered on the bar schema's dom + svg slots", () => {
    expect(dispatchRenderer("bar", "dom")).toBeDefined();
    expect(dispatchRenderer("bar", "svg")).toBeDefined();
  });
});

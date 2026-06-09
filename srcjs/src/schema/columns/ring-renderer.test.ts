// Tests for the ring SVG renderer (schema-sprint Phase 4b.4).

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { THEME_PRESETS } from "../../lib/theme/theme-presets";
import { __testing } from "./ring-renderer";
import type { RenderSvg, RenderContext } from "../render-types";
import "../init";

const { resolveFilledColor, formatLabel, DIAMETER } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
});

const theme = THEME_PRESETS.nejm;

function callRing(value: unknown, options: Record<string, unknown> = {}, ctx: Partial<RenderContext> = {}): RenderSvg {
  const fn = dispatchRenderer("ring", "svg");
  if (!fn) throw new Error("ring svg renderer not registered");
  const node = fn(value, options, { cellWidth: 100, rowHeight: 24, row: {}, target: "svg", theme, ...ctx });
  if (node.kind !== "svg") throw new Error(`expected svg, got ${node.kind}`);
  return node;
}

describe("ring renderer — label formatting", () => {
  test("percent format", () => {
    expect(formatLabel(50, 0.5, "percent", 0)).toBe("50%");
    expect(formatLabel(50, 0.5, "percent", 1)).toBe("50.0%");
  });

  test("integer format ignores decimals", () => {
    expect(formatLabel(42.7, 0, "integer", 2)).toBe("43");
  });

  test("decimal format uses decimals", () => {
    expect(formatLabel(42.7, 0, "decimal", 1)).toBe("42.7");
  });
});

describe("ring renderer — color resolution", () => {
  test("threshold buckets pick from stop palette", () => {
    const lo = resolveFilledColor(2, { thresholds: [5, 10] } as never, theme, undefined, undefined);
    const mid = resolveFilledColor(7, { thresholds: [5, 10] } as never, theme, undefined, undefined);
    const hi = resolveFilledColor(15, { thresholds: [5, 10] } as never, theme, undefined, undefined);
    expect(lo).toBe(theme.status?.positive ?? "");
    expect(mid).toBe(theme.status?.warning ?? "");
    expect(hi).toBe(theme.status?.negative ?? "");
  });

  test("explicit single-color option wins over default", () => {
    const c = resolveFilledColor(0.5, { color: "#abc" } as never, theme, undefined, undefined);
    expect(c).toBe("#abc");
  });

  test("array color of length 1 also applies", () => {
    const c = resolveFilledColor(0.5, { color: ["#xyz"] } as never, theme, undefined, undefined);
    expect(c).toBe("#xyz");
  });

  test("falls back to brand accent (V4: identity-secondary cascade dropped)", () => {
    const c = resolveFilledColor(0.5, {} as never, theme, undefined, undefined);
    expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("ring renderer — markup", () => {
  test("emits track circle + fill arc + label when fraction > 0", () => {
    const node = callRing(0.5, { ring: { minValue: 0, maxValue: 1, size: "base", showLabel: true } });
    expect(node.markup).toContain("<circle");
    expect(node.markup).toContain("stroke-dasharray=");
    expect(node.markup).toContain("<text");
    expect(node.markup).toContain("50%");
  });

  test("fraction = 0 skips the fill arc", () => {
    const node = callRing(0, { ring: { minValue: 0, maxValue: 1 } });
    // only the track circle, no dasharray arc
    expect(node.markup.match(/<circle/g)?.length).toBe(1);
  });

  test("showLabel:false omits the label", () => {
    const node = callRing(0.5, { ring: { minValue: 0, maxValue: 1, showLabel: false } });
    expect(node.markup).not.toContain("<text");
  });

  test("size maps to diameter", () => {
    const sm = callRing(0.5, { ring: { minValue: 0, maxValue: 1, size: "sm" } });
    expect(sm.height).toBe(DIAMETER.sm);
    const lg = callRing(0.5, { ring: { minValue: 0, maxValue: 1, size: "lg" } });
    expect(lg.height).toBe(DIAMETER.lg);
  });

  test("non-finite value emits empty", () => {
    expect(callRing("xx", { ring: { minValue: 0, maxValue: 1 } }).markup).toBe("");
    expect(callRing(NaN, { ring: { minValue: 0, maxValue: 1 } }).markup).toBe("");
  });

  test("missing options emits empty", () => {
    expect(callRing(0.5, {}).markup).toBe("");
  });
});

describe("ring renderer — dispatch", () => {
  test("registered on the ring schema's svg slot", () => {
    expect(dispatchRenderer("ring", "svg")).toBeDefined();
  });
});

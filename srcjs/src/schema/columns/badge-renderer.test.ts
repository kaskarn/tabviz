// Tests for the badge SVG renderer (schema-sprint Phase 4b.1).
//
// Coverage:
//   - color resolution: thresholds, customColors (record), variants,
//     paint-tool override, glyph default
//   - geometry: pill / circle / square width relationships
//   - markup: outline vs fill, escaped XML, font attributes
//   - dispatch: registered on the "badge" schema's svg slot

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { THEME_PRESETS } from "../../lib/theme/theme-presets";
import { __testing } from "./badge-renderer";
import type { RenderSvg, RenderContext } from "../render-types";
import "../init";

const { resolveBadgeColor, computeBadgeGeometry } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
});

// Use any concrete preset — color resolution + geometry depend only
// on the shape of the WebTheme, not its specific palette.
const theme = THEME_PRESETS.bmj;

function ctxWith(over: Partial<RenderContext> = {}): RenderContext {
  return {
    cellWidth: 100,
    rowHeight: 24,
    row: {},
    target: "svg",
    theme,
    ...over,
  };
}

function callBadge(value: unknown, options: Record<string, unknown> = {}, ctx?: Partial<RenderContext>): RenderSvg {
  const fn = dispatchRenderer("badge", "svg");
  if (!fn) throw new Error("badge svg renderer not registered");
  const node = fn(value, options, ctxWith(ctx));
  if (node.kind !== "svg") throw new Error(`expected svg node, got ${node.kind}`);
  return node;
}

describe("badge renderer — color resolution", () => {
  test("thresholds bucket numeric values into stops", () => {
    // 2 thresholds → 3 stops: positive/warning/negative status colors.
    const lowColor = resolveBadgeColor("1", 1, { thresholds: [5, 10] }, theme, undefined, undefined);
    const midColor = resolveBadgeColor("7", 7, { thresholds: [5, 10] }, theme, undefined, undefined);
    const highColor = resolveBadgeColor("15", 15, { thresholds: [5, 10] }, theme, undefined, undefined);
    expect(lowColor).toBe(theme.status?.positive ?? "");
    expect(midColor).toBe(theme.status?.warning ?? "");
    expect(highColor).toBe(theme.status?.negative ?? "");
  });

  test("customColors (record) keyed by string value", () => {
    const color = resolveBadgeColor(
      "active",
      "active",
      { colors: { active: "#0a0", inactive: "#a00" } },
      theme,
      undefined,
      undefined,
    );
    expect(color).toBe("#0a0");
  });

  test("variants resolve to BADGE_VARIANTS / status / accent", () => {
    const color = resolveBadgeColor(
      "ok",
      "ok",
      { variants: { ok: "success" } },
      theme,
      undefined,
      undefined,
    );
    // BADGE_VARIANTS.success
    expect(typeof color).toBe("string");
    expect(color.length).toBeGreaterThan(0);
  });

  test("falls back to brand accent when no rule matches (V4: decorative/secondary dropped)", () => {
    const color = resolveBadgeColor("X", "X", {}, theme, undefined, undefined);
    // V4: glyphDefault = readAccentDefault(cssVars). Just check we got a hex.
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("badge renderer — geometry", () => {
  test("pill shape: width is text+padding, height tracks fontSize", () => {
    const g = computeBadgeGeometry("hello", "pill", theme);
    expect(g.width).toBeGreaterThan(0);
    expect(g.height).toBeGreaterThan(0);
    // pill radius == height / 2
    expect(g.radius).toBeCloseTo(g.height / 2);
  });

  test("circle shape: 1:1 aspect (width >= height)", () => {
    const g = computeBadgeGeometry("1", "circle", theme);
    expect(g.width).toBeGreaterThanOrEqual(g.height);
  });

  test("square shape: small fixed corner radius", () => {
    const g = computeBadgeGeometry("1", "square", theme);
    expect(g.radius).toBe(3);
  });
});

describe("badge renderer — markup", () => {
  test("emits a single <rect> + <text>", () => {
    const node = callBadge("ok", { badge: { shape: "pill" } });
    expect(node.markup).toContain("<rect");
    expect(node.markup).toContain("<text");
    expect(node.markup).toContain(">ok<");
  });

  test("outline mode strokes instead of filling", () => {
    const node = callBadge("ok", { badge: { outline: true } });
    expect(node.markup).toContain('fill="none"');
    expect(node.markup).toContain("stroke=");
  });

  test("filled mode applies 0.15 opacity", () => {
    const node = callBadge("ok", { badge: { outline: false } });
    expect(node.markup).toContain('opacity="0.15"');
  });

  test("XML special characters in label are escaped", () => {
    const node = callBadge("a<b&c");
    expect(node.markup).toContain("a&lt;b&amp;c");
  });

  test("null value emits zero-dimension placeholder (with naText)", () => {
    const node = callBadge(null, {}, { naText: "—" });
    expect(node.width).toBe(0);
    expect(node.height).toBe(0);
    expect(node.markup).toBe("—");
  });
});

describe("badge renderer — dispatch", () => {
  test("registered on the badge schema's svg slot", () => {
    const fn = dispatchRenderer("badge", "svg");
    expect(fn).toBeDefined();
  });
});

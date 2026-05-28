// Tests for the icon SVG renderer (schema-sprint Phase 4b.2).

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { THEME_PRESETS } from "../../lib/theme-presets";
import { __testing } from "./icon-renderer";
import type { RenderSvg, RenderContext } from "../render-types";
import "../init";

const { resolveIconColor, resolveIconText, SIZE_PX } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
});

const theme = THEME_PRESETS.bmj;

function ctxWith(over: Partial<RenderContext> = {}): RenderContext {
  return { cellWidth: 100, rowHeight: 24, row: {}, target: "svg", theme, ...over };
}

function callIcon(value: unknown, options: Record<string, unknown> = {}, ctx?: Partial<RenderContext>): RenderSvg {
  const fn = dispatchRenderer("icon", "svg");
  if (!fn) throw new Error("icon svg renderer not registered");
  const node = fn(value, options, ctxWith(ctx));
  if (node.kind !== "svg") throw new Error(`expected svg, got ${node.kind}`);
  return node;
}

describe("icon renderer — text resolution", () => {
  test("mapping[value] takes precedence over raw value", () => {
    expect(resolveIconText("yes", { mapping: { yes: "✓", no: "✗" } }, null)).toBe("✓");
  });

  test("raw value renders verbatim when no mapping match", () => {
    expect(resolveIconText("★", undefined, null)).toBe("★");
  });

  test("null returns naText", () => {
    expect(resolveIconText(null, undefined, "—")).toBe("—");
  });

  test("empty string returns naText", () => {
    expect(resolveIconText("", undefined, "—")).toBe("—");
  });
});

describe("icon renderer — color cascade", () => {
  test("explicit color wins", () => {
    expect(resolveIconColor({ color: "#abcdef" }, undefined, undefined, theme)).toBe("#abcdef");
  });

  test("falls back to theme.inputs.primary", () => {
    const primary = theme.inputs?.primary;
    if (primary) expect(resolveIconColor({}, undefined, undefined, theme)).toBe(primary);
  });
});

describe("icon renderer — geometry", () => {
  test("size key maps to px (sm/base/lg/xl)", () => {
    expect(SIZE_PX.sm).toBe(12);
    expect(SIZE_PX.base).toBe(14);
    expect(SIZE_PX.lg).toBe(16);
    expect(SIZE_PX.xl).toBe(26);
  });
});

describe("icon renderer — markup", () => {
  test("emits a single <text> with the mapped glyph", () => {
    const node = callIcon("yes", { icon: { mapping: { yes: "✓" }, size: "lg" } });
    expect(node.markup).toContain("<text");
    expect(node.markup).toContain("✓");
    expect(node.markup).toContain('font-size="16px"');
  });

  test("escapes XML special characters", () => {
    const node = callIcon("&<>");
    expect(node.markup).toContain("&amp;&lt;&gt;");
  });

  test("null value emits zero-dimension placeholder", () => {
    const node = callIcon(null);
    expect(node.width).toBe(0);
    expect(node.height).toBe(0);
  });
});

describe("icon renderer — dispatch", () => {
  test("registered on the icon schema's svg slot", () => {
    expect(dispatchRenderer("icon", "svg")).toBeDefined();
  });
});

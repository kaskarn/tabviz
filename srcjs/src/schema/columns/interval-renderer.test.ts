// Tests for the interval cell renderer.
// Validates the tree shape + that it produces equivalent text to
// the legacy `formatInterval` string output. The two are joined
// in tests/ via a textOf() helper that walks the tree.

import { describe, test, expect } from "bun:test";
import { renderCell } from "../dispatch";
import type { ColumnSpec } from "../../types";
import type { RenderNode, RenderGroup, RenderText } from "../render-types";
import "../init";

const col = (options: Record<string, unknown>): ColumnSpec =>
  ({
    id: "x", header: "X", field: "point", type: "interval",
    align: "left", sortable: false, isGroup: false, width: "auto", options,
  }) as unknown as ColumnSpec;

const dispatch = (c: ColumnSpec, row: Record<string, unknown>, target: "dom" | "svg" = "dom") =>
  renderCell(c, row[c.field], { cellWidth: 100, rowHeight: 20, row, target: "browser" }, undefined, target);

function textOf(node: RenderNode | null): string {
  if (!node) return "";
  if (node.kind === "text") return (node as RenderText).value;
  if (node.kind === "group") return (node as RenderGroup).children.map(textOf).join("");
  return "";
}

describe("interval renderer — happy path", () => {
  test("formatted point + bracketed bounds", () => {
    const c = col({ interval: { point: "p", lower: "l", upper: "u", decimals: 2 } });
    const out = dispatch(c, { p: 0.85, l: 0.72, u: 0.99 });
    expect(textOf(out)).toBe("0.85 (0.72, 0.99)");
  });

  test("custom separator", () => {
    const c = col({ interval: { point: "p", lower: "l", upper: "u", decimals: 1, separator: "  " } });
    const out = dispatch(c, { p: 1.5, l: 1.2, u: 1.8 });
    expect(textOf(out)).toBe("1.5  (1.2, 1.8)");
  });

  test("bounds get the `interval-range` tag for theme targeting", () => {
    const c = col({ interval: { point: "p", lower: "l", upper: "u", decimals: 2 } });
    const out = dispatch(c, { p: 0.85, l: 0.72, u: 0.99 }) as RenderGroup;
    expect(out.kind).toBe("group");
    const bounds = out.children.find(
      (n): n is RenderGroup => n.kind === "group" && (n.tags ?? []).includes("interval-range"),
    );
    expect(bounds).toBeDefined();
    expect(textOf(bounds!)).toBe("(0.72, 0.99)");
  });
});

describe("interval renderer — edge cases", () => {
  test("missing point → naText", () => {
    const c = col({ interval: { point: "p", lower: "l", upper: "u" }, naText: "n/a" });
    const out = dispatch(c, { p: null, l: 1, u: 2 });
    expect(textOf(out)).toBe("n/a");
  });

  test("missing bounds → just the point", () => {
    const c = col({ interval: { point: "p", lower: "l", upper: "u", decimals: 2 } });
    const out = dispatch(c, { p: 0.85, l: null, u: null });
    expect(textOf(out)).toBe("0.85");
  });

  test("imprecise threshold tripped → em dash", () => {
    const c = col({ interval: { point: "p", lower: "l", upper: "u", impreciseThreshold: 5 } });
    const out = dispatch(c, { p: 1, l: 1, u: 10 });
    expect(textOf(out)).toBe("—");
  });
});

describe("interval renderer — runtime parity", () => {
  test("dom and svg dispatch return the same tree shape", () => {
    const c = col({ interval: { point: "p", lower: "l", upper: "u", decimals: 2 } });
    const domOut = dispatch(c, { p: 0.85, l: 0.72, u: 0.99 }, "dom");
    const svgOut = dispatch(c, { p: 0.85, l: 0.72, u: 0.99 }, "svg");
    expect(textOf(domOut)).toBe(textOf(svgOut));
    expect(JSON.stringify(domOut)).toBe(JSON.stringify(svgOut));
  });
});

describe("interval renderer — theme nodeRules overlay", () => {
  test("nodeRules['interval-range'] applies to the bounds subtree", () => {
    const c = col({ interval: { point: "p", lower: "l", upper: "u", decimals: 2 } });
    const out = renderCell(
      c, undefined,
      { cellWidth: 100, rowHeight: 20, row: { p: 0.85, l: 0.72, u: 0.99 }, target: "browser" },
      { "interval-range": { text: { size: "minor", color: "muted" } } },
    ) as RenderGroup;
    const bounds = out.children.find(
      (n): n is RenderGroup => n.kind === "group" && (n.tags ?? []).includes("interval-range"),
    )!;
    const innerText = bounds.children.find((n): n is RenderText => n.kind === "text" && n.value === "0.72")!;
    expect(innerText.style?.size).toBe("minor");
    expect(innerText.style?.color).toBe("muted");
  });
});

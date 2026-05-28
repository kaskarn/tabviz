// Tests for the RenderNode → SVG markup serializer.
// Snapshot-style: assert on the markup substrings + dimensions
// (exact whitespace varies and isn't what we're testing).

import { describe, test, expect } from "bun:test";
import { renderNodeToSvg } from "./render-svg";
import type { RenderNode, RenderText, RenderGroup } from "./render-types";

const text = (value: string, style?: RenderText["style"]): RenderText =>
  ({ kind: "text", value, ...(style ? { style } : {}) });

describe("renderNodeToSvg — text", () => {
  test("plain text emits a <text> element", () => {
    const out = renderNodeToSvg(text("hello"));
    expect(out.markup).toContain("<text");
    expect(out.markup).toContain(">hello</text>");
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  test("styles map to SVG attrs", () => {
    const out = renderNodeToSvg(text("hi", {
      size: 14, color: "#ff0000", weight: "bold", italic: true,
    }));
    expect(out.markup).toContain(`font-size="14"`);
    expect(out.markup).toContain(`fill="#ff0000"`);
    expect(out.markup).toContain(`font-weight="bold"`);
    expect(out.markup).toContain(`font-style="italic"`);
  });

  test("escapes HTML special chars in value", () => {
    const out = renderNodeToSvg(text("<x & y>"));
    expect(out.markup).toContain("&lt;x &amp; y&gt;");
    expect(out.markup).not.toContain("<x");
  });

  test("major/minor size tokens resolve via default resolver", () => {
    const major = renderNodeToSvg(text("M", { size: "major" }));
    const minor = renderNodeToSvg(text("m", { size: "minor" }));
    expect(major.markup).toContain(`font-size="14"`);
    expect(minor.markup).toContain(`font-size="10"`);
  });
});

describe("renderNodeToSvg — group layout", () => {
  test("row layout places children left-to-right with gap", () => {
    const g: RenderGroup = {
      kind: "group",
      layout: "row",
      gap: 4,
      children: [text("a"), text("b"), text("c")],
    };
    const out = renderNodeToSvg(g);
    const transforms = (out.markup.match(/translate\([\d\.]+ /g) ?? []).map((m) =>
      parseFloat(m.match(/[\d\.]+/)![0]),
    );
    expect(transforms).toHaveLength(3);
    expect(transforms[0]).toBe(0);
    expect(transforms[1]).toBeGreaterThan(transforms[0]);
    expect(transforms[2]).toBeGreaterThan(transforms[1]);
    // total width is at least 3 chars worth
    expect(out.width).toBeGreaterThan(15);
  });

  test("column layout stacks children top-to-bottom", () => {
    const g: RenderGroup = {
      kind: "group",
      layout: "column",
      gap: 2,
      children: [text("top"), text("bottom")],
    };
    const out = renderNodeToSvg(g);
    expect(out.height).toBeGreaterThan(20);
  });

  test("background renders a <rect> sized to the group", () => {
    const g: RenderGroup = {
      kind: "group",
      layout: "row",
      children: [text("x")],
      style: { bg: "#eef", borderRadius: 3 },
    };
    const out = renderNodeToSvg(g);
    expect(out.markup).toContain(`fill="#eef"`);
    expect(out.markup).toContain(`rx="3"`);
  });
});

describe("renderNodeToSvg — spacer / svg / image", () => {
  test("spacer occupies space but emits no markup", () => {
    const out = renderNodeToSvg({ kind: "spacer", size: 8 });
    expect(out.width).toBe(8);
    expect(out.height).toBe(8);
    expect(out.markup).toBe("");
  });

  test("svg passes through with declared dimensions", () => {
    const out = renderNodeToSvg({
      kind: "svg",
      markup: `<circle r="5"/>`,
      width: 20, height: 20,
    });
    expect(out.markup).toBe(`<circle r="5"/>`);
    expect(out.width).toBe(20);
  });

  test("image emits <image> with src + dims", () => {
    const out = renderNodeToSvg({
      kind: "image",
      src: "https://x.png",
      width: 40, height: 30, alt: "x",
    });
    expect(out.markup).toContain(`href="https://x.png"`);
    expect(out.markup).toContain(`width="40"`);
    expect(out.markup).toContain(`aria-label="x"`);
  });
});

describe("renderNodeToSvg — custom resolver", () => {
  test("resolver remaps color tokens to literal", () => {
    const out = renderNodeToSvg(text("x", { color: "muted" }), {
      color: (t) => t === "muted" ? "#888" : String(t),
    });
    expect(out.markup).toContain(`fill="#888"`);
  });

  test("resolver remaps size tokens to specific px", () => {
    const out = renderNodeToSvg(text("x", { size: "minor" }), {
      size: (t) => t === "minor" ? 9 : 12,
    });
    expect(out.markup).toContain(`font-size="9"`);
  });
});

describe("renderNodeToSvg — composition with applyTheme", () => {
  test("works on a tree that has been through theme finalization", async () => {
    const { applyTheme, tag } = await import("./theme-finalize");
    const node: RenderNode = tag({ kind: "text", value: "0.85" }, "minor") as RenderText;
    const tree = applyTheme(node, {
      minor: { text: { size: "minor", color: "muted" } },
    });
    const out = renderNodeToSvg(tree, {
      size: (t) => t === "minor" ? 9 : 12,
      color: (t) => t === "muted" ? "#888" : String(t),
    });
    expect(out.markup).toContain(`font-size="9"`);
    expect(out.markup).toContain(`fill="#888"`);
  });
});

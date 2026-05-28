import { describe, test, expect } from "bun:test";
import { applyTheme, tag, textTagged, type NodeRules } from "./theme-finalize";
import type { RenderNode, RenderText, RenderGroup } from "./render-types";

const text = (value: string): RenderText => ({ kind: "text", value });
const group = (children: RenderNode[]): RenderGroup => ({ kind: "group", children });

describe("applyTheme — passthrough cases", () => {
  test("no rules → tree unchanged", () => {
    const t = textTagged("hello", "label");
    expect(applyTheme(t, undefined)).toBe(t);
  });

  test("rules but no matching tags → tree unchanged", () => {
    const t = textTagged("hello", "label");
    const rules: NodeRules = { other: { text: { color: "muted" } } };
    expect(applyTheme(t, rules)).toEqual(t);
  });

  test("untagged nodes pass through", () => {
    const t = text("plain");
    const rules: NodeRules = { label: { text: { weight: "bold" } } };
    expect(applyTheme(t, rules)).toEqual(t);
  });
});

describe("applyTheme — text style overlays", () => {
  test("text rule applies to matched text node", () => {
    const t = textTagged("hi", "bold");
    const out = applyTheme(t, { bold: { text: { weight: "bold" } } }) as RenderText;
    expect(out.style?.weight).toBe("bold");
  });

  test("inline style wins over rule overlay (rule is a default)", () => {
    const t: RenderText = { kind: "text", value: "x", style: { color: "red" }, tags: ["muted"] };
    const out = applyTheme(t, { muted: { text: { color: "muted" } } }) as RenderText;
    expect(out.style?.color).toBe("red");
  });

  test("multiple tags layer; later overrides earlier", () => {
    const t = textTagged("hi", ["minor", "bold"]);
    const out = applyTheme(t, {
      minor: { text: { size: "minor", color: "muted" } },
      bold:  { text: { weight: "bold" } },
    }) as RenderText;
    expect(out.style?.size).toBe("minor");
    expect(out.style?.color).toBe("muted");
    expect(out.style?.weight).toBe("bold");
  });
});

describe("applyTheme — text overlay cascades into group descendants", () => {
  test("group tagged with text rule applies to every text child", () => {
    const g = tag(group([text("0.45"), text("0.91")]), "interval-range") as RenderGroup;
    const out = applyTheme(g, {
      "interval-range": { text: { size: "minor", color: "muted" } },
    }) as RenderGroup;
    for (const c of out.children) {
      if (c.kind === "text") {
        expect(c.style?.size).toBe("minor");
        expect(c.style?.color).toBe("muted");
      }
    }
  });

  test("nested groups also cascade", () => {
    const inner = group([text("inner")]);
    const outer = tag(group([inner]), "minor") as RenderGroup;
    const out = applyTheme(outer, { minor: { text: { size: "minor" } } }) as RenderGroup;
    const innerOut = out.children[0] as RenderGroup;
    const innerText = innerOut.children[0] as RenderText;
    expect(innerText.style?.size).toBe("minor");
  });
});

describe("applyTheme — hide / wrap / transform", () => {
  test("hidden: true replaces node with empty group", () => {
    const t = textTagged("secret", "hide-me");
    const out = applyTheme(t, { "hide-me": { hidden: true } });
    expect(out.kind).toBe("group");
    expect((out as RenderGroup).children).toEqual([]);
  });

  test("wrap: subscript adds a wrap:subscript tag", () => {
    const t = textTagged("x", "subscript-me");
    const out = applyTheme(t, { "subscript-me": { wrap: "subscript" } }) as RenderText;
    expect(out.tags).toContain("wrap:subscript");
  });

  test("transform: custom replaces node", () => {
    const t = textTagged("x", "do-thing");
    const out = applyTheme(t, {
      "do-thing": { transform: (n) => ({ ...n, value: "REPLACED" } as RenderText) },
    }) as RenderText;
    expect(out.value).toBe("REPLACED");
  });
});

describe("tag() / textTagged() helpers", () => {
  test("tag() adds without mutating", () => {
    const orig = text("x");
    const tagged = tag(orig, "label") as RenderText;
    expect(orig.tags).toBeUndefined();
    expect(tagged.tags).toEqual(["label"]);
  });

  test("tag() accepts an array", () => {
    const t = tag(text("x"), ["a", "b"]) as RenderText;
    expect(t.tags).toEqual(["a", "b"]);
  });

  test("tag() preserves existing tags", () => {
    const a = textTagged("x", "first");
    const b = tag(a, "second") as RenderText;
    expect(b.tags).toEqual(["first", "second"]);
  });

  test("textTagged() composes value + tags", () => {
    const t = textTagged("hi", "label");
    expect(t).toEqual({ kind: "text", value: "hi", tags: ["label"] });
  });
});

describe("applyTheme — real-world pattern", () => {
  test('interval cell with "interval-range" tag becomes muted', () => {
    // Renderer output: "0.65 (0.45–0.91)" with bounds tagged
    const tree: RenderGroup = {
      kind: "group",
      children: [
        textTagged("0.65", "interval-point"),
        tag(group([text("0.45"), text("–"), text("0.91")]), "interval-range") as RenderGroup,
      ],
    };

    const theme: NodeRules = {
      "interval-range": { text: { size: "minor", color: "muted" } },
    };

    const out = applyTheme(tree, theme) as RenderGroup;
    const point = out.children[0] as RenderText;
    const range = out.children[1] as RenderGroup;
    // Point unchanged
    expect(point.style).toBeUndefined();
    // Bounds inside range got the overlay
    for (const child of range.children) {
      if (child.kind === "text") {
        expect(child.style?.size).toBe("minor");
        expect(child.style?.color).toBe("muted");
      }
    }
  });
});

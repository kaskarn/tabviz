// Tests for the compose() layout combinator.

import { describe, test, expect } from "bun:test";
import { compose } from "./compose";
import type { RenderText, RenderNode, RenderGroup } from "./render-types";

const t = (value: string): RenderText => ({ kind: "text", value });

function textValues(node: RenderNode): string[] {
  if (node.kind === "text") return [node.value];
  if (node.kind === "group") return node.children.flatMap(textValues);
  return [];
}

describe("compose() — basic interleave", () => {
  test("single node → group with that one child", () => {
    const g = compose(t("hi"));
    expect(g.kind).toBe("group");
    expect(textValues(g)).toEqual(["hi"]);
  });

  test("default separator is a single space", () => {
    expect(textValues(compose(t("a"), t("b"), t("c")))).toEqual(
      ["a", " ", "b", " ", "c"],
    );
  });

  test("custom separator", () => {
    expect(textValues(compose(t("a"), t("b"), t("c"), { sep: ", " }))).toEqual(
      ["a", ", ", "b", ", ", "c"],
    );
  });

  test("empty input → empty group", () => {
    expect((compose() as RenderGroup).children).toEqual([]);
  });
});

describe("compose() — bracketing", () => {
  test("bracketStart=2 wraps everything from index 2 onwards", () => {
    // compose(a, b, c, { sep: ", ", bracketStart: 2 }) → a (b, c)
    expect(textValues(compose(t("a"), t("b"), t("c"), { sep: ", ", bracketStart: 2 }))).toEqual(
      ["a", " ", "(", "b", ", ", "c", ")"],
    );
  });

  test("bracketStart=1 wraps everything", () => {
    expect(textValues(compose(t("a"), t("b"), { sep: ", ", bracketStart: 1 }))).toEqual(
      ["(", "a", ", ", "b", ")"],
    );
  });

  test("bracketStart with one node beyond → still gets parens", () => {
    expect(textValues(compose(t("a"), t("b"), { bracketStart: 2 }))).toEqual(
      ["a", " ", "(", "b", ")"],
    );
  });
});

describe("compose() — minor styling overlay", () => {
  function nthText(g: RenderGroup, n: number): RenderText {
    let count = -1;
    function find(node: RenderNode): RenderText | null {
      if (node.kind === "text") {
        count++;
        if (count === n) return node;
        return null;
      }
      if (node.kind === "group") {
        for (const c of node.children) {
          const found = find(c);
          if (found) return found;
        }
      }
      return null;
    }
    const r = find(g);
    if (!r) throw new Error(`No text at index ${n}`);
    return r;
  }

  test("minor=2 styles the 2nd content node as minor (small + muted)", () => {
    // compose(a, b, { sep: " ± ", minor: 2 }) → "a ± b" with b minor
    const g = compose(t("a"), t("b"), { sep: " ± ", minor: 2 });
    const aText = nthText(g, 0);
    const bText = nthText(g, 2);  // index 1 is the separator
    expect(aText.style).toBeUndefined();   // first node untouched
    expect(bText.style?.size).toBe("minor");
    expect(bText.style?.color).toBe("muted");
  });

  test("minor=1 styles all nodes minor", () => {
    const g = compose(t("a"), t("b"), { minor: 1 });
    expect(nthText(g, 0).style?.size).toBe("minor");
    expect(nthText(g, 2).style?.size).toBe("minor");
  });

  test("minor + bracketStart combine", () => {
    // compose(point, lower, upper, { sep: ", ", bracketStart: 2, minor: 2 })
    // → "point (lower, upper)" with lower/upper minor styled
    const g = compose(t("point"), t("lower"), t("upper"), {
      sep: ", ",
      bracketStart: 2,
      minor: 2,
    });
    expect(textValues(g)).toEqual(["point", " ", "(", "lower", ", ", "upper", ")"]);
    // Index 0 "point" — unstyled (minor=2 means index >= 1, so 0 is skipped)
    // Index 1 " "    — separator between before-group and bracket: unstyled
    // Index 2 "("    — bracket: unstyled
    // Index 3 "lower" — content, was styled by `minor`
    // Index 4 ", "   — separator inside bracket: unstyled
    // Index 5 "upper" — content, was styled by `minor`
    // Index 6 ")"    — bracket: unstyled
    expect(nthText(g, 0).style).toBeUndefined();
    expect(nthText(g, 3).style?.size).toBe("minor");
    expect(nthText(g, 5).style?.size).toBe("minor");
  });
});

describe("compose() — real-world patterns", () => {
  test('point-estimate with CI: "0.85 (0.72, 0.99)"', () => {
    const g = compose(t("0.85"), t("0.72"), t("0.99"), {
      sep: ", ",
      bracketStart: 2,
    });
    expect(textValues(g).join("")).toBe("0.85 (0.72, 0.99)");
  });

  test('point ± SD with minor SD: "12.4 ± 0.3"', () => {
    const g = compose(t("12.4"), t("0.3"), { sep: " ± ", minor: 2 });
    expect(textValues(g).join("")).toBe("12.4 ± 0.3");
  });

  test("ring + percent label: ring SVG + text", () => {
    const ring: RenderNode = { kind: "svg", markup: "<circle/>", width: 24, height: 24 };
    const label: RenderText = { kind: "text", value: "42%" };
    const g = compose(ring, label, { sep: "" });
    expect(g.children.some((c) => c.kind === "svg")).toBe(true);
    expect(g.children.some((c) => c.kind === "text" && c.value === "42%")).toBe(true);
  });
});

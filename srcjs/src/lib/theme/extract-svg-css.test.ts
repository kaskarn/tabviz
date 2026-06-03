// Validates the SVG-CSS extractor strips sv-omit blocks correctly.

import { describe, it, expect } from "bun:test";
import { extractSvgCss } from "./extract-svg-css";
// @ts-expect-error — `?raw` import is a Vite/bun convention.
import runtimeCss from "./theme-runtime.css?raw";

describe("extractSvgCss", () => {
  it("strips a single sv-omit block", () => {
    const input = `
.foo { color: red; }
/* sv-omit-begin */
.bar:hover { color: blue; }
/* sv-omit-end */
.baz { color: green; }
`;
    const out = extractSvgCss(input);
    expect(out).toContain(".foo");
    expect(out).toContain(".baz");
    expect(out).not.toContain(".bar:hover");
    expect(out).not.toContain("sv-omit-begin");
    expect(out).not.toContain("sv-omit-end");
  });

  it("strips multiple sv-omit blocks", () => {
    const input = `
.a {}
/* sv-omit-begin */
.b1 {}
/* sv-omit-end */
.c {}
/* sv-omit-begin */
.b2 {}
/* sv-omit-end */
.d {}
`;
    const out = extractSvgCss(input);
    expect(out).toContain(".a");
    expect(out).toContain(".c");
    expect(out).toContain(".d");
    expect(out).not.toContain(".b1");
    expect(out).not.toContain(".b2");
  });

  it("leaves source without sv-omit markers unchanged", () => {
    const input = `.x { color: red; }\n.y { color: blue; }`;
    expect(extractSvgCss(input)).toBe(input);
  });

  it("leaves unmatched markers (open without close) unchanged", () => {
    const input = `.a {} /* sv-omit-begin */ .b {}`;
    expect(extractSvgCss(input)).toBe(input);
  });

  it("leaves unmatched markers (close without open) unchanged", () => {
    const input = `.a {} /* sv-omit-end */ .b {}`;
    expect(extractSvgCss(input)).toBe(input);
  });

  it("handles whitespace variations in marker comments", () => {
    const input = `
/*sv-omit-begin*/
.a {}
/*  sv-omit-end  */
`;
    const out = extractSvgCss(input);
    expect(out).not.toContain(".a");
  });

  it("strips the browser-only block in theme-runtime.css", () => {
    const out = extractSvgCss(runtimeCss as string);
    // The sv-omit markers should be gone from the extracted output
    expect(out).not.toContain("sv-omit-begin");
    expect(out).not.toContain("sv-omit-end");
    // The .tabviz-scope reset rules outside the markers should remain
    expect(out).toContain(".tabviz-scope");
    // The :hover rule that lives inside the markers should be gone
    expect(out).not.toContain(":hover");
  });
});

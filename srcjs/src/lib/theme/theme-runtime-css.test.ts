// Verify theme-runtime.css can be imported as a raw string via the Vite/bun
// `?raw` query. This is the load-bearing import for the SVG-export consumer
// (Stage 1 §18c — build-time string bundling, no runtime fs dependency).

import { describe, it, expect } from "bun:test";
// @ts-expect-error — `?raw` import is a Vite/bun convention; not a standard
// TS module declaration. The string contents are validated at runtime below.
import css from "./theme-runtime.css?raw";

describe("theme-runtime.css raw import", () => {
  it("imports as a non-empty string", () => {
    expect(typeof css).toBe("string");
    expect((css as string).length).toBeGreaterThan(0);
  });

  it("contains the .tabviz-scope root selector", () => {
    expect(css as string).toContain(".tabviz-scope");
  });

  it("contains the sv-omit-begin marker for SVG-export extraction", () => {
    expect(css as string).toContain("sv-omit-begin");
    expect(css as string).toContain("sv-omit-end");
  });

  it("contains all 11 scope-level data-* attribute selectors", () => {
    const scopeAttrs = [
      "data-mode",
      "data-polarity",
      "data-head-style",
      "data-title-style",
      "data-rules",
      "data-frame",
      "data-density",
      "data-banding",
      "data-first-col-style",
      "data-shell-mode",
      "data-shell-texture",
    ];
    for (const attr of scopeAttrs) {
      expect(css as string).toContain(`[${attr}=`);
    }
  });

  it("contains the row-kind and row-token element-level selectors", () => {
    expect(css as string).toContain('data-row-kind="data"');
    expect(css as string).toContain('data-row-kind="summary"');
    expect(css as string).toContain('data-row-token="emphasis"');
  });
});

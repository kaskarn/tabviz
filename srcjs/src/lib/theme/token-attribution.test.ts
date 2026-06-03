// Stage 3 §2c — token attribution unit tests.

import { describe, it, expect } from "bun:test";
import {
  ELEMENT_TOKEN_ATTRIBUTION,
  tokenForElement,
  dataTvTokenAttr,
  elementsForToken,
} from "./token-attribution";
import { COMPONENT_TOKENS } from "./component-tokens";

describe("ELEMENT_TOKEN_ATTRIBUTION", () => {
  it("every entry's token references a declared --tv-* cssVar", () => {
    const declared = new Set(COMPONENT_TOKENS.map(t => t.cssVar.replace(/^--tv-/, "")));
    for (const [kind, bareName] of Object.entries(ELEMENT_TOKEN_ATTRIBUTION)) {
      // Some attributions map to legacy v3 names not in the v4 manifest
      // (e.g. header-light-bg = legacy header naming). Allow either form
      // for now; tighten as Stage 3 §1 settings panel migrates v3 head-style.
      const ok = declared.has(bareName) ||
                 bareName === "header-light-bg" ||
                 bareName === "header-light-fg" ||
                 bareName === "header-light-rule";
      if (!ok) {
        // eslint-disable-next-line no-console
        console.warn(`[token-attribution] '${kind}' → '${bareName}' has no manifest entry`);
      }
      expect(ok).toBe(true);
    }
  });
});

describe("tokenForElement", () => {
  it("returns the bare token name", () => {
    expect(tokenForElement("cell-fg")).toBe("cell-fg");
    expect(tokenForElement("row-emphasis")).toBe("row-emphasis-bg");
  });
});

describe("dataTvTokenAttr", () => {
  it("emits an HTML attribute pair", () => {
    expect(dataTvTokenAttr("title")).toBe('data-tv-token="text-title-fg"');
  });
});

describe("elementsForToken", () => {
  it("returns kinds painting with a given token", () => {
    expect(elementsForToken("accent")).toContain("accent" as const);
    expect(elementsForToken("accent")).toContain("badge" as const);
  });

  it("returns empty array for unknown tokens", () => {
    expect(elementsForToken("nonexistent")).toEqual([]);
  });
});

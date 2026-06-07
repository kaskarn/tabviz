/**
 * control-contract.test.ts — the shared theme-controls dialect law
 * (settings-overhaul P1, design test DT-11 precursor).
 *
 * The shared controls are HOST-AGNOSTIC by construction: they receive
 * values + callbacks, never import a store, and never write theme paths
 * themselves. This source-text gate pins that — a control that imports
 * a store (or setThemeField) is the LayoutControl-mirror drift class
 * being reborn.
 *
 * Also pins the two new v2 primitives' API contracts (DisclosureField,
 * TextInput) in the spirit of primitive-contract.test.ts.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const HERE = path.resolve(__dirname);
const V2 = path.resolve(__dirname, "../primitives/v2");

function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

const CONTROL_FILES = readdirSync(HERE).filter((f) => f.endsWith(".svelte"));

describe("theme-controls host-agnosticism (DT-11 precursor)", () => {
  for (const file of CONTROL_FILES) {
    const src = stripHtmlComments(readFileSync(path.join(HERE, file), "utf8"));

    test(`${file} imports no store`, () => {
      expect(src).not.toMatch(/from\s+["'][^"']*stores\//);
      expect(src).not.toMatch(/\$stores\//);
    });

    test(`${file} writes no theme paths itself`, () => {
      expect(src).not.toMatch(/setThemeField|setAuthoringInputs|writeThemePath/);
    });

    test(`${file} composes only v2 primitives + lib (no --tp- dialect)`, () => {
      expect(src).not.toMatch(/--tp-/);
      expect(src).not.toMatch(/theme-panel\/controls/);
    });
  }

  test("AnchorRow exposes the compact/roomy layout contract", () => {
    const src = stripHtmlComments(
      readFileSync(path.join(HERE, "AnchorRow.svelte"), "utf8"),
    );
    // ControlLayout (index.ts) IS the "compact" | "roomy" union — wired
    // through as the single source (quality review).
    expect(src).toMatch(/layout\s*\?\s*:\s*(ControlLayout|"compact"\s*\|\s*"roomy")/);
    expect(src).toMatch(/oncommit\s*:/);
    expect(src).toMatch(/onpreview\s*\?\s*:/);
  });
});

describe("new v2 primitives API contract", () => {
  test("TextInput declares value via $bindable + oncommit", () => {
    const src = stripHtmlComments(readFileSync(path.join(V2, "TextInput.svelte"), "utf8"));
    expect(src).toMatch(/\bvalue\s*=\s*\$bindable\(/);
    expect(src).toMatch(/\boncommit\s*\?\s*:/);
    expect(src).toMatch(/oncommit\??\s*\.\s*\(/);
  });

  test("DisclosureField declares open via $bindable + summary", () => {
    const src = stripHtmlComments(readFileSync(path.join(V2, "DisclosureField.svelte"), "utf8"));
    expect(src).toMatch(/\bopen\s*=\s*\$bindable\(/);
    expect(src).toMatch(/\bsummary\s*\?\s*:/);
  });

  test("DisclosureField never nests itself (depth ≤ 1 law)", () => {
    // The component must not import or render another DisclosureField.
    const src = readFileSync(path.join(V2, "DisclosureField.svelte"), "utf8");
    expect(src).not.toMatch(/import\s+DisclosureField/);
  });
});

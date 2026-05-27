/**
 * primitive-contract.test.ts
 *
 * Asserts a uniform API contract across v2 value-bearing primitives:
 *  - every value-primitive declares `value` (via `$bindable`)
 *  - every value-primitive declares an explicit `onchange?:` prop
 *
 * The asymmetry that caused the 2026-05-25 dead-wire pile-up in
 * ColumnEditorV2 (Knob and Swatch had `$bindable` only; Pill / Picker
 * / Slider had explicit `onchange` — parents that didn't `bind:` got
 * silent failure) gets caught here as a unit test, BEFORE a primitive
 * lands without the contract.
 *
 * Paired with `scripts/check-primitive-wiring.mjs` which audits the
 * complementary side: every CALL site uses one of {onchange, bind:value}.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const HERE = path.resolve(__dirname);

const VALUE_PRIMITIVES = [
  "Knob.svelte",
  "Swatch.svelte",
  "Picker.svelte",
  "Pill.svelte",
  "Slider.svelte",
  "FontFamily.svelte",
  "Select.svelte",
];

// Strip HTML comments so example-syntax in docstrings doesn't confuse
// the regex audits below.
function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

describe("v2 value-primitive API contract", () => {
  for (const file of VALUE_PRIMITIVES) {
    const raw = readFileSync(path.join(HERE, file), "utf8");
    const src = stripHtmlComments(raw);

    test(`${file} declares value via \$bindable`, () => {
      // Svelte 5 destructuring: `value = $bindable(...)` in the
      // `let { ... }: Props = $props();` block.
      expect(src).toMatch(/\bvalue\s*=\s*\$bindable\(/);
    });

    test(`${file} declares an explicit onchange prop`, () => {
      // `onchange?: (...) => ...` appears somewhere in the script
      // (Props interface). HTML comments already stripped so docstring
      // examples can't match.
      expect(src).toMatch(/\bonchange\s*\?\s*:\s*\([\s\S]*?\)\s*=>/);
    });

    test(`${file} actually invokes onchange on user-action mutation`, () => {
      // The mutation sites must call onchange — otherwise the prop is
      // declared but dead. Conservative: verify `onchange?.(` (or `.(`)
      // appears somewhere in the script.
      expect(src).toMatch(/onchange\??\s*\.\s*\(/);
    });
  }
});

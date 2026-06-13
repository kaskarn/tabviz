import { test, expect } from "bun:test";
import { describedSegments, OPTION_DESCRIPTIONS } from "./option-descriptions";

test("describedSegments attaches the per-value title (the hover tooltip)", () => {
  const segs = describedSegments("border_preset", ["none", "hairline", "ruled", "frame", "boxed"]);
  expect(segs).toHaveLength(5);
  const ruled = segs.find((s) => s.value === "ruled")!;
  expect(ruled.label).toBe("ruled");
  expect(ruled.title).toBe(OPTION_DESCRIPTIONS.border_preset!.ruled);
  expect(ruled.title!.length).toBeGreaterThan(0);
});

test("values absent from the map carry no title (no tooltip, not a crash)", () => {
  const segs = describedSegments("border_preset", ["none", "made_up_value"]);
  expect(segs.find((s) => s.value === "made_up_value")!.title).toBeUndefined();
});

test("labelOf overrides the label but keeps the title", () => {
  const segs = describedSegments("glass", ["frosted"], (v) => v.toUpperCase());
  expect(segs[0]!.label).toBe("FROSTED");
  expect(segs[0]!.title).toBe(OPTION_DESCRIPTIONS.glass!.frosted);
});

// The overloaded `ruled` must read differently across vocabularies — the
// whole reason descriptions are keyed by vocabulary, not value.
test("'ruled' is disambiguated across border_preset vs shell_texture", () => {
  expect(OPTION_DESCRIPTIONS.border_preset!.ruled).not.toBe(OPTION_DESCRIPTIONS.shell_texture!.ruled);
  expect(OPTION_DESCRIPTIONS.border_preset!.ruled).toMatch(/rule/i);
  expect(OPTION_DESCRIPTIONS.shell_texture!.ruled).toMatch(/paper|lined/i);
});

// Every described value is a non-empty string (no half-authored entries).
test("all descriptions are non-empty", () => {
  for (const [vocab, values] of Object.entries(OPTION_DESCRIPTIONS)) {
    for (const [val, desc] of Object.entries(values)) {
      expect(desc.length, `${vocab}.${val}`).toBeGreaterThan(0);
    }
  }
});

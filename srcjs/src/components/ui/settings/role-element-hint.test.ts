import { test, expect } from "bun:test";
import { roleElementHint } from "./role-element-hint";

test("derives an element-mapping hint from the manifest for token-backed roles", () => {
  // border-subtle's first manifest token is the cell horizontal divider.
  expect(roleElementHint("border-subtle")).toMatch(/divider/i);
  // surface-subtle is the zebra/alt row background.
  expect(roleElementHint("surface-subtle")).toMatch(/row background|zebra/i);
});

test("strips the internal 'Mirrors role:' jargon tail", () => {
  const h = roleElementHint("text-subtle");
  expect(h).toBeTruthy();
  expect(h).not.toMatch(/Mirrors/);
});

test("curated overrides win for jargon-y / indirect roles", () => {
  expect(roleElementHint("accent")).toMatch(/emphasis|hover|callout/i);
  expect(roleElementHint("brand")).toMatch(/brand/i);
});

test("pattern fallback covers computed roles with no backing token", () => {
  expect(roleElementHint("series-3-fill")).toBe("Data series 3 fill color.");
  expect(roleElementHint("series-1-stroke")).toBe("Data series 1 stroke color.");
  expect(roleElementHint("warn-text")).toMatch(/warn text/i);
});

test("unknown role returns undefined (no hint, not a crash)", () => {
  expect(roleElementHint("totally-made-up")).toBeUndefined();
});

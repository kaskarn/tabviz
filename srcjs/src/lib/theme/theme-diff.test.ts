// Pure divergence/diff machinery shared by the studio snippet + the
// settings divergence badge (round-2 test-gap audit: the additive
// divergence formula had no gate, so a double-count or wrong-base
// regression would ship as a silent trust-eroding badge number).
import { describe, it, expect } from "bun:test";
import { recordDelta, computeDivergence } from "./theme-diff";
import { PRESETS } from "./theme-presets-inputs";

describe("recordDelta", () => {
  it("counts added, removed, and changed keys; ignores equal", () => {
    expect(recordDelta({}, {})).toBe(0);
    expect(recordDelta({ a: 1 }, {})).toBe(1);          // added
    expect(recordDelta({}, { a: 1 })).toBe(1);          // removed
    expect(recordDelta({ a: 1 }, { a: 2 })).toBe(1);    // changed
    expect(recordDelta({ a: 1 }, { a: 1 })).toBe(0);    // equal
    expect(recordDelta({ a: { x: 1 } }, { a: { x: 1 } })).toBe(0); // deep-equal value
    expect(recordDelta({ a: { x: 1 } }, { a: { x: 2 } })).toBe(1);
    expect(recordDelta(undefined, undefined)).toBe(0);
  });
});

describe("computeDivergence", () => {
  const base = PRESETS.cochrane;

  it("is 0 for an unedited loaded theme (no phantom edits)", () => {
    expect(computeDivergence(base, base, {}, {}, {}, {})).toBe(0);
  });

  it("counts a Tier-1 input edit", () => {
    const edited = { ...base, polarity: "dark" as const };
    expect(computeDivergence(base, edited, {}, {}, {}, {})).toBe(1);
  });

  it("an imported pinned theme shows 0 when live == loaded (flow F1)", () => {
    // Both initial and live carry the SAME pin → not a divergence.
    const pins = { "--tv-accent": "#abcdef" };
    expect(computeDivergence(base, base, {}, {}, pins, pins)).toBe(0);
  });

  it("counts a pin added relative to the loaded theme", () => {
    expect(computeDivergence(base, base, {}, {}, {}, { "--tv-accent": "#abcdef" })).toBe(1);
  });

  it("counts a role override cleared relative to the loaded theme", () => {
    const ro = { "text-muted": { ramp: "brand", grade: 8 } };
    expect(computeDivergence(base, base, ro, {}, {}, {})).toBe(1); // cleared
  });

  it("sums inputs + roles + pins", () => {
    const edited = { ...base, density: "spacious" as const };
    expect(computeDivergence(
      base, edited,
      {}, { "text-muted": { ramp: "brand", grade: 8 } },
      {}, { "--tv-accent": "#abc" },
    )).toBe(3);
  });

  it("returns 0 when either inputs side is missing", () => {
    expect(computeDivergence(undefined, base, {}, {}, {}, {})).toBe(0);
    expect(computeDivergence(base, undefined, {}, {}, {}, {})).toBe(0);
  });
});

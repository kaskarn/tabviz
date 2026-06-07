// Named-alias projection (theme-rework Wave 0): the reversible
// coordinate↔name layer the portable wire serializes through, with
// back-compat for the legacy coordinate-object form.
import { describe, it, expect } from "bun:test";
import {
  bindingToAlias, aliasToBinding, normalizeBinding,
  normalizeRoleOverrides, roleOverridesToAliases,
} from "./alias";

describe("bindingToAlias / aliasToBinding", () => {
  it("round-trips every ramp + a span of grades", () => {
    for (const ramp of ["neutral", "brand", "accent"] as const) {
      for (const grade of [1, 5, 8, 11]) {
        const alias = bindingToAlias({ ramp, grade });
        expect(alias).toBe(`${ramp}.${grade}`);
        expect(aliasToBinding(alias)).toEqual({ ramp, grade });
      }
    }
  });

  it("rejects malformed aliases", () => {
    expect(aliasToBinding("neutral")).toBeNull();      // no grade
    expect(aliasToBinding("plaid.5")).toBeNull();      // unknown ramp
    expect(aliasToBinding("neutral.0")).toBeNull();    // out of range
    expect(aliasToBinding("neutral.12")).toBeNull();
    expect(aliasToBinding("neutral.x")).toBeNull();
  });
});

describe("normalizeBinding — accepts both wire forms", () => {
  it("accepts the name alias and the legacy coordinate object", () => {
    expect(normalizeBinding("brand.7")).toEqual({ ramp: "brand", grade: 7 });
    expect(normalizeBinding({ ramp: "brand", grade: 7 })).toEqual({ ramp: "brand", grade: 7 });
    expect(normalizeBinding("garbage")).toBeNull();
    expect(normalizeBinding({} as never)).toBeNull();
  });
});

describe("roleOverrides map projection", () => {
  it("writes aliases and reads either form back to coordinates", () => {
    const coords = { "text-muted": { ramp: "brand" as const, grade: 8 } };
    const aliased = roleOverridesToAliases(coords);
    expect(aliased).toEqual({ "text-muted": "brand.8" });
    // reader accepts the alias form (new files)...
    expect(normalizeRoleOverrides(aliased)).toEqual(coords);
    // ...and the legacy coordinate form (old files).
    expect(normalizeRoleOverrides(coords as never)).toEqual(coords);
  });
});

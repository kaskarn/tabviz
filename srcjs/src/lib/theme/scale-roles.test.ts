// Non-color scale-role layer (theme-rework Wave 3): type-role overlay +
// alias round-trips. The resolver-dispatch snapshot already proves the
// DEFAULT path is byte-identical; this proves overrides actually bind.
import { describe, it, expect } from "bun:test";
import {
  typeRoleToAlias, aliasToTypeRole, effectiveTypeRoles, TYPE_ROLE_NAMES,
} from "./scale-roles";
import { DEFAULT_TYPE_ROLES } from "./typography";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { PRESETS } from "./theme-presets-inputs";

describe("type-role alias round-trip", () => {
  it("round-trips every default recipe", () => {
    for (const role of TYPE_ROLE_NAMES) {
      const b = DEFAULT_TYPE_ROLES[role];
      const alias = typeRoleToAlias(b);
      expect(alias).toBe(`${b.family}/${b.size}/${b.weight}`);
      expect(aliasToTypeRole(alias)).toEqual(b);
    }
  });
  it("rejects malformed / out-of-vocab aliases", () => {
    expect(aliasToTypeRole("display/title")).toBeNull();       // 2 parts
    expect(aliasToTypeRole("plaid/title/bold")).toBeNull();    // bad family
    expect(aliasToTypeRole("display/giant/bold")).toBeNull();  // bad size
    expect(aliasToTypeRole("display/title/heavy")).toBeNull(); // bad weight
  });
});

describe("effectiveTypeRoles overlay", () => {
  it("returns the default table verbatim when no overrides (snapshot-safe)", () => {
    expect(effectiveTypeRoles({ anchors: {} } as never)).toBe(DEFAULT_TYPE_ROLES);
  });
  it("overlays a subset of one role's recipe, leaving others default", () => {
    const eff = effectiveTypeRoles({
      anchors: {},
      type_roles: { footnote: { size: "label", weight: "bold" } },
    } as never);
    expect(eff.footnote).toEqual({ family: "body", size: "label", weight: "bold" });
    expect(eff.title).toEqual(DEFAULT_TYPE_ROLES.title); // untouched
  });
});

describe("type-role rebind reaches the resolved cssVars", () => {
  it("a footnote size rebind changes --tv-text-footnote-size", () => {
    const base = PRESETS["cochrane"]!;
    const before = resolveTheme(createWire(base, "cochrane")).cssVars["--tv-text-footnote-size"];
    const rebound = resolveTheme(
      createWire({ ...base, type_roles: { footnote: { size: "title" } } }, "cochrane"),
    ).cssVars["--tv-text-footnote-size"];
    expect(rebound).not.toBe(before);
    // title is larger than foot → the px value grew
    expect(parseFloat(rebound)).toBeGreaterThan(parseFloat(before));
  });
});

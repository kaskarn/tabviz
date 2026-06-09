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
import { validateThemeInputs, ThemeInputsValidationError } from "./theme-validate";
import { buildSnippetSteps } from "./theme-diff";

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
    const base = PRESETS["nejm"]!;
    const before = resolveTheme(createWire(base, "nejm")).cssVars["--tv-text-footnote-size"];
    const rebound = resolveTheme(
      createWire({ ...base, type_roles: { footnote: { size: "title" } } }, "nejm"),
    ).cssVars["--tv-text-footnote-size"];
    expect(rebound).not.toBe(before);
    // title is larger than foot → the px value grew
    expect(parseFloat(rebound)).toBeGreaterThan(parseFloat(before));
  });
});

describe("type_roles ingress validation (Wave 3.5 review P0)", () => {
  const ok = PRESETS["nejm"]!; // valid anchors so only type_roles can fail
  it("rejects an out-of-vocab size / family / weight", () => {
    expect(() => validateThemeInputs({ ...ok, type_roles: { footnote: { size: "garbage" } } } as never))
      .toThrow(ThemeInputsValidationError);
    expect(() => validateThemeInputs({ ...ok, type_roles: { title: { family: "serif" } } } as never))
      .toThrow(/type_roles\.title\.family/);
  });
  it("rejects an unknown role key", () => {
    expect(() => validateThemeInputs({ ...ok, type_roles: { bogus: { size: "body" } } } as never))
      .toThrow(/not a type role/);
  });
  it("accepts a valid recipe", () => {
    expect(() => validateThemeInputs({ ...ok, type_roles: { footnote: { size: "label", weight: "bold" } } } as never))
      .not.toThrow();
  });
});

describe("snippet emits named setters (Wave 3.5 review P1/P2)", () => {
  const base = PRESETS["nejm"]!;
  it("set_type_role for a type rebind", () => {
    const steps = buildSnippetSteps(base, { ...base, type_roles: { footnote: { size: "title" } } });
    const s = steps.find((x) => x.setter === "set_type_role");
    expect(s?.args).toContain("footnote");
    expect(s?.args).toContain("size");
  });
  it("set_corners for a radius matching a named slot, not raw stops", () => {
    const steps = buildSnippetSteps(base,
      { ...base, geometry: { radius: { sm: 6, md: 12, lg: 20, pill: 999 } } }); // ≡ round
    expect(steps.find((x) => x.setter === "set_corners")?.args).toContain("round");
    expect(steps.find((x) => x.setter === "set_geometry")).toBeUndefined();
  });
});

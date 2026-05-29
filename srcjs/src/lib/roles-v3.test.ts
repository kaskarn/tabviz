import { describe, it, expect } from "bun:test";
import { buildTheme } from "./theme-resolve-v3";
import {
  resolveRole, resolveRoleRecipe, activeRole, resolveActiveRole,
  roleMarkOpacity, bundleIsActive,
} from "./roles-v3";
import type { ThemeInputsV3 } from "../types/theme-v3";
import { ref } from "../types/theme-v3";

const COCHRANE: ThemeInputsV3 = { brand: "#0099CC", accent: "#C8553D" };

describe("resolveRole — recipe → hex bundle", () => {
  it("emphasis: fg resolves to ink token + weight 600", () => {
    const t = buildTheme(COCHRANE);
    const b = resolveRole("emphasis", t);
    expect(b.fg).toBe(t.tokens.ink);
    expect(b.markerFill).toBe(t.tokens.ink);
    expect(b.fontWeight).toBe(600);
    expect(b.bg).toBeNull(); // no bg in emphasis recipe
  });

  it("accent: fg resolves to accent token (engagement, distinct from emphasis)", () => {
    const t = buildTheme(COCHRANE);
    const b = resolveRole("accent", t);
    expect(b.fg).toBe(t.tokens.accent);
    expect(b.markerFill).toBe(t.tokens.accent);
    expect(b.fontWeight).toBe(600);
  });

  it("emphasis and accent resolve to DIFFERENT colors", () => {
    const t = buildTheme(COCHRANE);
    const emp = resolveRole("emphasis", t);
    const acc = resolveRole("accent", t);
    expect(emp.fg).not.toBe(acc.fg);
  });

  it("bold: weight only, no color override", () => {
    const t = buildTheme(COCHRANE);
    const b = resolveRole("bold", t);
    expect(b.fg).toBeNull();
    expect(b.bg).toBeNull();
    expect(b.markerFill).toBeNull();
    expect(b.fontWeight).toBe(600);
  });

  it("fill: pale tinted bg", () => {
    const t = buildTheme(COCHRANE);
    const b = resolveRole("fill", t);
    expect(b.bg).toBe(t.tokens.accent_subtle);
  });

  it("status roles: fg + markerFill only, no bg (Tufte-minimal)", () => {
    const t = buildTheme(COCHRANE);
    for (const role of ["positive", "negative", "warning", "info"] as const) {
      const b = resolveRole(role, t);
      expect(b.bg).toBeNull();
      expect(b.fg).toBe(t.tokens[role]);
      expect(b.markerFill).toBe(t.tokens[role]);
    }
  });
});

describe("activeRole — precedence picking", () => {
  it("returns null when no flags set", () => {
    expect(activeRole(null)).toBeNull();
    expect(activeRole(undefined)).toBeNull();
    expect(activeRole({})).toBeNull();
  });

  it("status outranks emphasis", () => {
    expect(activeRole({ emphasis: true, negative: true })).toBe("negative");
    expect(activeRole({ emphasis: true, positive: true })).toBe("positive");
  });

  it("fill > accent > emphasis > bold > muted (within generic ladder)", () => {
    expect(activeRole({ fill: true, accent: true })).toBe("fill");
    expect(activeRole({ accent: true, emphasis: true })).toBe("accent");
    expect(activeRole({ emphasis: true, bold: true })).toBe("emphasis");
    expect(activeRole({ bold: true, muted: true })).toBe("bold");
  });

  it("single flag resolves to itself", () => {
    expect(activeRole({ muted: true })).toBe("muted");
    expect(activeRole({ warning: true })).toBe("warning");
  });
});

describe("resolveActiveRole — end-to-end", () => {
  it("returns null when no theme", () => {
    expect(resolveActiveRole({ accent: true }, null)).toBeNull();
  });

  it("returns null when no flag active", () => {
    const t = buildTheme(COCHRANE);
    expect(resolveActiveRole({}, t)).toBeNull();
  });

  it("returns resolved bundle for active role", () => {
    const t = buildTheme(COCHRANE);
    const b = resolveActiveRole({ accent: true }, t);
    expect(b).not.toBeNull();
    expect(b!.fg).toBe(t.tokens.accent);
  });
});

describe("bundleIsActive", () => {
  it("false for null", () => {
    expect(bundleIsActive(null)).toBe(false);
  });

  it("true when any field is set", () => {
    expect(bundleIsActive({
      bg: null, fg: "#000", border: null,
      markerFill: null, markerStroke: null,
      fontWeight: null, fontStyle: null,
    })).toBe(true);
  });

  it("false when all fields null", () => {
    expect(bundleIsActive({
      bg: null, fg: null, border: null,
      markerFill: null, markerStroke: null,
      fontWeight: null, fontStyle: null,
    })).toBe(false);
  });
});

describe("roleMarkOpacity", () => {
  it("returns null when no flag", () => {
    expect(roleMarkOpacity({})).toBeNull();
  });

  it("returns null for non-muted active role", () => {
    expect(roleMarkOpacity({ accent: true })).toBeNull();
    expect(roleMarkOpacity({ emphasis: true })).toBeNull();
    expect(roleMarkOpacity({ negative: true })).toBeNull();
  });

  it("returns muting factors for muted role", () => {
    const o = roleMarkOpacity({ muted: true });
    expect(o).not.toBeNull();
    expect(o!.fill).toBe(0.4);
    expect(o!.stroke).toBe(0.8);
  });
});

describe("custom role recipes — theme overrides recipes, vocabulary fixed", () => {
  it("theme can redefine recipe to use different refs", () => {
    const t = buildTheme(COCHRANE);
    // Theme overrides accent recipe to use brand instead of accent (e.g. brand-coupled emphasis variant)
    t.roles.accent = { fg: ref("brand"), markerFill: ref("brand"), fontWeight: 700 };
    const b = resolveRole("accent", t);
    expect(b.fg).toBe(t.tokens.brand);
    expect(b.markerFill).toBe(t.tokens.brand);
    expect(b.fontWeight).toBe(700);
  });

  it("resolveRoleRecipe accepts any recipe directly", () => {
    const t = buildTheme(COCHRANE);
    const custom = { fg: ref("ink_muted"), fontWeight: 400 };
    const b = resolveRoleRecipe(custom, t.ramps);
    expect(b.fg).toBe(t.tokens.ink_muted);
    expect(b.fontWeight).toBe(400);
  });
});

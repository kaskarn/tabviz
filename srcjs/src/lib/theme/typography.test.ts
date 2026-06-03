// Stage 2 — Typography cascade unit tests.

import { describe, it, expect } from "bun:test";
import {
  DEFAULT_TYPE_BASE_SIZE,
  DEFAULT_TYPE_SCALE_RATIO,
  DEFAULT_TYPE_WEIGHTS,
  DEFAULT_TYPE_ROLES,
  buildSizeScale,
  resolveTypographyInputs,
  resolveTypeRole,
} from "./typography";
import type { ThemeInputs } from "../../types/theme-inputs";

describe("buildSizeScale", () => {
  it("produces 7 ordered steps when ratio > 1", () => {
    const s = buildSizeScale(14, 1.2);
    expect(s.label).toBeLessThan(s.foot);
    expect(s.foot).toBeLessThan(s.body);
    expect(s.body).toBeLessThan(s.head);
    expect(s.head).toBeLessThan(s.subtitle);
    expect(s.subtitle).toBeLessThan(s.title);
    expect(s.title).toBeLessThan(s.display);
  });

  it("body == base (modular scale anchor)", () => {
    expect(buildSizeScale(14, 1.2).body).toBe(14);
    expect(buildSizeScale(16, 1.3).body).toBe(16);
  });

  it("scales by ratio at integer steps", () => {
    const s = buildSizeScale(10, 2);
    // step 1.2 isn't integer but step 0 == 10. Sanity-check head (+0.6) vs body.
    expect(s.head / s.body).toBeCloseTo(Math.pow(2, 0.6), 1);
  });

  it("rounds to 2 decimals for stable cssVar emission", () => {
    const s = buildSizeScale(14, 1.2);
    for (const v of Object.values(s)) {
      expect(v).toBe(Math.round(v * 100) / 100);
    }
  });
});

describe("resolveTypographyInputs", () => {
  it("applies defaults when fields absent", () => {
    const r = resolveTypographyInputs({ brand: "#000" } as ThemeInputs);
    expect(r.baseSize).toBe(DEFAULT_TYPE_BASE_SIZE);
    expect(r.ratio).toBe(DEFAULT_TYPE_SCALE_RATIO);
    expect(r.weights).toEqual({ ...DEFAULT_TYPE_WEIGHTS });
    expect(r.fonts.body).toContain("system-ui");
    expect(r.fonts.display).toBe(r.fonts.body);  // display mirrors body when unset
    expect(r.fonts.mono).toContain("monospace");
  });

  it("honors per-field overrides", () => {
    const r = resolveTypographyInputs({
      brand: "#000",
      fonts: { body: "Inter", display: "Cinzel", mono: "JetBrains Mono" },
      type_base_size: 16,
      type_scale_ratio: 1.333,
      type_weights: { regular: 350 },
    } as ThemeInputs);
    expect(r.baseSize).toBe(16);
    expect(r.ratio).toBeCloseTo(1.333);
    expect(r.weights.regular).toBe(350);
    expect(r.weights.semibold).toBe(DEFAULT_TYPE_WEIGHTS.semibold);  // un-overridden
    expect(r.fonts.body).toBe("Inter");
    expect(r.fonts.display).toBe("Cinzel");
    expect(r.fonts.mono).toBe("JetBrains Mono");
  });
});

describe("resolveTypeRole", () => {
  const resolved = resolveTypographyInputs({ brand: "#000" } as ThemeInputs);

  it("title role uses display family + title size + semibold weight", () => {
    const r = resolveTypeRole("title", resolved);
    expect(r.family).toBe(resolved.fonts.display);
    expect(r.size).toBe(resolved.scale.title);
    expect(r.weight).toBe(DEFAULT_TYPE_WEIGHTS.semibold);
    expect(r.lh).toBe(1.12);
    expect(r.track).toBe("-0.022em");
  });

  it("numeric role uses mono family + body size", () => {
    const r = resolveTypeRole("numeric", resolved);
    expect(r.family).toBe(resolved.fonts.mono);
    expect(r.size).toBe(resolved.scale.body);
    expect(r.weight).toBe(DEFAULT_TYPE_WEIGHTS.regular);
  });

  it("font shorthand omits line-height when role.lh is null", () => {
    const r = resolveTypeRole("body", resolved);
    expect(r.lh).toBeNull();
    expect(r.font).not.toContain("/");
    expect(r.font).toMatch(/^\d+ \d+(\.\d+)?px [^/]+$/);
  });

  it("font shorthand includes line-height when role.lh is set", () => {
    const r = resolveTypeRole("title", resolved);
    expect(r.lh).toBe(1.12);
    expect(r.font).toContain("/1.12");
  });

  it("respects a custom role table", () => {
    const customTable = {
      ...DEFAULT_TYPE_ROLES,
      title: { ...DEFAULT_TYPE_ROLES.title, weight: "bold" as const, lh: 1.0 },
    };
    const r = resolveTypeRole("title", resolved, customTable);
    expect(r.weight).toBe(DEFAULT_TYPE_WEIGHTS.bold);
    expect(r.lh).toBe(1.0);
  });
});

describe("DEFAULT_TYPE_ROLES coverage", () => {
  it("defines all 10 named roles", () => {
    const names = ["title", "subtitle", "heading", "body", "numeric", "label",
                   "caption", "footnote", "cell", "tick"] as const;
    for (const n of names) {
      expect(DEFAULT_TYPE_ROLES[n]).toBeDefined();
    }
  });

  it("each role references a valid family + scale step + weight", () => {
    const resolved = resolveTypographyInputs({ brand: "#000" } as ThemeInputs);
    for (const [name, role] of Object.entries(DEFAULT_TYPE_ROLES)) {
      expect(["display", "body", "mono"]).toContain(role.family);
      expect(["label", "foot", "body", "head", "subtitle", "title", "display"]).toContain(role.size);
      expect(["regular", "medium", "semibold", "bold"]).toContain(role.weight);
      // resolveTypeRole should not throw on the role.
      const r = resolveTypeRole(name as keyof typeof DEFAULT_TYPE_ROLES, resolved);
      expect(r.size).toBeGreaterThan(0);
    }
  });
});

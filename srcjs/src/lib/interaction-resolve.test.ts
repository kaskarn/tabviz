// Interaction-defaults precedence chain (interactivity-UX arc P1).
// baked ← spec.interactionDefaults (global) ← theme opinion ← explicit.

import { describe, expect, it } from "bun:test";
import {
  BAKED_INTERACTION_DEFAULTS,
  resolveInteraction,
  sanitizeInteractionOverrides,
} from "./interaction-resolve";
import type { WebSpec } from "$types";

function spec(parts: Record<string, unknown>): WebSpec {
  return parts as unknown as WebSpec;
}

describe("resolveInteraction", () => {
  it("baked defaults: reader-safe ON, author-grade OFF (conservative-everywhere)", () => {
    const r = resolveInteraction(spec({ interaction: {} }));
    expect(r.enableSort).toBe(true);
    expect(r.enableCollapse).toBe(true);
    expect(r.enableResize).toBe(true);
    expect(r.enableThemeEdit).toBe(true);
    // Author-grade affordances are ON by default as of the D9 reversal
    // (pre-release dev-convenience stance) — every affordance available
    // without re-enabling per spec.
    expect(r.enableEdit).toBe(true);
    expect(r.enableReorderRows).toBe(true);
    expect(r.enableReorderColumns).toBe(true);
    expect(r.enableAxisZoom).toBe(true);
    expect(r.enableArrange).toBe(true);
  });

  it("null spec resolves to baked defaults", () => {
    expect(resolveInteraction(null)).toMatchObject(BAKED_INTERACTION_DEFAULTS);
  });

  it("D31: show_legend / enable_collapse / enable_hover are default-ON, opt-out", () => {
    // default ON (the gated behaviors render/handle)
    const on = resolveInteraction(spec({ interaction: {} }));
    expect(on.showLegend).toBe(true);
    expect(on.enableCollapse).toBe(true);
    expect(on.enableHover).toBe(true);
    // explicit FALSE disables (TabvizPlot/svg-generator gate on these)
    const off = resolveInteraction(spec({
      interaction: { showLegend: false, enableCollapse: false, enableHover: false },
    }));
    expect(off.showLegend).toBe(false);
    expect(off.enableCollapse).toBe(false);
    expect(off.enableHover).toBe(false);
  });

  it("D31: enableSelect was removed (gated a nonexistent row-selection feature)", () => {
    expect("enableSelect" in resolveInteraction(spec({ interaction: {} }))).toBe(false);
    expect((BAKED_INTERACTION_DEFAULTS as Record<string, unknown>).enableSelect).toBeUndefined();
  });

  it("global tier overrides baked; theme opinion overrides global; explicit wins", () => {
    const r = resolveInteraction(spec({
      interactionDefaults: { enable_edit: true, enable_sort: false, enable_axis_zoom: true },
      theme: { authoringInputs: { interaction_defaults: { enable_sort: true, enable_axis_zoom: false } } },
      interaction: { enableAxisZoom: true },
    }));
    expect(r.enableEdit).toBe(true);      // global only
    expect(r.enableSort).toBe(true);      // theme beats global
    expect(r.enableAxisZoom).toBe(true);  // explicit beats theme
  });

  it("explicit FALSE beats a theme-opinion TRUE", () => {
    const r = resolveInteraction(spec({
      theme: { authoringInputs: { interaction_defaults: { enableEdit: true } } },
      interaction: { enableEdit: false },
    }));
    expect(r.enableEdit).toBe(false);
  });

  it("legacy showFilters implies enableFilters", () => {
    const r = resolveInteraction(spec({
      interaction: { showFilters: true, enableFilters: false },
    }));
    expect(r.enableFilters).toBe(true);
  });

  it("non-boolean knobs pass through from the explicit tier only", () => {
    const r = resolveInteraction(spec({
      interaction: { tooltipFields: ["p", "hr"] },
    }));
    expect(r.tooltipFields).toEqual(["p", "hr"]);
    expect(resolveInteraction(spec({})).tooltipFields).toBeNull();
  });
});

describe("sanitizeInteractionOverrides (untrusted ingress)", () => {
  it("accepts snake_case and camelCase known flags", () => {
    expect(sanitizeInteractionOverrides({ enable_sort: false, enableEdit: true }))
      .toEqual({ enableSort: false, enableEdit: true });
  });

  it("drops unknown keys, non-boolean values, and non-object inputs", () => {
    expect(sanitizeInteractionOverrides({
      not_a_flag: true,
      enable_sort: "yes",
      enableThemes: { evil: true },
      __proto__x: true,
    })).toEqual({});
    expect(sanitizeInteractionOverrides(null)).toEqual({});
    expect(sanitizeInteractionOverrides([true])).toEqual({});
    expect(sanitizeInteractionOverrides("enable_sort")).toEqual({});
  });
});

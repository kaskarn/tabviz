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
    // Author-grade affordances mutate what the figure shows — OFF.
    expect(r.enableEdit).toBe(false);
    expect(r.enableReorderRows).toBe(false);
    expect(r.enableReorderColumns).toBe(false);
    expect(r.enableAxisZoom).toBe(false);
  });

  it("null spec resolves to baked defaults", () => {
    expect(resolveInteraction(null)).toMatchObject(BAKED_INTERACTION_DEFAULTS);
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

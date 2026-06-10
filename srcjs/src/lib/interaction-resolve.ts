// Interaction-defaults precedence chain (interactivity-UX arc P1;
// docs/dev/interactivity-ux-plan.md).
//
// The effective interaction surface resolves through four tiers:
//
//   baked defaults                      (BAKED_INTERACTION_DEFAULTS below)
//   ← spec.interactionDefaults          (global tier — wrapper-level config,
//                                        e.g. R options(tabviz.interaction_defaults=))
//   ← theme.inputs.interaction_defaults (theme opinion — a presentation theme
//                                        can enable zoom affordances, an
//                                        editorial theme keeps chrome quiet)
//   ← spec.interaction                  (explicit author settings — only keys
//                                        the author actually set; always win)
//
// Resolution lives HERE, TS-side, so every wrapper language gets identical
// semantics from the same sparse wire (R is not canonical). Wrappers emit
// ONLY explicitly-set flags on spec.interaction; a flag absent from every
// tier gets the baked default.
//
// CONSERVATIVE-EVERYWHERE: reader-safe capabilities (sort, collapse, hover,
// select, filters, export, column resize, the settings cog — which hosts the
// reader a11y contrast toggle) default ON; author-grade affordances that
// mutate what the figure shows (inline editing, row/column reorder, axis
// domain zoom) default OFF in every runtime. Authors opt in per spec, per
// theme, or globally.

import type { InteractionSpec, WebSpec } from "$types";

/** Boolean capability flags resolvable through the defaults chain. */
export const INTERACTION_FLAG_KEYS = [
  "showFilters", "showLegend", "enableSort", "enableCollapse", "enableSelect",
  "enableHover", "enableResize", "enableExport", "enableThemeEdit",
  "enableFilters", "enableReorderRows", "enableReorderColumns", "enableEdit",
  "enableAxisZoom", "showGroupCounts",
] as const;
export type InteractionFlag = (typeof INTERACTION_FLAG_KEYS)[number];
export type InteractionFlagOverrides = Partial<Record<InteractionFlag, boolean>>;

const FLAG_SET: ReadonlySet<string> = new Set(INTERACTION_FLAG_KEYS);

/** snake_case → camelCase for one flag name. Authoring surfaces are
 *  snake_case (R args, ThemeInputs wire); the InteractionSpec wire is
 *  camelCase — accept both everywhere overrides enter. */
function normalizeFlagName(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export const BAKED_INTERACTION_DEFAULTS: Readonly<Record<InteractionFlag, boolean>> = {
  // Reader-safe — ON.
  showFilters: false, // legacy alias of enableFilters; never independently on
  showLegend: true,
  enableSort: true,
  enableCollapse: true,
  enableSelect: true,
  enableHover: true,
  enableResize: true, // column-edge resize is the one universal table idiom
  enableExport: true,
  enableThemeEdit: true, // settings cog hosts the reader contrast (a11y) toggle
  enableFilters: true,
  showGroupCounts: false,
  // Author-grade (mutates what the figure shows) — OFF everywhere.
  enableReorderRows: false,
  enableReorderColumns: false,
  enableEdit: false,
  enableAxisZoom: false,
};

/** The fully-resolved interaction surface consumers read. Boolean flags are
 *  always present; the two non-boolean knobs pass through from the explicit
 *  spec tier only (themes/globals can't set them). */
export interface ResolvedInteraction extends Record<InteractionFlag, boolean> {
  tooltipFields: string[] | null;
  enableThemes: InteractionSpec["enableThemes"];
}

/**
 * Sanitize an untrusted overrides map (theme wire ingress, global tier) down
 * to known flags with boolean values. Accepts snake_case or camelCase keys;
 * silently drops everything else — theme wires are untrusted ingress
 * (W3.5 P0 rule: validate at every ingress).
 */
export function sanitizeInteractionOverrides(x: unknown): InteractionFlagOverrides {
  if (x == null || typeof x !== "object" || Array.isArray(x)) return {};
  const out: InteractionFlagOverrides = {};
  for (const [rawKey, value] of Object.entries(x as Record<string, unknown>)) {
    const key = normalizeFlagName(rawKey);
    if (!FLAG_SET.has(key)) continue;
    if (typeof value !== "boolean") continue;
    out[key as InteractionFlag] = value;
  }
  return out;
}

/** Resolve the effective interaction surface for a spec (see module doc). */
export function resolveInteraction(spec: WebSpec | null | undefined): ResolvedInteraction {
  const explicit = spec?.interaction;
  const themeOpinion = sanitizeInteractionOverrides(
    (spec?.theme as { authoringInputs?: { interaction_defaults?: unknown } } | undefined)
      ?.authoringInputs?.interaction_defaults ??
    (spec?.theme as { inputs?: { interaction_defaults?: unknown } } | undefined)
      ?.inputs?.interaction_defaults,
  );
  const globalTier = sanitizeInteractionOverrides(spec?.interactionDefaults);

  const flags = {} as Record<InteractionFlag, boolean>;
  for (const key of INTERACTION_FLAG_KEYS) {
    const fromExplicit = explicit?.[key];
    flags[key] =
      typeof fromExplicit === "boolean" ? fromExplicit
      : themeOpinion[key] ?? globalTier[key] ?? BAKED_INTERACTION_DEFAULTS[key];
  }
  // Legacy alias: showFilters TRUE implies the filter capability.
  if (flags.showFilters) flags.enableFilters = true;

  return {
    ...flags,
    tooltipFields: explicit?.tooltipFields ?? null,
    enableThemes: explicit?.enableThemes ?? null,
  };
}

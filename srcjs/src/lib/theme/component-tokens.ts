/**
 * Tier-3 component tokens manifest (v4 substrate).
 *
 * The frozen contract that bridges the resolved cascade (Tier 1 inputs →
 * Tier 1 ramps → Tier 2 roles) and the renderer (which reads CSS custom
 * properties from this catalog).
 *
 * Each entry declares one component-level paint/scale/typography token:
 *   - `cssVar`     — the emitted `--tv-*` variable name (the wire identifier)
 *   - `kind`       — what type of value it carries
 *   - `source`     — where the value comes from (role / input / anchor / computed / const)
 *   - `consumedBy` — which renderer files read it (drift gate validates)
 *   - `modes`      — per-mode behavior (HC/RT drops + swaps)
 *   - `description`— human-readable summary for the Cascade Inspector
 *
 * The drift gate (component-tokens.drift.test.ts) enforces:
 *   - Every consumer reference to `--tv-*` is in this manifest or KNOWN_UNCONSUMED.
 *   - Every entry has consumedBy non-empty or is in KNOWN_UNCONSUMED.
 *   - KNOWN_UNCONSUMED can only shrink between commits.
 *
 * Reverse lookups (TOKENS_BY_VAR, TOKENS_BY_ROLE, TOKENS_BY_CONSUMER) are
 * built at module load for the Spine UI / Cascade Inspector / per-file
 * drift checks.
 *
 * See `docs/dev/theme-cascade-stage-1-design.md` §3 (entry shape), §4
 * (drift gate), §17 (CSS organization), §1 (inventory source).
 *
 * INITIAL SCAFFOLD (Stage 1 sprint kickoff): ~40 entries covering the
 * highest-consumption clusters. Remaining ~110 entries from the inventory
 * are added in subsequent sprint commits. KNOWN_UNCONSUMED is bootstrapped
 * with all initial entries since no consumer has been migrated yet.
 */

import type { RoleName, AnchorName } from "../../types/theme-roles";
import type { ThemeInputs } from "../../types/theme-inputs";

/** What kind of value a component token carries. */
export type TokenKind =
  | "paint-fill"     // background-color / fill attribute
  | "paint-stroke"   // border-color / stroke attribute
  | "paint-color"    // color (text foreground)
  | "spacing-px"     // numeric px value (padding, gap, height)
  | "border-width"   // numeric px for border widths
  | "font-family"    // CSS font-family stack
  | "font-size"      // CSS font-size (px or rem)
  | "font-weight"    // CSS font-weight (numeric)
  | "font-italic"    // CSS font-style flag (true/false → "italic"/"normal")
  | "font-figures"   // font-variant-numeric ("tabular" | "proportional")
  | "opacity"        // 0..1 scalar
  | "shape"          // marker-shape enum (renderer-side)
  | "flag";          // boolean (rendered as data-* attribute, NOT a CSS var)

/** Where a token's value comes from. The Cascade Inspector uses this for
 *  the provenance display. */
export type TokenSource =
  | { tier: "role"; role: RoleName }
  | { tier: "input"; input: keyof ThemeInputs }
  | { tier: "anchor"; anchor: AnchorName }
  | { tier: "computed"; note: string }
  | { tier: "const"; note: string };

/** Per-mode behavior applied at resolve time. The resolver consults this
 *  field when computing each token's value under HC or RT modes. */
export type ModeBehavior = {
  /** HC mode: drop fill to transparent, or swap to a different role. */
  hc?: "drop" | { swap: RoleName };
  /** RT mode: drop alpha to transparent, or swap translucent → solid. */
  rt?: "drop" | { swap: RoleName };
};

/** One entry in the manifest. */
export interface ComponentToken {
  /** CSS variable name emitted into the scope's inline style. */
  readonly cssVar: string;
  /** What this token paints/scales/sizes. */
  readonly kind: TokenKind;
  /** Provenance — where the resolved value comes from. */
  readonly source: TokenSource;
  /** Consumer file paths (relative to srcjs/src/). The drift gate enforces
   *  that every cssVar referenced by a consumer is declared here. */
  readonly consumedBy: readonly string[];
  /** Optional: per-mode behavior. */
  readonly modes?: ModeBehavior;
  /** Optional: short human-readable description for the Inspector. */
  readonly description?: string;
}

// ============================================================================
// THE MANIFEST
// Organized by cluster with cluster-divider comments per Q-P1.5 closure.
// ============================================================================
export const COMPONENT_TOKENS: readonly ComponentToken[] = [

  // ── Row state ──────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-row-base-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "surface" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte", "lib/swatches.ts"],
    description: "Default row background fill",
  },
  {
    cssVar: "--tv-row-base-fg",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Default row foreground (text) color",
  },
  {
    cssVar: "--tv-row-alt-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "surface-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Alternating (zebra) row background fill",
  },
  {
    cssVar: "--tv-row-hover-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "fill-hover" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Row background on pointer hover (browser only)",
  },
  {
    cssVar: "--tv-row-selected-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "fill-active" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Row background when row is selected",
  },
  {
    cssVar: "--tv-row-emphasis-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "highlight-bg" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte", "lib/semantic-styling.ts"],
    modes: { hc: "drop", rt: { swap: "fill-hover" } },
    description: "Highlighted row background (paint-tool emphasis token)",
  },
  {
    cssVar: "--tv-row-emphasis-bar",
    kind: "paint-fill",
    source: { tier: "role", role: "highlight-bar" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Vertical bar marker on highlighted rows (visible in HC even when wash drops)",
  },
  {
    cssVar: "--tv-row-emphasis-fg",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Highlighted row foreground (text) color",
  },

  // ── Cell ───────────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-cell-bg",
    kind: "paint-fill",
    source: { tier: "const", note: "transparent — cell inherits row" },
    consumedBy: ["export/svg-generator.ts"],
    description: "Cell background (transparent by default; inherits row)",
  },
  {
    cssVar: "--tv-cell-fg",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Cell text foreground color",
  },
  {
    cssVar: "--tv-cell-border",
    kind: "paint-stroke",
    source: { tier: "role", role: "border-subtle" },
    consumedBy: ["export/svg-generator.ts"],
    description: "Cell horizontal divider color",
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-header-light-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "surface" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    description: "Column header background under data-head-style=\"light\"",
  },
  {
    cssVar: "--tv-header-light-fg",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    description: "Column header text under data-head-style=\"light\"",
  },
  {
    cssVar: "--tv-header-light-rule",
    kind: "paint-stroke",
    source: { tier: "role", role: "border-strong" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    description: "Bottom rule under column headers under data-head-style=\"light\"",
  },
  {
    cssVar: "--tv-header-tint-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "fill" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    description: "Column header background under data-head-style=\"tint\"",
  },
  {
    cssVar: "--tv-header-tint-fg",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    description: "Column header text under data-head-style=\"tint\"",
  },
  {
    cssVar: "--tv-header-fill-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "brand-solid" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    description: "Column header background under data-head-style=\"fill\"",
  },
  {
    cssVar: "--tv-header-fill-fg",
    kind: "paint-color",
    source: { tier: "role", role: "text-onsolid" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    description: "Column header text under data-head-style=\"fill\" (computed contrast pick on brand)",
  },

  // ── Plot scaffold ──────────────────────────────────────────────────────────
  {
    cssVar: "--tv-plot-axis-line",
    kind: "paint-stroke",
    source: { tier: "role", role: "border-strong" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte", "stores/slices/axis.svelte.ts"],
    description: "Plot axis line color",
  },
  {
    cssVar: "--tv-plot-tick-mark",
    kind: "paint-stroke",
    source: { tier: "role", role: "border-strong" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte"],
    description: "Plot tick mark color",
  },
  {
    cssVar: "--tv-plot-tick-mark-length",
    kind: "spacing-px",
    source: { tier: "computed", note: "density-driven" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte", "stores/slices/axis.svelte.ts"],
    description: "Length of axis tick marks (px)",
  },
  {
    cssVar: "--tv-plot-line-width",
    kind: "border-width",
    source: { tier: "computed", note: "density-driven; default 1.5px" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte"],
    description: "Default line width for plot strokes (px)",
  },
  {
    cssVar: "--tv-plot-point-size",
    kind: "spacing-px",
    source: { tier: "computed", note: "density-driven; default 6px" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte"],
    description: "Default marker point diameter (px)",
  },

  // ── Spacing ────────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-spacing-row-height",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "stores/slices/layout-zoom.svelte.ts",
      "lib/layout/table-metrics.ts",
    ],
    description: "Default data-row height in px (density × densityFactor)",
  },
  {
    cssVar: "--tv-spacing-header-height",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "stores/slices/layout-zoom.svelte.ts",
    ],
    description: "Column-header strip height (px)",
  },
  {
    cssVar: "--tv-spacing-padding",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "stores/slices/layout-zoom.svelte.ts",
    ],
    description: "Generic padding token (px)",
  },
  {
    cssVar: "--tv-spacing-cell-padding-x",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "stores/slices/columns.svelte.ts",
      "lib/layout/table-metrics.ts",
    ],
    description: "Horizontal cell padding (px)",
  },
  {
    cssVar: "--tv-spacing-cell-padding-y",
    kind: "spacing-px",
    source: { tier: "const", note: "0 in v3; reserved for future density extensions" },
    consumedBy: ["export/svg-generator.ts"],
    description: "Vertical cell padding (deprecated/reserved)",
  },
  {
    cssVar: "--tv-spacing-axis-gap",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "stores/slices/axis.svelte.ts",
    ],
    description: "Gap between axis and plot content (px)",
  },
  {
    cssVar: "--tv-spacing-column-group-padding",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Padding inside a column group (px)",
  },
  {
    cssVar: "--tv-spacing-row-group-padding",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "stores/slices/layout-zoom.svelte.ts",
    ],
    description: "Padding between row groups (px)",
  },
  {
    cssVar: "--tv-spacing-header-gap",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Gap inside the header region (px)",
  },
  {
    cssVar: "--tv-spacing-footer-gap",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Gap inside the footer region (px)",
  },
  {
    cssVar: "--tv-spacing-title-subtitle-gap",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Gap between title and subtitle in header (px)",
  },
  {
    cssVar: "--tv-spacing-bottom-margin",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Bottom margin below content (px)",
  },
  {
    cssVar: "--tv-spacing-indent-per-level",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Hierarchical indent step (px per nesting level)",
  },
  {
    cssVar: "--tv-spacing-container-padding",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Outer container padding (px)",
  },

  // ── Text roles (Tier-3 typography tokens; Stage 2 expands these) ──────────
  {
    cssVar: "--tv-text-title-fg",
    kind: "paint-color",
    source: { tier: "role", role: "brand-text" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    description: "Plot title text color",
  },
  {
    cssVar: "--tv-text-body-fg",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Body text color",
  },
  {
    cssVar: "--tv-text-footnote-fg",
    kind: "paint-color",
    source: { tier: "role", role: "text-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Footnote text color",
  },
] as const;

// ============================================================================
// REVERSE LOOKUPS — built once at module load.
// ============================================================================

/** Index by cssVar. The Cascade Inspector + resolver use this for O(1)
 *  token lookup. */
export const TOKENS_BY_VAR: ReadonlyMap<string, ComponentToken> = (() => {
  const m = new Map<string, ComponentToken>();
  for (const t of COMPONENT_TOKENS) m.set(t.cssVar, t);
  return m;
})();

/** Index by Tier-2 role. The Spine UI's "hover a role → light up consumers"
 *  uses this for role-to-consumer reverse lookup. */
export const TOKENS_BY_ROLE: ReadonlyMap<RoleName, readonly ComponentToken[]> = (() => {
  const m = new Map<RoleName, ComponentToken[]>();
  for (const t of COMPONENT_TOKENS) {
    if (t.source.tier === "role") {
      const arr = m.get(t.source.role) ?? [];
      arr.push(t);
      m.set(t.source.role, arr);
    }
  }
  return m;
})();

/** Index by consumer file path. The drift gate's per-file validation uses
 *  this to check that each file's actual --tv-* references match its
 *  declared consumedBy. */
export const TOKENS_BY_CONSUMER: ReadonlyMap<string, readonly ComponentToken[]> = (() => {
  const m = new Map<string, ComponentToken[]>();
  for (const t of COMPONENT_TOKENS) {
    for (const f of t.consumedBy) {
      const arr = m.get(f) ?? [];
      arr.push(t);
      m.set(f, arr);
    }
  }
  return m;
})();

// ============================================================================
// GRANDFATHER ALLOW-LIST — initially all entries because no consumers have
// migrated yet. Shrinks as Step 6 (consumer migration) progresses.
//
// Per CLAUDE.md drift-gate discipline + Stage 1 §4b: this set can ONLY
// SHRINK between commits. A CI guard checks the entry count doesn't grow.
// Removing an entry means: a consumer file in that token's `consumedBy`
// now actually references the token via `var(--tv-...)` and the drift
// gate accepts it.
//
// BEGIN AUTOGEN — regenerate with:
//   bun test src/lib/theme/component-tokens.drift.test.ts 2>&1 | awk '/^  \"/' | sort -u
// ============================================================================
export const KNOWN_UNCONSUMED: ReadonlySet<string> = new Set<string>([
  // ── Row state
  "--tv-row-base-bg",
  "--tv-row-base-fg",
  "--tv-row-alt-bg",
  "--tv-row-hover-bg",
  "--tv-row-selected-bg",
  "--tv-row-emphasis-bg",
  "--tv-row-emphasis-bar",
  "--tv-row-emphasis-fg",
  // ── Cell
  "--tv-cell-bg",
  "--tv-cell-fg",
  "--tv-cell-border",
  // ── Header
  "--tv-header-light-bg",
  "--tv-header-light-fg",
  "--tv-header-light-rule",
  "--tv-header-tint-bg",
  "--tv-header-tint-fg",
  "--tv-header-fill-bg",
  "--tv-header-fill-fg",
  // ── Plot
  "--tv-plot-axis-line",
  "--tv-plot-tick-mark",
  "--tv-plot-tick-mark-length",
  "--tv-plot-line-width",
  "--tv-plot-point-size",
  // ── Spacing
  "--tv-spacing-row-height",
  "--tv-spacing-header-height",
  "--tv-spacing-padding",
  "--tv-spacing-cell-padding-x",
  "--tv-spacing-cell-padding-y",
  "--tv-spacing-axis-gap",
  "--tv-spacing-column-group-padding",
  "--tv-spacing-row-group-padding",
  "--tv-spacing-header-gap",
  "--tv-spacing-footer-gap",
  "--tv-spacing-title-subtitle-gap",
  "--tv-spacing-bottom-margin",
  "--tv-spacing-indent-per-level",
  "--tv-spacing-container-padding",
  // ── Text roles
  "--tv-text-title-fg",
  "--tv-text-body-fg",
  "--tv-text-footnote-fg",
]);
// END AUTOGEN

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
  | "font-line-height" // CSS line-height (unitless or "normal"); not a px value
  | "font-track"     // CSS letter-spacing string (e.g. "-0.022em")
  | "font-shorthand" // CSS `font` shorthand "weight size/lh family"
  | "shadow"         // CSS box-shadow stack string ("0 1px 3px rgba(...)") — not a paint
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
    description: "Default data-row height in px (density × density_factor)",
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

  // ── Text roles (Tier-3 typography tokens) ──────────────────────────────────
  // Color (fg) side of the typography roles. The typography family/size/weight/
  // lh/track tokens follow per Stage 2 §1e.
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

  // ── Stage 2 §2 — Shell/paper two-surface model ────────────────────────────
  // Tier-3 tokens emitted by the resolver based on inputs.shell_mode.
  // Five per surface: bg, border, shadow, radius, padding.
  {
    cssVar: "--tv-shell-bg",
    kind: "paint-fill",
    source: { tier: "computed", note: "shell/paper: shell.bg per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell (outer chrome) background. Resolves per shell_mode.",
  },
  {
    cssVar: "--tv-shell-border",
    kind: "paint-color",
    source: { tier: "computed", note: "shell/paper: shell.border per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell border color. Resolves per shell_mode.",
  },
  {
    cssVar: "--tv-shell-shadow",
    kind: "paint-color",
    source: { tier: "computed", note: "shell/paper: shell.shadow per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell box-shadow declaration (full CSS shadow string).",
  },
  {
    cssVar: "--tv-shell-radius",
    kind: "spacing-px",
    source: { tier: "computed", note: "shell/paper: shell radius per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell border-radius (px).",
  },
  {
    cssVar: "--tv-shell-padding",
    kind: "spacing-px",
    source: { tier: "computed", note: "shell/paper: shell padding per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell inner padding (px).",
  },
  {
    cssVar: "--tv-paper-bg",
    kind: "paint-fill",
    source: { tier: "computed", note: "shell/paper: paper.bg per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper (inner data card) background. Resolves per shell_mode.",
  },
  {
    cssVar: "--tv-paper-border",
    kind: "paint-color",
    source: { tier: "computed", note: "shell/paper: paper.border per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper border color.",
  },
  {
    cssVar: "--tv-paper-shadow",
    kind: "paint-color",
    source: { tier: "computed", note: "shell/paper: paper.shadow per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper box-shadow declaration.",
  },
  {
    cssVar: "--tv-paper-radius",
    kind: "spacing-px",
    source: { tier: "computed", note: "shell/paper: paper radius per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper border-radius (px).",
  },
  {
    cssVar: "--tv-paper-padding",
    kind: "spacing-px",
    source: { tier: "computed", note: "shell/paper: paper padding per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper inner padding (px).",
  },

  // ── Stage 2 §7 — Browser-additive effects (graceful-degrade in SVG) ───────
  // Glass, brand gradient, glow. Each token's browser-additive companion
  // lives in the same scope; SVG export degrades to a flat/solid equivalent.
  {
    cssVar: "--tv-brand-gradient",
    kind: "paint-fill",
    source: { tier: "computed", note: "brand gradient: brand → brand-deep" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Brand gradient stop pair (CSS linear-gradient or SVG <linearGradient>)",
  },
  {
    cssVar: "--tv-glow-brand-color",
    kind: "paint-color",
    source: { tier: "computed", note: "brand glow: accent @ alpha 0.4" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Brand glow color for box-shadow / SVG <filter> emit",
  },
  {
    cssVar: "--tv-glass-blur",
    kind: "spacing-px",
    source: { tier: "const", note: "glass backdrop-filter blur radius" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Glass blur radius (browser only; SVG degrades to no-blur)",
  },

  // ── Stage 2 §5 — HC encoding fidelity tokens ──────────────────────────────
  // High-contrast mode drops translucent washes; these tokens preserve the
  // semantic encoding on non-color channels (caret glyph, ring stroke, bar
  // thickness). The resolver emits standard vs HC values per token.modes.
  {
    cssVar: "--tv-hc-caret-char",
    kind: "paint-color",  // emitted as a character literal string
    source: { tier: "const", note: "HC caret glyph (▸ / blank)" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Caret glyph emitted in emphasis rows under HC mode; empty string under standard",
  },
  {
    cssVar: "--tv-hc-ring-width",
    kind: "border-width",
    source: { tier: "const", note: "HC chip ring stroke width" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Ring stroke width for status chips under HC mode (1.5px)",
  },
  {
    cssVar: "--tv-hc-bar-width",
    kind: "spacing-px",
    source: { tier: "const", note: "HC emphasis-row bar thickness" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Emphasis-row vertical bar thickness — 3px standard, 4px under HC",
  },

  // ── Stage 2 §3 — Surface texture color tokens ─────────────────────────────
  // Two color knobs drive all four textures (ruled / grid / dotted / grain).
  // The selector + recipe live in theme-runtime.css; the colors come from
  // the resolver tied to neutral grades.
  {
    cssVar: "--tv-shell-texture-line",
    kind: "paint-color",
    source: { tier: "computed", note: "texture: faint hairline (neutral grade ~3)" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Texture line color (ruled / grid). Faint hairline on the surface.",
  },
  {
    cssVar: "--tv-shell-texture-dot",
    kind: "paint-color",
    source: { tier: "computed", note: "texture: dot color (neutral grade ~4)" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Texture dot color (dotted / grain). Slightly stronger than line.",
  },
  {
    cssVar: "--tv-paper-texture-line",
    kind: "paint-color",
    source: { tier: "computed", note: "texture: paper-side hairline" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Texture line color when texture lives on the paper surface.",
  },
  {
    cssVar: "--tv-paper-texture-dot",
    kind: "paint-color",
    source: { tier: "computed", note: "texture: paper-side dot" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Texture dot color when texture lives on the paper surface.",
  },

  // ── Stage 2 §4 — Texture knockout token ───────────────────────────────────
  // When text sits over a ruled / grid / dotted texture, the texture lines
  // pass through glyphs and hurt legibility. Knockout = a faint pad behind
  // the text that hides ~78% of the texture without erasing it entirely.
  {
    cssVar: "--tv-shell-text-knockout-bg",
    kind: "paint-fill",
    source: { tier: "computed", note: "knockout: shell-bg @ 78% opacity premix" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Premixed knockout pad behind text on textured shell surfaces",
  },
  {
    cssVar: "--tv-paper-text-knockout-bg",
    kind: "paint-fill",
    source: { tier: "computed", note: "knockout: paper-bg @ 78% opacity premix" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Premixed knockout pad behind text on textured paper surfaces",
  },

  // ── Stage 2 §6 — Elevation shadow color tokens ────────────────────────────
  // Hue-aware shadow colors derived from the paper bg's hue mixed with
  // black. Browser CSS uses them in box-shadow; SVG export uses them as
  // <feFlood flood-color> inside <filter> definitions. Same value, both
  // surfaces — the parity guarantee.
  {
    cssVar: "--tv-shadow-raised-near",
    kind: "paint-color",
    source: { tier: "computed", note: "elevation: paper hue + 12% black, alpha 0.12" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Near shadow color for raised elevation (1-2 px softness)",
  },
  {
    cssVar: "--tv-shadow-raised-far",
    kind: "paint-color",
    source: { tier: "computed", note: "elevation: paper hue + 24% black, alpha 0.08" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Far shadow color for raised elevation (6-20 px diffusion)",
  },
  {
    cssVar: "--tv-shadow-overlay-near",
    kind: "paint-color",
    source: { tier: "computed", note: "elevation: paper hue + 24% black, alpha 0.18" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Near shadow color for overlay (modal/popover) elevation",
  },
  {
    cssVar: "--tv-shadow-overlay-far",
    kind: "paint-color",
    source: { tier: "computed", note: "elevation: paper hue + 32% black, alpha 0.12" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Far shadow color for overlay elevation",
  },

  // ── Stage 2 — Typography Tier 3 (family/size/weight/lh/track per role) ────
  // 10 type roles × 5 properties each + a `font` shorthand = 60 entries.
  // Sourced from typography-tier-1 inputs via the resolver's
  // resolveTypeRole() walker. Consumers read e.g.
  //   font: var(--tv-text-title-font);
  // or the individual properties:
  //   font-family: var(--tv-text-title-family);
  //   font-size:   var(--tv-text-title-size);
  // etc.
  ...buildTypographyManifestEntries(),

  // ── Accent (engagement layer) ─────────────────────────────────────────────
  {
    cssVar: "--tv-accent",
    kind: "paint-color",
    source: { tier: "role", role: "accent-solid" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Accent solid color (hover/selected/callout layer; engagement, not identity)",
  },
  {
    cssVar: "--tv-accent-fill",
    kind: "paint-fill",
    source: { tier: "role", role: "accent-fill" },
    consumedBy: ["export/svg-generator.ts"],
    description: "Accent fill (translucent wash for callout/highlight)",
  },

  // ── Generic T2 role passthroughs (consumer migration helpers) ─────────────
  // These mirror Tier-2 roles 1:1 with no Tier-3 specialization. Consumers
  // reading e.g. theme.surface.base / theme.content.primary / theme.content.muted
  // migrate to these tokens during Phase 6.
  {
    cssVar: "--tv-surface-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "surface" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic surface background (paper). Mirrors role:surface for consumers that don't have a row/cell-specific surface need",
  },
  {
    cssVar: "--tv-surface-subtle-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "surface-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Generic surface-subtle background (alt paper). Mirrors role:surface-subtle",
  },
  {
    cssVar: "--tv-text",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic primary text color. Mirrors role:text — use for body content that isn't row-specific",
  },
  {
    cssVar: "--tv-text-muted",
    kind: "paint-color",
    source: { tier: "role", role: "text-muted" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic muted/secondary text color. Mirrors role:text-muted — use for captions, secondary labels",
  },
  {
    cssVar: "--tv-text-subtle",
    kind: "paint-color",
    source: { tier: "role", role: "text-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic subtle/tertiary text color. Mirrors role:text-subtle — use for de-emphasized labels, hints",
  },
  {
    cssVar: "--tv-border",
    kind: "paint-color",
    source: { tier: "role", role: "border" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic border color. Mirrors role:border",
  },
  {
    cssVar: "--tv-border-subtle",
    kind: "paint-color",
    source: { tier: "role", role: "border-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic subtle border color. Mirrors role:border-subtle — use for hairlines, faint dividers",
  },

  // ── Phase D — GEOMETRY · radius scale ─────────────────────────────────────
  // Four corner-softness values driven from inputs.geometry.radius. Polarity
  // and accessibility-mode agnostic; HC keeps radii unchanged.
  {
    cssVar: "--tv-radius-sm",
    kind: "spacing-px",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Small corner radius — chip pills, badge ornaments. Default 2px.",
  },
  {
    cssVar: "--tv-radius-md",
    kind: "spacing-px",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Medium corner radius — buttons, controls. Default 6px.",
  },
  {
    cssVar: "--tv-radius-lg",
    kind: "spacing-px",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Large corner radius — panels, cards, paper. Default 10px.",
  },
  {
    cssVar: "--tv-radius-pill",
    kind: "spacing-px",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Pill radius — chips, tags. Default 999px (effectively round).",
  },

  // ── Phase D — GEOMETRY · border-width scale ───────────────────────────────
  // HC mode bumps each value by +1px to compensate for the reduced colour cue.
  {
    cssVar: "--tv-border-width-hair",
    kind: "border-width",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    modes: { hc: { swap: "border-strong" } },
    description: "Hairline width — gridlines, alt-row dividers. Default 0.5px.",
  },
  {
    cssVar: "--tv-border-width-thin",
    kind: "border-width",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Thin width — default rules. Default 1px.",
  },
  {
    cssVar: "--tv-border-width-regular",
    kind: "border-width",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Regular width — header rules. Default 1.5px.",
  },
  {
    cssVar: "--tv-border-width-thick",
    kind: "border-width",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Thick width — emphasis bars, callout borders. Default 2.5px.",
  },

  // ── Phase D — EFFECTS · glow ──────────────────────────────────────────────
  // Browser-additive. Drawn from the requested anchor ramp at grade 9
  // (peak chroma) with mode-aware blur/spread. HC drops to transparent.
  {
    cssVar: "--tv-glow-color",
    kind: "paint-color",
    source: { tier: "computed", note: "anchor ramp grade 9 (brand or accent per inputs.effects.glow_anchor)" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Glow / box-shadow tint color. None when effects.glow_intensity = 'none'.",
  },
  {
    cssVar: "--tv-glow-blur",
    kind: "spacing-px",
    source: { tier: "input", input: "effects" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Glow blur radius. 0 / 8px / 18px for none / subtle / neon.",
  },
  {
    cssVar: "--tv-glow-spread",
    kind: "spacing-px",
    source: { tier: "input", input: "effects" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Glow spread. 0 / 1px / 3px for none / subtle / neon.",
  },

  // ── Phase D — EFFECTS · gradient shell ────────────────────────────────────
  // Two-stop linear gradient applied to the shell background. Stops are
  // brand[8]/accent[9] derived per intensity. HC drops; RT swaps to the
  // mid-stop solid for a usable but flat surface.
  {
    cssVar: "--tv-shell-gradient",
    kind: "paint-fill",
    source: { tier: "computed", note: "linear-gradient from brand ramp + accent ramp per inputs.effects.gradient_shell_intensity" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    modes: { hc: "drop", rt: { swap: "surface" } },
    description: "Optional shell gradient background. 'none' when intensity = 'none'.",
  },

  // ── Phase D — EFFECTS · elevation ─────────────────────────────────────────
  // Card-style shadow stack independent of the existing shell elevation.
  // Layered (near + far) using the same shadow tokens as Stage 2 §6.
  {
    cssVar: "--tv-shadow-emphasis",
    kind: "shadow",
    source: { tier: "computed", note: "box-shadow stack derived from inputs.effects.elevation" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Optional emphasis-row box-shadow. 'none' when elevation = 'none'.",
  },
];

// ============================================================================
// TYPOGRAPHY MANIFEST GENERATOR (Stage 2)
// ============================================================================

/** Generate the 60 Tier-3 typography manifest entries (10 type roles × 6
 *  per-role properties: family/size/weight/lh/track + font shorthand).
 *
 *  Sourced from `lib/theme/typography.ts::DEFAULT_TYPE_ROLES` via the
 *  resolver's resolveTypeRole walker. The `source.tier = "computed"` tag
 *  marks these as derived rather than direct-role bindings — the resolver
 *  reads typography-tier-1 inputs and produces the final values. */
function buildTypographyManifestEntries(): ComponentToken[] {
  const ROLES = [
    "title", "subtitle", "heading", "body", "numeric",
    "label", "caption", "footnote", "cell", "tick",
  ] as const;
  const entries: ComponentToken[] = [];
  for (const role of ROLES) {
    const base = `--tv-text-${role}` as const;
    const consumedBy = ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"];
    entries.push({
      cssVar: `${base}-family`,
      kind: "font-family",
      source: { tier: "computed", note: `typography role:${role}` },
      consumedBy,
      description: `${role} font family stack`,
    });
    entries.push({
      cssVar: `${base}-size`,
      kind: "font-size",
      source: { tier: "computed", note: `typography role:${role}` },
      consumedBy,
      description: `${role} font size (px)`,
    });
    entries.push({
      cssVar: `${base}-weight`,
      kind: "font-weight",
      source: { tier: "computed", note: `typography role:${role}` },
      consumedBy,
      description: `${role} font weight`,
    });
    entries.push({
      cssVar: `${base}-lh`,
      kind: "font-line-height",
      source: { tier: "computed", note: `typography role:${role} line-height` },
      consumedBy,
      description: `${role} line height (unitless or "normal")`,
    });
    entries.push({
      cssVar: `${base}-track`,
      kind: "font-track",
      source: { tier: "computed", note: `typography role:${role} letter-spacing` },
      consumedBy,
      description: `${role} letter-spacing (CSS value, e.g. -0.022em)`,
    });
    entries.push({
      cssVar: `${base}-font`,
      kind: "font-shorthand",
      source: { tier: "computed", note: `typography role:${role} shorthand` },
      consumedBy,
      description: `${role} CSS font shorthand (weight size/lh family)`,
    });
  }
  return entries;
}

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
  // ── Stage 2 typography (declared but consumers migrating in Stage 2 §1f)
  ...buildTypographyManifestEntries().map((t) => t.cssVar),
  // ── False positives: drift regex matches bare prefixes from template
  // literals inside resolver / generator helpers. Not real references.
  "--tv-text-",
  "--tv-shell-",
  "--tv-paper-",
  "--tv-shadow-",
  "--tv-shell-texture-",
  "--tv-paper-texture-",
  // Phase D bare prefixes from template literals in GeometrySamples viz.
  "--tv-radius-",
  "--tv-border-width-",
  // Coherence pass — bare prefix from density-presets.ts's snakeToCssVar
  // template literal. The expanded cssVars (--tv-spacing-row-height etc.)
  // are real manifest entries; this allow-lists the literal-prefix match.
  "--tv-spacing-",

  // ── Phase D — geometry + effects (declared D2; consumers wire up in D4).
  // Shrink this block as TabvizPlot.svelte + svg-generator.ts start
  // reading the new tokens.
  "--tv-radius-md",
  "--tv-radius-pill",
  "--tv-border-width-thin",
  "--tv-border-width-regular",
  "--tv-glow-blur",
  "--tv-glow-spread",

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
  // --tv-cell-fg consumed 2026-06-02 (renderUnifiedTableRow default cell fg)
  // --tv-cell-border consumed 2026-06-02 (renderDetailsPanel + axis renderers)
  // ── Header
  "--tv-header-light-bg",
  "--tv-header-light-fg",
  "--tv-header-light-rule",
  "--tv-header-tint-bg",
  "--tv-header-tint-fg",
  "--tv-header-fill-bg",
  "--tv-header-fill-fg",
  // ── Plot (axis-line + tick-mark + line-width + point-size migrated 2026-06-02)
  "--tv-plot-tick-mark-length",
  // ── Spacing (12 of 13 consumed 2026-06-03; cell-padding-y +
  //              container-padding remain v3-only)
  "--tv-spacing-cell-padding-y",
  "--tv-spacing-container-padding",
  // ── Text roles (--tv-text-title-fg + --tv-text-footnote-fg consumed 2026-06-02 by renderHeader/renderFooter)
  "--tv-text-body-fg",
  // ── Generic T2 role passthroughs (Phase 6 migration helpers)
  // Consumed 2026-06-02: --tv-text, --tv-text-muted, --tv-text-subtle,
  //                      --tv-cell-border (used as border-subtle proxy),
  //                      --tv-surface-bg (canvas + row-banding guard)
  // Consumed 2026-06-03: --tv-border (header variant rule fallback)
  "--tv-surface-subtle-bg",

  // ── v3 LEGACY REFERENCES ──────────────────────────────────────────────────
  // The 140+ entries below are `--tv-*` references already present in v3
  // code (theme-css.ts, Svelte components, etc.) that
  // the gate detects but the v4 manifest doesn't model. They are
  // grandfathered en masse during sprint kickoff. As consumers migrate
  // (step 6) and v3 emitters get deleted (step 10), these rows disappear.
  // Per Stage 1 §4b: shrink-only; do not add to this block.
  "--tv-actual-scale",
  "--tv-alt-bg",
  "--tv-axis-gap",
  "--tv-axis-height",
  "--tv-axis-label-fg",
  "--tv-axis-line",
  "--tv-axis-tick",
  "--tv-axis-tick-fg",
  "--tv-badge-",
  "--tv-badge-error",
  "--tv-badge-info",
  "--tv-badge-muted",
  "--tv-badge-success",
  "--tv-badge-warning",
  "--tv-bg",
  // --tv-border is now a real manifest entry (see line ~695); removed
  // from the v3-legacy KNOWN_UNCONSUMED list per coherence audit §7.6.
  "--tv-border-",
  "--tv-border-col-style",
  "--tv-border-major-color",
  "--tv-border-major-style",
  "--tv-border-minor-color",
  "--tv-border-row-style",
  "--tv-border-table-color",
  "--tv-bottom-margin",
  "--tv-brand-ink",
  "--tv-focus",
  "--tv-cell-padding-x",
  "--tv-cell-padding-y",
  "--tv-container-border",
  "--tv-container-border-radius",
  "--tv-container-padding",
  "--tv-content-primary",
  "--tv-divider-strong",
  "--tv-editor-max-h",
  "--tv-fg",
  "--tv-first-col-bg",
  "--tv-first-col-bold-bg",
  "--tv-first-col-bold-fg",
  "--tv-first-col-fg",
  "--tv-first-col-rule",
  "--tv-first-col-weight",
  "--tv-font-family",
  "--tv-font-mono",
  "--tv-font-size-",
  "--tv-font-size-base",
  "--tv-font-size-lg",
  "--tv-font-size-sm",
  "--tv-font-weight-bold",
  "--tv-font-weight-medium",
  "--tv-font-weight-normal",
  "--tv-footer-gap",
  "--tv-group-border-width",
  "--tv-group-header-opacity",
  "--tv-group-padding",
  "--tv-header-bg",
  "--tv-header-bold-bg",
  "--tv-header-bold-fg",
  "--tv-header-border-width",
  "--tv-header-depth",
  "--tv-header-fg",
  "--tv-header-font-scale",
  "--tv-header-gap",
  "--tv-header-height",
  "--tv-header-row-height",
  "--tv-header-rule",
  "--tv-hover",
  "--tv-hover-bg",
  "--tv-ink",
  "--tv-interval-line",
  "--tv-line-height",
  "--tv-line-width",
  "--tv-max-height",
  "--tv-max-width",
  "--tv-muted",
  "--tv-padding",
  "--tv-plot-axis",
  "--tv-plot-bg",
  "--tv-plot-gridline",
  "--tv-plot-reference",
  "--tv-plot-tick",
  "--tv-plot-tick-length",
  "--tv-plot-width",
  "--tv-point-size",
  "--tv-primary",
  "--tv-primary-deep",
  "--tv-role-",
  "--tv-row-bg",
  "--tv-row-border-width",
  "--tv-row-fg",
  "--tv-row-group-",
  "--tv-row-group-padding",
  "--tv-row-group-rule",
  "--tv-row-height",
  "--tv-row-hover-opacity",
  "--tv-row-selected-edge-width",
  "--tv-rule-subtle",
  "--tv-secondary",
  "--tv-secondary-deep",
  "--tv-semantic-",
  "--tv-semantic-accent-bg",
  "--tv-semantic-accent-fg",
  "--tv-semantic-emphasis-bg",
  "--tv-semantic-emphasis-fg",
  "--tv-semantic-fg",
  "--tv-semantic-muted-bg",
  "--tv-semantic-muted-fg",
  "--tv-semantic-style",
  "--tv-semantic-weight",
  "--tv-status-",
  "--tv-status-info",
  "--tv-status-negative",
  "--tv-status-positive",
  "--tv-status-warning",
  "--tv-summary-border",
  "--tv-summary-fill",
  "--tv-surface-alt",
  "--tv-surface-muted",
  "--tv-table-border-style",
  "--tv-table-border-width",
  "--tv-text",
  "--tv-text-caption-italic",
  "--tv-text-caption-size",
  "--tv-text-caption-weight",
  "--tv-text-cell-italic",
  "--tv-text-cell-weight",
  "--tv-text-column-group-weight",
  "--tv-text-footnote-italic",
  "--tv-text-footnote-size",
  "--tv-text-footnote-weight",
  "--tv-text-header-family",
  "--tv-text-header-italic",
  "--tv-text-header-size",
  "--tv-text-header-weight",
  "--tv-text-label-family",
  "--tv-text-label-italic",
  "--tv-text-label-weight",
  "--tv-text-muted",
  "--tv-text-numeric-family",
  "--tv-text-numeric-figures",
  "--tv-text-subtitle-italic",
  "--tv-text-subtitle-size",
  "--tv-text-subtitle-weight",
  "--tv-text-tick-family",
  "--tv-text-tick-italic",
  "--tv-text-tick-weight",
  "--tv-text-title-family",
  "--tv-text-title-italic",
  "--tv-text-title-size",
  "--tv-text-title-weight",
  "--tv-title-subtitle-gap",
  "--tv-viz-margin",
  "--tv-zoom",
]);
// END AUTOGEN

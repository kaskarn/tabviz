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
  | "border-style"   // CSS line-style enum ("solid" | "double" | "none")
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

/** Which resolver realizes this token's value (wire-audit Pass 0d).
 *
 *  `resolveTokenValue` dispatches via `RESOLVERS.get(token.resolverGroup)`
 *  after a short cross-cutting pre-filter (v3-bridge skip + `token.modes`
 *  HC/RT drop/swap). One group = one ResolverFn; a token whose group has
 *  no registered resolver is a manifest bug and dev-throws at resolve
 *  time. This replaced a 15-branch waterfall that dispatched by cssVar
 *  string / kind / tier interception, where a mis-tagged token silently
 *  fell through to the wrong branch. */
export type ResolverGroup =
  | "role"        // read resolved.roles[source.role]
  | "anchor"      // pickAnchorHex + status fallback
  | "ramp-direct" // unwalked ramp[grade] reads (W4 recipe ports)
  | "header-active" // active header trio by inputs.header_style (W4)
  | "first-col"   // first-column treatment by inputs.first_column_style (W4)
  | "borders"     // the 11 border tokens from resolveBorders (W4 finale)
  | "density"     // density-table px lookup (spacing-px / border-width)
  | "geometry"    // inputs.geometry radius/border-width projection
  | "effects"     // glow / shell-gradient / emphasis-shadow from ramps
  | "typography"  // --tv-text-{role}-{prop} via type-role table
  | "shell-paper" // resolveShellPaper projection
  | "texture"     // texture line/dot colors from neutral ramp
  | "knockout"    // premixed text-knockout backgrounds
  | "hc-fidelity" // mode-dependent VALUE substitution (caret/ring/bar)
  | "browser-fx"  // brand-gradient / glow-brand-color
  | "glass"       // glass pane tokens — polarity + paper-hue aware (5a)
  | "const"       // literal constants
  | "live-config"; // realized by computeLiveConfigVars (blob fields that
                   // deliberately STAY on the wire: series slot 0, layout)

/** Per-mode behavior applied at resolve time. The resolver consults this
 *  field when computing each token's value under HC or RT modes. */
export type ModeBehavior = {
  /** HC mode: drop fill to transparent, or swap to a different role. */
  hc?: "drop" | { swap: RoleName };
  /** RT mode: drop alpha to transparent, or swap translucent → solid. */
  rt?: "drop" | { swap: RoleName };
};

// ── Component model (W6 substrate — docs/dev/component-model.md) ───────────

/** Table region a component belongs to. Drives the components-page
 *  grouping (Stage 2) and introspection. `frame` components join when the
 *  v3 theme-css bridges retire (W4) — their tokens are bridge-realized
 *  today and a re-route would silently not paint. */
export type ComponentRegion = "header" | "rows" | "plot" | "frame" | "captions";

/** Component states. `base` is the implied default; rows add interaction/
 *  paint states; the header's three style variants are modeled as states
 *  (the active one follows `header_style`). Sparse — most components
 *  define only `base`. */
export type ComponentStateName =
  | "base" | "alt" | "hover" | "selected"
  | "emphasis" | "muted" | "accent" // paint-tool states (rows/cells)
  | "light" | "tint" | "fill";      // header style variants

/** Typed channels. Color channels (`col` text/fg, `bg` fill, `bar` marker,
 *  `rule` stroke) take a Tier-2 color role name; type channels take the
 *  typography slot vocabulary (family/size/weight). Border `width`/`style`
 *  and decorative channels land with their resolvers (Stages 3–4 + W4). */
export type ComponentChannelName =
  | "col" | "bg" | "bar" | "rule"
  | "family" | "size" | "weight";

/** A manifest token's place in the component model: this token IS
 *  component X's channel Y in state Z. The `components` wire block
 *  re-routes by addressing this triple; `COMPONENT_ROSTER`
 *  (component-bindings.ts) derives from these annotations. Only annotate
 *  tokens whose resolver honors a re-route (role + typography groups) —
 *  the honesty rule: never an editable channel nothing reads. */
export interface ComponentTokenBinding {
  readonly region: ComponentRegion;
  readonly component: string;
  readonly channel: ComponentChannelName;
  /** Defaults to "base". */
  readonly state?: ComponentStateName;
}

/** True for manifest entries realized by computeLiveConfigVars (live
 *  blob config — series slot 0, layout) rather than the v4 cascade. The
 *  resolver short-circuits them to a sentinel the emitters skip; the
 *  live-config overlay supplies the real value. (The v3-bridge
 *  machinery this replaced was deleted at the W4 finale, 2026-06-11.) */
export function isLiveConfigToken(token: ComponentToken): boolean {
  return token.resolverGroup === "live-config";
}

/** One entry in the manifest. */
export interface ComponentToken {
  /** CSS variable name emitted into the scope's inline style. */
  readonly cssVar: string;
  /** What this token paints/scales/sizes. */
  readonly kind: TokenKind;
  /** Which resolver realizes the value (see ResolverGroup). Required:
   *  a token whose group has no registered ResolverFn dev-throws at
   *  resolve time (the Pass 0d guarantee — no silent mis-routing). */
  readonly resolverGroup: ResolverGroup;
  /** Provenance — where the resolved value comes from. */
  readonly source: TokenSource;
  /** Consumer file paths (relative to srcjs/src/). The drift gate enforces
   *  that every cssVar referenced by a consumer is declared here. */
  readonly consumedBy: readonly string[];
  /** Optional: per-mode behavior. */
  readonly modes?: ModeBehavior;
  /** Optional: this token's (component, state, channel) address in the
   *  component model (W6). See ComponentTokenBinding. */
  readonly binding?: ComponentTokenBinding;
  /** Optional: short human-readable description for the Inspector. */
  readonly description?: string;
  // DEFERRED (theme-rework): `dtcgPath` (DTCG token path) and `pinnable`
  // (public/private classification gating raw setPin + wire-import) were
  // scoped to Wave 0 in the plan but are NOT yet declared here — they land
  // with their consumers, NOT as empty scaffolding (ecosystem-lens review):
  //   - `pinnable` → Wave 3, when the scale-role layer reclassifies which
  //     tokens are user-pinnable vs internal (closes the two-ingress pin
  //     gap: parseThemeWire / theme_from_wire currently validate grammar +
  //     `--tv-` prefix but not pinnability).
  //   - `dtcgPath` → Wave 4, when the DTCG adapter needs the explicit token
  //     path. The alias NAMES (lib/theme/alias.ts) are already the shared
  //     namespace; `dtcgPath` only makes the per-token path declarative.
}

// ============================================================================
// THE MANIFEST
// Organized by cluster with cluster-divider comments per Q-P1.5 closure.
// ============================================================================
export const COMPONENT_TOKENS: readonly ComponentToken[] = [

  // ── Row state ──────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-row-base-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "surface" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    binding: { region: "rows", component: "row", channel: "bg" },
    description: "Default row background fill",
  },
  {
    cssVar: "--tv-row-base-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    binding: { region: "rows", component: "row", channel: "col" },
    description: "Default row foreground (text) color",
  },
  {
    cssVar: "--tv-row-alt-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "surface-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    binding: { region: "rows", component: "row", channel: "bg", state: "alt" },
    description: "Alternating (zebra) row background fill",
  },
  {
    cssVar: "--tv-row-hover-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "fill-hover" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    binding: { region: "rows", component: "row", channel: "bg", state: "hover" },
    description: "Row background on pointer hover (browser only)",
  },
  {
    cssVar: "--tv-row-selected-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "fill-active" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    binding: { region: "rows", component: "row", channel: "bg", state: "selected" },
    description: "Row background when row is selected",
  },
  {
    cssVar: "--tv-row-emphasis-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "highlight-bg" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte", "lib/semantic-styling.ts"],
    modes: { hc: "drop", rt: { swap: "fill-hover" } },
    binding: { region: "rows", component: "row", channel: "bg", state: "emphasis" },
    description: "Highlighted row background (paint-tool emphasis token)",
  },
  {
    cssVar: "--tv-row-emphasis-bar",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "highlight-bar" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    binding: { region: "rows", component: "row", channel: "bar", state: "emphasis" },
    description: "Vertical bar marker on highlighted rows (visible in HC even when wash drops)",
  },
  {
    cssVar: "--tv-row-emphasis-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    binding: { region: "rows", component: "row", channel: "col", state: "emphasis" },
    description: "Highlighted row foreground (text) color",
  },

  // ── Cell ───────────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-cell-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    binding: { region: "rows", component: "cell", channel: "col" },
    description: "Cell text foreground color",
  },
  {
    cssVar: "--tv-cell-border",
    resolverGroup: "role",
    kind: "paint-stroke",
    source: { tier: "role", role: "border-subtle" },
    consumedBy: ["export/svg-generator.ts"],
    binding: { region: "rows", component: "cell", channel: "rule" },
    description: "Cell horizontal divider color",
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-header-light-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "surface" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    binding: { region: "header", component: "header-cell", channel: "bg", state: "light" },
    description: "Column header background under data-head-style=\"light\"",
  },
  {
    cssVar: "--tv-header-light-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    binding: { region: "header", component: "header-cell", channel: "col", state: "light" },
    description: "Column header text under data-head-style=\"light\"",
  },
  {
    cssVar: "--tv-header-light-rule",
    resolverGroup: "role",
    kind: "paint-stroke",
    source: { tier: "role", role: "border-strong" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    binding: { region: "header", component: "header-cell", channel: "rule", state: "light" },
    description: "Bottom rule under column headers under data-head-style=\"light\"",
  },
  {
    cssVar: "--tv-header-tint-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "fill" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    binding: { region: "header", component: "header-cell", channel: "bg", state: "tint" },
    description: "Column header background under data-head-style=\"tint\"",
  },
  {
    cssVar: "--tv-header-tint-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    binding: { region: "header", component: "header-cell", channel: "col", state: "tint" },
    description: "Column header text under data-head-style=\"tint\"",
  },
  {
    cssVar: "--tv-header-fill-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "brand-solid" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    binding: { region: "header", component: "header-cell", channel: "bg", state: "fill" },
    description: "Column header background under data-head-style=\"fill\"",
  },
  {
    cssVar: "--tv-header-fill-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text-onsolid" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    binding: { region: "header", component: "header-cell", channel: "col", state: "fill" },
    description: "Column header text under data-head-style=\"fill\" (computed contrast pick on brand)",
  },

  // ── Plot scaffold ──────────────────────────────────────────────────────────
  {
    cssVar: "--tv-plot-axis-line",
    resolverGroup: "role",
    kind: "paint-stroke",
    source: { tier: "role", role: "border-strong" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte", "stores/slices/axis.svelte.ts"],
    binding: { region: "plot", component: "axis-line", channel: "col" },
    description: "Plot axis line color",
  },
  {
    cssVar: "--tv-plot-tick-mark",
    resolverGroup: "role",
    kind: "paint-stroke",
    source: { tier: "role", role: "border-strong" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte"],
    binding: { region: "plot", component: "axis-tick", channel: "col" },
    description: "Plot tick mark color",
  },
  {
    cssVar: "--tv-plot-tick-mark-length",
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "computed", note: "density-driven" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte", "stores/slices/axis.svelte.ts"],
    description: "Length of axis tick marks (px)",
  },
  {
    cssVar: "--tv-plot-line-width",
    resolverGroup: "density",
    kind: "border-width",
    source: { tier: "computed", note: "density-driven; default 1.5px" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte"],
    description: "Default line width for plot strokes (px)",
  },
  {
    cssVar: "--tv-plot-point-size",
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "computed", note: "density-driven; default 6px" },
    consumedBy: ["export/svg-generator.ts", "components/forest/EffectAxis.svelte"],
    description: "Default marker point diameter (px)",
  },

  // ── Spacing ────────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-spacing-row-height",
    resolverGroup: "density",
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
    resolverGroup: "density",
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
    resolverGroup: "density",
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
    resolverGroup: "density",
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
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "const", note: "0 in v3; reserved for future density extensions" },
    consumedBy: ["export/svg-generator.ts"],
    description: "Vertical cell padding (deprecated/reserved)",
  },
  {
    cssVar: "--tv-spacing-axis-gap",
    resolverGroup: "density",
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
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Padding inside a column group (px)",
  },
  {
    cssVar: "--tv-spacing-row-group-padding",
    resolverGroup: "density",
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
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Gap inside the header region (px)",
  },
  {
    cssVar: "--tv-spacing-footer-gap",
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Gap inside the footer region (px)",
  },
  {
    cssVar: "--tv-spacing-title-subtitle-gap",
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Gap between title and subtitle in header (px)",
  },
  {
    cssVar: "--tv-spacing-bottom-margin",
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Bottom margin below content (px)",
  },
  {
    cssVar: "--tv-spacing-indent-per-level",
    resolverGroup: "density",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Hierarchical indent step (px per nesting level)",
  },
  {
    cssVar: "--tv-spacing-container-padding",
    resolverGroup: "density",
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
    resolverGroup: "role",
    kind: "paint-color",
    // D18 REVERSED (maintainer, 2026-06-15): the title defaults to the BRAND
    // scale (`brand-text` — the contrast-safe brand-colored text role), not
    // neutral `text`. A chromatic title reads as the figure's identity; the
    // neutral default looked unbranded. Themes that want a neutral title
    // re-route the other way: set_component("title", col = "text").
    source: { tier: "role", role: "brand-text" },
    consumedBy: ["export/svg-generator.ts", "components/forest/PlotHeader.svelte"],
    binding: { region: "captions", component: "title", channel: "col" },
    description: "Plot title text color",
  },
  {
    cssVar: "--tv-text-footnote-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    binding: { region: "captions", component: "footnote", channel: "col" },
    description: "Footnote text color",
  },

  // ── Stage 2 §2 — Shell/paper two-surface model ────────────────────────────
  // Tier-3 tokens emitted by the resolver based on inputs.shell_mode.
  // Five per surface: bg, border, shadow, radius, padding.
  {
    cssVar: "--tv-shell-bg",
    resolverGroup: "shell-paper",
    kind: "paint-fill",
    source: { tier: "computed", note: "shell/paper: shell.bg per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell (outer chrome) background. Resolves per shell_mode.",
  },
  {
    cssVar: "--tv-shell-border",
    resolverGroup: "shell-paper",
    kind: "paint-color",
    source: { tier: "computed", note: "shell/paper: shell.border per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell border color. Resolves per shell_mode.",
  },
  {
    cssVar: "--tv-shell-shadow",
    resolverGroup: "shell-paper",
    kind: "paint-color",
    source: { tier: "computed", note: "shell/paper: shell.shadow per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell box-shadow declaration (full CSS shadow string).",
  },
  {
    cssVar: "--tv-shell-radius",
    resolverGroup: "shell-paper",
    kind: "spacing-px",
    source: { tier: "computed", note: "shell/paper: shell radius per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell border-radius (px).",
  },
  {
    cssVar: "--tv-shell-padding",
    resolverGroup: "shell-paper",
    kind: "spacing-px",
    source: { tier: "computed", note: "shell/paper: shell padding per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Shell inner padding (px).",
  },
  {
    cssVar: "--tv-paper-bg",
    resolverGroup: "shell-paper",
    kind: "paint-fill",
    source: { tier: "computed", note: "shell/paper: paper.bg per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper (inner data card) background. Resolves per shell_mode.",
  },
  {
    cssVar: "--tv-paper-border",
    resolverGroup: "shell-paper",
    kind: "paint-color",
    source: { tier: "computed", note: "shell/paper: paper.border per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper border color.",
  },
  {
    cssVar: "--tv-paper-shadow",
    resolverGroup: "shell-paper",
    kind: "paint-color",
    source: { tier: "computed", note: "shell/paper: paper.shadow per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper box-shadow declaration.",
  },
  {
    cssVar: "--tv-paper-radius",
    resolverGroup: "shell-paper",
    kind: "spacing-px",
    source: { tier: "computed", note: "shell/paper: paper radius per shell_mode" },
    consumedBy: ["svelte/TabvizPlot.svelte", "lib/theme/theme-runtime.css"],
    description: "Paper border-radius (px).",
  },
  {
    cssVar: "--tv-paper-padding",
    resolverGroup: "shell-paper",
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
    resolverGroup: "browser-fx",
    kind: "paint-fill",
    source: { tier: "computed", note: "brand gradient: brand → brand-deep" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Brand gradient stop pair (CSS linear-gradient or SVG <linearGradient>)",
  },
  {
    cssVar: "--tv-glow-brand-color",
    resolverGroup: "browser-fx",
    kind: "paint-color",
    source: { tier: "computed", note: "brand glow: accent @ alpha 0.4" },
    consumedBy: ["lib/theme/theme-runtime.css", "export/svg-generator.ts"],
    description: "Brand glow color for box-shadow / SVG <filter> emit",
  },
  {
    cssVar: "--tv-glass-blur",
    resolverGroup: "glass",
    kind: "spacing-px",
    source: { tier: "computed", note: "glass blur radius — polarity-aware (dark 30 / light 22 / off 0)" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Glass backdrop-filter blur radius (input-driven per 0d-iii)",
  },
  // ── Glass pane cluster (wire-audit 5a-5c; C18 enumeration) ──────────────
  // Every value branches on polarity and threads paper.H (C59).
  {
    cssVar: "--tv-glass-tint",
    resolverGroup: "glass",
    kind: "paint-fill",
    source: { tier: "computed", note: "glass pane base tint" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Frosted pane background tint",
  },
  {
    cssVar: "--tv-glass-faint",
    resolverGroup: "glass",
    kind: "paint-stroke",
    source: { tier: "computed", note: "glass inner hairline" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Inner 1px hairline of the bevel stack",
  },
  {
    cssVar: "--tv-glass-edge-hi",
    resolverGroup: "glass",
    kind: "paint-stroke",
    source: { tier: "computed", note: "glass top specular edge" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Top specular highlight of the bevel stack",
  },
  {
    cssVar: "--tv-glass-edge-lo",
    resolverGroup: "glass",
    kind: "paint-stroke",
    source: { tier: "computed", note: "glass bottom thickness edge" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Bottom thickness shade of the bevel stack",
  },
  {
    cssVar: "--tv-glass-sheen",
    resolverGroup: "glass",
    kind: "paint-color",
    source: { tier: "computed", note: "148deg diagonal sheen color" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Diagonal specular sheen (::before, two gradients)",
  },
  {
    cssVar: "--tv-glass-shadow",
    resolverGroup: "glass",
    kind: "shadow",
    source: { tier: "computed", note: "glass float drop shadow" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Floating drop shadow of the glass pane",
  },
  {
    cssVar: "--tv-glass-backdrop-blobs",
    resolverGroup: "glass",
    kind: "paint-fill",
    source: { tier: "computed", note: "aurora borealis blob layer (3 radials from brand/accent peaks)" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Backdrop blob layer behind the pane (aurora variant)",
  },

  // ── Stage 2 §3 — Surface texture color tokens ─────────────────────────────
  // Two color knobs drive all four textures (ruled / grid / dotted / grain).
  // The selector + recipe live in theme-runtime.css; the colors come from
  // the resolver tied to neutral grades. SHELL-ONLY since the spacing
  // rework (2026-06-05): the shell wraps the whole figure, so the texture
  // always lives on it; the paper-side texture twins and the
  // data-paper-texture fallthrough were deleted. (Their old consumedBy
  // also claimed svg-generator.ts — false; texture is browser-only per
  // D11 and the SVG pattern helpers had no consumers.)
  {
    cssVar: "--tv-shell-texture-line",
    resolverGroup: "texture",
    kind: "paint-color",
    source: { tier: "computed", note: "texture: faint hairline (neutral grade ~3)" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Texture line color (ruled / grid). Faint hairline on the surface.",
  },
  {
    cssVar: "--tv-shell-texture-dot",
    resolverGroup: "texture",
    kind: "paint-color",
    source: { tier: "computed", note: "texture: dot color (dotted / grain). Slightly stronger than line." },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Texture dot color (dotted / grain). Slightly stronger than line.",
  },

  // ── Stage 2 §4 — Texture knockout token ───────────────────────────────────
  // When text sits over a ruled / grid / dotted texture, the texture lines
  // pass through glyphs and hurt legibility. Knockout = a faint pad behind
  // the text that hides ~78% of the texture without erasing it entirely.
  // Shell-side only (caption/footer text sits on the shell post-rework).
  {
    cssVar: "--tv-shell-text-knockout-bg",
    resolverGroup: "knockout",
    kind: "paint-fill",
    source: { tier: "computed", note: "knockout: the surface color at full strength (hides texture lines, tonally invisible)" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Premixed knockout pad behind text on textured shell surfaces",
  },

  // ── Stage 2 §6 — Elevation shadow color tokens ────────────────────────────
  // Hue-aware shadow colors derived from the paper bg's hue mixed with
  // black. Browser CSS uses them in box-shadow; SVG export uses them as
  // <feFlood flood-color> inside <filter> definitions. Same value, both
  // surfaces — the parity guarantee.

  // ── Stage 2 — Typography Tier 3 (family/size/weight per role) ────────────
  // 9 type roles × 3 properties = 27 entries. Sourced from typography-
  // tier-1 inputs via the resolver's resolveTypeRole() walker. Consumers:
  //   font-family: var(--tv-text-title-family);
  //   font-size:   var(--tv-text-title-size);
  //   font-weight: var(--tv-text-title-weight);
  // (lh/track/font shorthand were dropped in Coh.22 — zero consumers.)
  ...buildTypographyManifestEntries(),

  // ── Header typography (derived role: body recipe, size ×1.05) ────────────
  // Real manifest entries since W4 arc 2 (2026-06-11) — previously
  // v3-bridge calc() emissions. Consumed by the DOM header CSS vars and
  // the export's header text (which used to inline the same ×1.05 math).
  {
    cssVar: "--tv-text-header-family",
    kind: "font-family",
    resolverGroup: "typography",
    source: { tier: "computed", note: "typography role:header (derived from body)" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Column-header font family (body family)",
  },
  {
    cssVar: "--tv-text-header-size",
    kind: "font-size",
    resolverGroup: "typography",
    source: { tier: "computed", note: "typography role:header (body size × 1.05)" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Column-header font size (body × 1.05)",
  },
  {
    cssVar: "--tv-text-header-weight",
    kind: "font-weight",
    resolverGroup: "typography",
    source: { tier: "computed", note: "typography role:header (body weight)" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Column-header font weight (body weight)",
  },

  {
    cssVar: "--tv-text-numeric-figures",
    kind: "font-figures",
    resolverGroup: "typography",
    source: { tier: "computed", note: "typography role:numeric figures (tabular — no authoring surface yet; Stage-3 figures channel)" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Numeric-cell font-variant-numeric (tabular figures)",
  },

  // ── Accent (engagement layer) ─────────────────────────────────────────────
  {
    cssVar: "--tv-accent",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "accent-solid" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Accent solid color (hover/selected/callout layer; engagement, not identity)",
  },
  {
    cssVar: "--tv-accent-fill",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "accent-fill" },
    // TODO: no renderer reads this yet (audit 2026-06-10 — the old
    // svg-generator claim was false). Wire a consumer or retire.
    consumedBy: [],
    description: "Accent fill (translucent wash for callout/highlight)",
  },

  // ── Status colors ────────────────────────────────────────────────────────
  // Sourced from inputs.status.X anchors via pickAnchorHex; fall back to
  // a STATUS_ANCHOR_FALLBACK palette when the input is unset.
  {
    cssVar: "--tv-caption-chip-bg",
    kind: "paint-fill",
    resolverGroup: "role",
    source: { tier: "role", role: "accent-solid" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    binding: { region: "captions", component: "caption-chip", channel: "bg" },
    description:
      "Caption chip (TABLE-N stamp) background — rubrication channel " +
      "(accent-solid; pin --tv-ink2 to override rubrication). B17/C62.",
  },
  {
    cssVar: "--tv-caption-chip-fg",
    kind: "paint-color",
    resolverGroup: "role",
    source: { tier: "role", role: "text-onsolid" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    binding: { region: "captions", component: "caption-chip", channel: "col" },
    description: "Caption chip label color (APCA-picked against the chip bg).",
  },
  {
    cssVar: "--tv-ink2",
    kind: "paint-color",
    resolverGroup: "anchor",
    source: { tier: "anchor", anchor: "accent-anchor" },
    consumedBy: ["components/table/CellPvalue.svelte"],
    description:
      "Rubrication ink — the editorial emphasis channel (significance " +
      "stars, caption chips). Defaults to accent (accent-anchor); pin " +
      "--tv-ink2 to make rubrication differ from the interaction hue.",
  },
  {
    cssVar: "--tv-status-positive",
    resolverGroup: "anchor",
    kind: "paint-color",
    source: { tier: "anchor", anchor: "status-positive" },
    consumedBy: ["svelte/TabvizPlot.svelte", "components/table/CellBadge.svelte"],
    description: "Status: positive / success color",
  },
  {
    cssVar: "--tv-status-negative",
    resolverGroup: "anchor",
    kind: "paint-color",
    source: { tier: "anchor", anchor: "status-negative" },
    consumedBy: ["svelte/TabvizPlot.svelte", "components/table/CellBadge.svelte"],
    description: "Status: negative / error color",
  },
  {
    cssVar: "--tv-status-warning",
    resolverGroup: "anchor",
    kind: "paint-color",
    source: { tier: "anchor", anchor: "status-warning" },
    consumedBy: ["svelte/TabvizPlot.svelte", "components/table/CellBadge.svelte"],
    description: "Status: warning color",
  },
  {
    cssVar: "--tv-status-info",
    resolverGroup: "anchor",
    kind: "paint-color",
    source: { tier: "anchor", anchor: "status-info" },
    consumedBy: ["svelte/TabvizPlot.svelte", "components/table/CellBadge.svelte"],
    description: "Status: info color",
  },

  // ── Cell-scope semantic paint + axis label/tick fg (W4 recipe ports) ──────
  // Were v3-bridge rows reading theme.row.* / theme.plot.*; the recipes
  // traced to exact role/anchor/ramp reads (equivalence-verified across
  // all 9 presets — w4-v3-blob-slimming.md). Cell-scope paint states are
  // component-model channels on `cell`; the row-scope siblings live on
  // `row` above.
  {
    cssVar: "--tv-semantic-emphasis-fg",
    resolverGroup: "anchor",
    kind: "paint-color",
    source: { tier: "anchor", anchor: "ink" },
    consumedBy: ["components/table/CellContent.svelte"],
    binding: { region: "rows", component: "cell", channel: "col", state: "emphasis" },
    description: "Cell-scope emphasis text color (ink anchor — the v3 recipe)",
  },
  {
    cssVar: "--tv-semantic-emphasis-bg",
    resolverGroup: "const",
    kind: "paint-fill",
    source: { tier: "const", note: "transparent (cell-scope emphasis is weight+ink, not a wash)" },
    consumedBy: ["components/table/CellContent.svelte"],
    description: "Cell-scope emphasis background (transparent)",
  },
  {
    cssVar: "--tv-semantic-muted-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["components/table/CellContent.svelte"],
    binding: { region: "rows", component: "cell", channel: "col", state: "muted" },
    description: "Cell-scope muted text color (text role; the mute reads via opacity/weight)",
  },
  {
    cssVar: "--tv-semantic-muted-bg",
    resolverGroup: "const",
    kind: "paint-fill",
    source: { tier: "const", note: "transparent" },
    consumedBy: ["components/table/CellContent.svelte"],
    description: "Cell-scope muted background (transparent)",
  },
  {
    cssVar: "--tv-semantic-accent-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "accent-solid" },
    consumedBy: ["components/table/CellContent.svelte"],
    binding: { region: "rows", component: "cell", channel: "col", state: "accent" },
    description: "Cell-scope accent text color (accent-solid role)",
  },
  {
    cssVar: "--tv-semantic-accent-bg",
    resolverGroup: "const",
    kind: "paint-fill",
    source: { tier: "const", note: "transparent" },
    consumedBy: ["components/table/CellContent.svelte"],
    description: "Cell-scope accent background (transparent)",
  },
  {
    cssVar: "--tv-axis-label-fg",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["components/forest/EffectAxis.svelte"],
    binding: { region: "plot", component: "axis-label", channel: "col" },
    description: "Axis label text color (text role — the v3 recipe)",
  },
  {
    cssVar: "--tv-axis-tick-fg",
    resolverGroup: "ramp-direct",
    kind: "paint-color",
    source: { tier: "computed", note: "ramp:neutral[10] — UNWALKED (the contrast-walked text-subtle role would shift 8 dark presets; pixel-faithful port)" },
    consumedBy: ["components/forest/EffectAxis.svelte"],
    binding: { region: "plot", component: "axis-tick-label", channel: "col" },
    description: "Axis tick-label text color (neutral grade 10, unwalked)",
  },

  // ── Pooled-summary marker (live config: series slot 0) ───────────────────
  {
    cssVar: "--tv-summary-fill",
    resolverGroup: "live-config",
    kind: "paint-fill",
    source: { tier: "computed", note: "live config: theme.series[0].fill — the slot system stays on the wire" },
    consumedBy: ["components/forest/SummaryDiamond.svelte"],
    description: "Pooled-summary diamond fill (series slot 0)",
  },
  {
    cssVar: "--tv-summary-border",
    resolverGroup: "live-config",
    kind: "paint-stroke",
    source: { tier: "computed", note: "live config: theme.series[0].stroke" },
    consumedBy: ["components/forest/SummaryDiamond.svelte"],
    description: "Pooled-summary diamond outline (series slot 0)",
  },

  {
    cssVar: "--tv-focus-ring",
    resolverGroup: "role",
    kind: "paint-stroke",
    source: { tier: "role", role: "focus-ring" },
    consumedBy: ["lib/theme/theme-runtime.css"],
    description: "Keyboard focus ring (sortable headers + focusable chrome)",
  },

  // ── Generic T2 role passthroughs (consumer migration helpers) ─────────────
  // These mirror Tier-2 roles 1:1 with no Tier-3 specialization. Consumers
  // reading e.g. theme.surface.base / theme.content.primary / theme.content.muted
  // migrate to these tokens during Phase 6.
  {
    cssVar: "--tv-surface-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "surface" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic surface background (paper). Mirrors role:surface for consumers that don't have a row/cell-specific surface need",
  },
  {
    cssVar: "--tv-surface-subtle-bg",
    resolverGroup: "role",
    kind: "paint-fill",
    source: { tier: "role", role: "surface-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Generic surface-subtle background (alt paper). Mirrors role:surface-subtle",
  },
  {
    cssVar: "--tv-text",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic primary text color. Mirrors role:text — use for body content that isn't row-specific",
  },
  {
    cssVar: "--tv-text-muted",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text-muted" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic muted/secondary text color. Mirrors role:text-muted — use for captions, secondary labels",
  },
  {
    cssVar: "--tv-text-subtle",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "text-subtle" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic subtle/tertiary text color. Mirrors role:text-subtle — use for de-emphasized labels, hints",
  },
  {
    cssVar: "--tv-border",
    resolverGroup: "role",
    kind: "paint-color",
    source: { tier: "role", role: "border" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Generic border color. Mirrors role:border",
  },
  {
    cssVar: "--tv-border-subtle",
    resolverGroup: "role",
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
    resolverGroup: "geometry",
    kind: "spacing-px",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Small corner radius — chip pills, badge ornaments. Default 2px.",
  },
  {
    cssVar: "--tv-radius-md",
    resolverGroup: "geometry",
    kind: "spacing-px",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Medium corner radius — buttons, controls. Default 6px.",
  },
  {
    cssVar: "--tv-radius-lg",
    resolverGroup: "geometry",
    kind: "spacing-px",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Large corner radius — panels, cards, paper. Default 10px.",
  },
  {
    cssVar: "--tv-radius-pill",
    resolverGroup: "geometry",
    kind: "spacing-px",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Pill radius — chips, tags. Default 999px (effectively round).",
  },

  // ── Phase D — GEOMETRY · border-width scale ───────────────────────────────
  // HC mode bumps each value by +1px to compensate for the reduced colour cue.
  {
    cssVar: "--tv-border-width-hair",
    resolverGroup: "geometry",
    kind: "border-width",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    // NO modes.hc here: a `swap` resolves to a ROLE (a color hex) — on a
    // width token that emitted "#1A1F21" as a border-width under HC and
    // the consuming rule was silently dropped (adversarial color review
    // H1). The geometry resolver's hcBump already thickens hairlines
    // under HC, which is the correct behavior.
    description: "Hairline width — gridlines, alt-row dividers. Default 0.5px.",
  },
  {
    cssVar: "--tv-border-width-thin",
    resolverGroup: "geometry",
    kind: "border-width",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Thin width — default rules. Default 1px.",
  },
  {
    cssVar: "--tv-border-width-regular",
    resolverGroup: "geometry",
    kind: "border-width",
    source: { tier: "input", input: "geometry" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Regular width — header rules + 'ruled' group rules. Default 2px.",
  },
  {
    cssVar: "--tv-border-width-thick",
    resolverGroup: "geometry",
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
    resolverGroup: "effects",
    kind: "paint-color",
    source: { tier: "computed", note: "anchor ramp grade 9 (brand or accent per inputs.effects.glow_anchor)" },
    consumedBy: ["lib/theme/theme-runtime.css", "svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Glow / box-shadow tint color. None when effects.glow_intensity = 'none'.",
  },
  {
    cssVar: "--tv-glow-blur",
    resolverGroup: "effects",
    kind: "spacing-px",
    source: { tier: "input", input: "effects" },
    consumedBy: ["lib/theme/theme-runtime.css", "svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Glow blur radius. 0 / 8px / 18px for none / subtle / neon.",
  },
  {
    cssVar: "--tv-glow-spread",
    resolverGroup: "effects",
    kind: "spacing-px",
    source: { tier: "input", input: "effects" },
    consumedBy: ["lib/theme/theme-runtime.css", "svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Glow spread. 0 / 1px / 3px for none / subtle / neon.",
  },

  // ── Phase D — EFFECTS · gradient shell ────────────────────────────────────
  // Two-stop linear gradient applied to the shell background. Stops are
  // brand[8]/accent[9] derived per intensity. HC drops; RT swaps to the
  // mid-stop solid for a usable but flat surface.
  {
    cssVar: "--tv-shell-gradient",
    resolverGroup: "effects",
    kind: "paint-fill",
    source: { tier: "computed", note: "linear-gradient from brand ramp + accent ramp per inputs.effects.gradient_shell_intensity" },
    consumedBy: ["lib/theme/theme-runtime.css", "svelte/TabvizPlot.svelte"],
    modes: { hc: "drop", rt: { swap: "surface" } },
    description: "Optional shell gradient background. 'none' when intensity = 'none'.",
  },

  // ── Phase D — EFFECTS · elevation ─────────────────────────────────────────
  // Card-style shadow stack independent of the existing shell elevation.
  // Layered (near + far) using the same shadow tokens as Stage 2 §6.
  {
    cssVar: "--tv-shadow-emphasis",
    resolverGroup: "effects",
    kind: "shadow",
    source: { tier: "computed", note: "box-shadow stack derived from inputs.effects.elevation" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    modes: { hc: "drop" },
    description: "Row-emphasis shadow (painted rows only); scales with effects.elevation. Figure-wide depth itself flows through --tv-shell-shadow / --tv-paper-shadow.",
  },

  // ── Header — active variant (#72) ─────────────────────────────────────────
  // Resolved per-theme via `activeHeaderVariant(theme)` (light/tint/fill).
  // The variant-specific header tokens above (--tv-header-light-bg etc.)
  // expose all three flavors; these "active" tokens are the chosen one
  // applied to the rendered header. Values are user-config-bridged through
  // theme-css.ts (no anchor-substrate equivalent — they pick from theme.header).
  {
    cssVar: "--tv-header-bg",
    resolverGroup: "header-active",
    kind: "paint-fill",
    source: { tier: "computed", note: "active header bg by inputs.header_style (light=surface / tint=fill / bold=brand-solid)" },
    consumedBy: ["svelte/TabvizPlot.svelte", "studio/StudioChart.svelte", "export/svg-generator.ts"],
    binding: { region: "header", component: "header-cell", channel: "bg" },
    description: "ACTIVE column-header background (style-keyed; one source with the variant tokens)",
  },
  {
    cssVar: "--tv-header-fg",
    resolverGroup: "header-active",
    kind: "paint-color",
    source: { tier: "computed", note: "active header fg by inputs.header_style (text / text-onsolid)" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    binding: { region: "header", component: "header-cell", channel: "col" },
    description: "ACTIVE column-header foreground",
  },
  {
    cssVar: "--tv-header-rule",
    resolverGroup: "header-active",
    kind: "paint-stroke",
    source: { tier: "computed", note: "active header rule (border-strong; bold = v3 mix of text-onsolid into brand[9])" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    binding: { region: "header", component: "header-cell", channel: "rule" },
    description: "ACTIVE column-header bottom rule",
  },
  {
    cssVar: "--tv-row-group-rule",
    resolverGroup: "ramp-direct",
    kind: "paint-stroke",
    source: { tier: "computed", note: "ramp:neutral[7] — the v3 rule_strong recipe, unwalked (pixel-faithful port)" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    binding: { region: "rows", component: "group-header", channel: "rule" },
    description: "Row-group header underline",
  },

  // ── First-column variant + container (#74) ────────────────────────────────
  // Driven by variants.firstColumnStyle (default/bold) selecting from
  // theme.firstColumn.{default,bold}. Container border + radius come from
  // theme.layout.{containerBorder,containerBorderRadius}.
  {
    cssVar: "--tv-first-col-bg",
    resolverGroup: "first-col",
    kind: "paint-fill",
    source: { tier: "computed", note: "first_column_style: bold = neutral[2], default = transparent" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    binding: { region: "frame", component: "first-column", channel: "bg" },
    description: "Leading (row-identifier) column background",
  },
  {
    cssVar: "--tv-first-col-fg",
    resolverGroup: "first-col",
    kind: "paint-color",
    source: { tier: "computed", note: "first_column_style: bold = ink anchor, default = inherit" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    binding: { region: "frame", component: "first-column", channel: "col" },
    description: "Leading column text color",
  },
  {
    cssVar: "--tv-first-col-weight",
    resolverGroup: "first-col",
    kind: "font-weight",
    source: { tier: "computed", note: "first_column_style: bold = 600, default = inherit" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    description: "Leading column font weight",
  },
  {
    cssVar: "--tv-first-col-rule",
    resolverGroup: "first-col",
    kind: "paint-stroke",
    source: { tier: "computed", note: "first_column_style: bold = neutral[6], default = minor divider color" },
    consumedBy: ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"],
    binding: { region: "frame", component: "first-column", channel: "rule" },
    description: "Leading column right-edge rule",
  },
  {
    cssVar: "--tv-container-border",
    resolverGroup: "live-config",
    kind: "paint-stroke",
    source: { tier: "computed", note: "live config: theme.layout.containerBorder → `1px solid var(--tv-border)` or `none`" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Outer-frame border shorthand around the chart container.",
  },
  {
    cssVar: "--tv-container-border-radius",
    resolverGroup: "live-config",
    kind: "spacing-px",
    source: { tier: "computed", note: "live config: theme.layout.containerBorderRadius" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Outer-frame border radius around the chart container.",
  },

  // ── Borders (#73) ─────────────────────────────────────────────────────────
  // Driven by theme.borders.{major,minor,table}.{color,style,thickness}
  // + theme.borders.layout. Each color/width/style is user-pinnable; the
  // emitter resolves style="double" into widened pixel thickness.
  {
    cssVar: "--tv-border-major-color",
    resolverGroup: "borders",
    kind: "paint-color",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Major (header/group) border color.",
  },
  {
    cssVar: "--tv-border-minor-color",
    resolverGroup: "borders",
    kind: "paint-color",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Minor (row) border color.",
    binding: { region: "frame", component: "cell-grid", channel: "col" },
  },
  {
    cssVar: "--tv-border-table-color",
    resolverGroup: "borders",
    kind: "paint-color",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Outer table-frame border color.",
    binding: { region: "frame", component: "table-frame", channel: "col" },
  },
  {
    cssVar: "--tv-row-border-width",
    resolverGroup: "borders",
    kind: "border-width",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Row divider width (px).",
  },
  {
    cssVar: "--tv-header-border-width",
    resolverGroup: "borders",
    kind: "border-width",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Header bottom-rule width (px).",
  },
  {
    cssVar: "--tv-group-border-width",
    resolverGroup: "borders",
    kind: "border-width",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Group separator width (px).",
  },
  {
    cssVar: "--tv-table-border-width",
    resolverGroup: "borders",
    kind: "border-width",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Outer table-frame width (px).",
  },
  {
    cssVar: "--tv-border-row-style",
    resolverGroup: "borders",
    kind: "border-style",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Row divider line-style.",
  },
  {
    cssVar: "--tv-border-col-style",
    resolverGroup: "borders",
    kind: "border-style",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Column divider line-style.",
  },
  {
    cssVar: "--tv-border-major-style",
    resolverGroup: "borders",
    kind: "border-style",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["export/svg-generator.ts", "svelte/TabvizPlot.svelte"],
    description: "Major rule line-style.",
  },
  {
    cssVar: "--tv-table-border-style",
    resolverGroup: "borders",
    kind: "border-style",
    source: { tier: "computed", note: "resolveBorders(border_preset, border, border-subtle) — lib/theme/borders.ts" },
    consumedBy: ["svelte/TabvizPlot.svelte"],
    description: "Outer table-frame line-style.",
  },
];

// ============================================================================
// TYPOGRAPHY MANIFEST GENERATOR (Stage 2)
// ============================================================================

/** Generate the 27 Tier-3 typography manifest entries (9 type roles × 3
 *  per-role properties: family/size/weight).
 *
 *  Rationalized in Coh.22: the original 10×6 = 60 surface was over-specified
 *  vs. what renderers actually read. The `heading` role had zero consumers;
 *  the `lh` / `track` / `font` props had zero consumers across all roles
 *  (they're computed inside resolveTypeRole but never surfaced as CSS that
 *  any DOM element reads). Audit: 16/60 consumed before the trim. Post-trim:
 *  16/27 consumed; the remaining 11 are intentional dense-grid headroom so
 *  adding a new typography knob to a renderer doesn't require reopening the
 *  manifest. Those 11 live in KNOWN_UNCONSUMED as the explicit
 *  TYPOGRAPHY_HEADROOM_UNCONSUMED list.
 *
 *  Sourced from `lib/theme/typography.ts::DEFAULT_TYPE_ROLES` via the
 *  resolver's resolveTypeRole walker. The `source.tier = "computed"` tag
 *  marks these as derived rather than direct-role bindings — the resolver
 *  reads typography-tier-1 inputs and produces the final values. */
function buildTypographyManifestEntries(): ComponentToken[] {
  const ROLES = [
    "title", "subtitle", "body", "numeric",
    "label", "caption", "footnote", "cell", "tick",
  ] as const;
  // Component-model addresses for the type-role tokens (W6). Each maps a
  // type role onto the table component its text actually paints; `body`
  // stays unmapped — it's the base everything inherits from (re-tune it
  // via type_roles), not a region component.
  const TYPE_ROLE_COMPONENT: Partial<Record<(typeof ROLES)[number],
    { region: ComponentRegion; component: string }>> = {
    title:    { region: "captions", component: "title" },
    subtitle: { region: "captions", component: "subtitle" },
    caption:  { region: "captions", component: "caption" },
    footnote: { region: "captions", component: "footnote" },
    label:    { region: "plot",     component: "axis-label" },
    tick:     { region: "plot",     component: "axis-tick-label" },
    cell:     { region: "rows",     component: "cell" },
    numeric:  { region: "rows",     component: "numeric-cell" },
  };
  const entries: ComponentToken[] = [];
  for (const role of ROLES) {
    const base = `--tv-text-${role}` as const;
    const consumedBy = ["svelte/TabvizPlot.svelte", "export/svg-generator.ts"];
    const comp = TYPE_ROLE_COMPONENT[role];
    const bindingFor = (channel: "family" | "size" | "weight") =>
      comp ? { binding: { ...comp, channel } } : {};
    entries.push({
      cssVar: `${base}-family`,
      kind: "font-family",
      resolverGroup: "typography",
      source: { tier: "computed", note: `typography role:${role}` },
      consumedBy,
      ...bindingFor("family"),
      description: `${role} font family stack`,
    });
    entries.push({
      cssVar: `${base}-size`,
      kind: "font-size",
      resolverGroup: "typography",
      source: { tier: "computed", note: `typography role:${role}` },
      consumedBy,
      ...bindingFor("size"),
      description: `${role} font size (px)`,
    });
    entries.push({
      cssVar: `${base}-weight`,
      kind: "font-weight",
      resolverGroup: "typography",
      source: { tier: "computed", note: `typography role:${role}` },
      consumedBy,
      ...bindingFor("weight"),
      description: `${role} font weight`,
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
  // ── Stage 2 typography — INTENTIONAL DENSE-GRID HEADROOM.
  // The typography manifest emits 9 roles × {family, size, weight} = 27
  // entries (see buildTypographyManifestEntries above + Coh.22 rationale).
  // Most are read by renderers today. The 9 below are emitted as
  // headroom: a renderer can opt into them without reopening the manifest.
  // Re-derive: every (role, prop) in the dense generator that doesn't
  // appear in a non-test consumer grep. List built 2026-06-04.
  "--tv-text-body-weight",
  "--tv-text-caption-family",
  "--tv-text-cell-family",
  "--tv-text-cell-weight",
  "--tv-text-footnote-family",
  "--tv-text-numeric-size",
  "--tv-text-numeric-weight",
  "--tv-text-subtitle-family",
  "--tv-text-tick-size",
  // ── False positives: drift regex matches bare prefixes from template
  // literals inside resolver / generator helpers. Not real references.
  "--tv-text-",
  // Phase D bare prefixes from template literals in GeometrySamples viz.
  "--tv-radius-",
  "--tv-border-width-",
  // Bare prefixes appearing inside manifest comments / drift-gate
  // burn-down notes (not actual CSS references).
  // Coherence pass — bare prefix from density-presets.ts's snakeToCssVar
  // template literal. The expanded cssVars (--tv-spacing-row-height etc.)
  // are real manifest entries; this allow-lists the literal-prefix match.
  "--tv-spacing-",

  // ── Phase D — geometry + effects (declared D2; consumers wire up in D4).
  // Shrink this block as TabvizPlot.svelte + svg-generator.ts start
  // reading the new tokens.

  // TODO(audit 2026-06-10): --tv-accent-fill has no renderer consumer yet
  // (manifest entry kept — accent wash is a designed role; wire or retire).
  "--tv-accent-fill",
  // ── Row state
  "--tv-row-selected-bg",
  // ── Cell
  // --tv-cell-fg consumed 2026-06-02 (renderUnifiedTableRow default cell fg)
  // --tv-cell-border consumed 2026-06-02 (renderDetailsPanel + axis renderers)
  // ── Header
  "--tv-header-light-rule",
  // ── Plot (axis-line + tick-mark + line-width + point-size migrated 2026-06-02)
  // ── Spacing (12 of 13 consumed 2026-06-03; cell-padding-y +
  //              container-padding remain v3-only)
  // ── Text roles (--tv-text-title-fg + --tv-text-footnote-fg consumed 2026-06-02 by renderHeader/renderFooter)
  // ── Generic T2 role passthroughs (Phase 6 migration helpers)
  // Consumed 2026-06-02: --tv-text, --tv-text-muted, --tv-text-subtle,
  //                      --tv-cell-border (used as border-subtle proxy),
  //                      --tv-surface-bg (canvas + row-banding guard)
  // Consumed 2026-06-03: --tv-border (header variant rule fallback)
  "--tv-surface-subtle-bg",

  // ── v3 LEGACY REFERENCES ──────────────────────────────────────────────────
  // The entries below are `--tv-*` references already present in v3
  // code (theme-css.ts, Svelte components, etc.) that
  // the gate detects but the v4 manifest doesn't model. They were
  // grandfathered en masse during sprint kickoff (originally 140+; burned
  // down to the residue below in the 2026-06-10 dead-code pass). As
  // consumers migrate and v3 emitters get deleted, these rows disappear.
  // Per Stage 1 §4b: shrink-only; do not add to this block.
  "--tv-actual-scale",
  "--tv-axis-height",
  // --tv-border is now a real manifest entry (see line ~695); removed
  // from the v3-legacy KNOWN_UNCONSUMED list per coherence audit §7.6.
  // The border color/style/width families (major/minor/table colors,
  // row/col/major/table styles, row/header/group/table widths) are real
  // manifest entries (#73).
  // --tv-container-border + --tv-container-border-radius are manifest entries (#74).
  // The first-col bg/fg/weight/rule vars are manifest entries (#74).
  "--tv-font-weight-bold",
  "--tv-font-weight-normal",
  // The header bg/fg/rule vars are manifest entries (#72).
  "--tv-header-font-scale",
  "--tv-header-height",
  "--tv-header-row-height",
  "--tv-hover",
  "--tv-hover-bg",
  "--tv-max-height",
  "--tv-max-width",
  // --tv-row-group-rule is a manifest entry (#72).
  "--tv-semantic-fg",
  "--tv-semantic-style",
  "--tv-semantic-weight",
  "--tv-status-",
  // The four status vars (positive/negative/warning/info) are now real
  // manifest entries. Removed from the v3-legacy grandfather list per
  // coherence audit §7.5.
  // The table-border style/width vars are manifest entries (#73).
  "--tv-viz-margin",
  "--tv-zoom",
]);
// END AUTOGEN

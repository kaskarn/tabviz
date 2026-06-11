// Column schema — single source of truth for column-type metadata.
//
// **One concept**: a ColumnSchema. Some schemas are *abstract*
// (structural, no rendering — e.g. BASE has header/align/width but
// isn't a column type users can pick). Some are *concrete* — they
// declare a wire `type`/`bucket`/`slots` and appear in the column
// picker. Both kinds compose options via `inherits` (single or
// multi-inheritance).
//
// Examples of the structure:
//   BASE     abstract — header/align/width/headerAlign/showHeader
//   SORTABLE abstract — sortable
//   TEXT     concrete, inherits [BASE, SORTABLE] — adds wrap/naText/maxChars
//   NUMERIC  concrete, inherits TEXT             — adds decimals/digits/...
//   PERCENT  concrete, inherits NUMERIC          — adds multiply/symbol
//   SPARKLINE concrete, inherits BASE            — adds height/type/color
//                                                  (no SORTABLE — array-valued)
//
// The codegen + editor walk the inherits chain to produce the
// effective option set; the wire shape stays flat per the bucket.
//
// "Schema" is this column-spec vocabulary; distinct from theme
// Tier/Cluster/Slot/Token in CLAUDE.md.

import type { ColumnType, FieldCategory, SlotSpec, ColumnSpec } from "../types";
import type { GlyphToken } from "../lib/ui-glyphs";

/**
 * UI control kinds the editor knows how to render. Each maps to one
 * primitive component (`Toggle.svelte`, `Segmented.svelte`, …).
 */
export type ControlKind =
  | "number"
  | "integer"
  | "text"
  | "toggle"
  | "segmented"
  | "slider"
  | "color"
  | "select"
  | "field"
  | "value-or-field"   // static value (typed sub-control) OR field-reference
  | "custom";

/**
 * Wire location for an option. Default `"bucket"` puts the option at
 * `column.options[<bucket>][<key>]`. `"top"` puts it at
 * `column.options[<key>]` (for legacy fields like `naText`). `"fixed"`
 * puts it as a top-level ColumnSpec property (for `width`, `align`,
 * `header`, etc.).
 */
export type WireAt = "bucket" | "top" | "fixed";

/**
 * Option category — affects editor grouping/visual treatment AND the
 * theme-side surface that may touch the option (Sprint 3+):
 *
 * - `"core"`: data-shape / behavior. The option changes *what* the
 *   column computes — decimals, scale, format string, slot field,
 *   thresholds. Theme-side surfaces (`theme.column_defaults` in
 *   Sprint 3) MUST NOT set core options; they belong to the spec
 *   author. Lives in the main accordion flow.
 * - `"styling"`: per-row visual override — bold/italic/color/bg/
 *   token/stroke/fill, MappedValue<T> references. Themes may set
 *   defaults. The editor groups these separately (own sub-section
 *   per layer, or a dedicated "Styling" panel) so authors can edit
 *   appearance without scrolling through formatting knobs.
 * - `"editor"`: presentation knob — changes how the cell LOOKS or
 *   which affordances render (axis ticks, label visibility, glyph
 *   size/shape, image height), never what the data MEANS. Themes may
 *   set defaults (e.g. "compact theme defaults to abbreviate
 *   numbers"). (Ontology review F1, 2026-06-11: the old prose claimed
 *   editor knobs "don't change the rendered cell" — contradicted by
 *   its own example and most assignments; the real boundary is
 *   data-meaning vs presentation, and `column_defaults` gating relies
 *   on exactly that boundary.)
 *
 * Sprint 1 PR 4 promoted this from advisory to enforced: every
 * concrete `OptionSpec` must carry an explicit `kind`. The drift
 * gate (`drift.test.ts`) enforces this on every new option. Future
 * theme-side enforcement (Sprint 3): `theme.column_defaults` will
 * reject writes against `kind: "core"` options.
 *
 * The distinction is presentational AND policy: same OptionSpec
 * shape, same primitives; what differs is who can author the value.
 */
export type OptionKind = "core" | "styling" | "editor";

/** Generic option metadata; control-specific extras live in optional fields. */
export interface OptionSpec<T = unknown> {
  /** Key used both on the wire and in the editor state map. */
  key: string;
  /** Editor label (sentence case). */
  label: string;
  /** Control primitive to use in the editor. */
  control: ControlKind;
  /** Default value. `null` means "no value set"; `undefined` for never-set. */
  default: T | null;
  /**
   * Option category — `"core"` (data/behavior, author-only),
   * `"styling"` (visual override, theme-defaultable), `"editor"`
   * (UI-only knob, theme-defaultable). Required on every concrete
   * option (drift gate enforces). Optional in the type to keep
   * inherited definitions ergonomic; the drift gate fills the gap.
   */
  kind?: OptionKind;
  /** Inline hint shown next to / under the field. */
  hint?: string;
  /** Wire destination override; defaults to `"bucket"`. */
  at?: WireAt;
  /** Editor-side visibility predicate evaluated against the current state. */
  visibleWhen?: (state: Record<string, unknown>) => boolean;

  // control-specific extras
  /** For `control: "segmented"` or `"select"`. */
  segments?: { value: T; label: string }[];
  /** For `control: "slider"` or `"number"` ranges. */
  range?: [number, number];
  step?: number;
  /** For `control: "field"` or `"value-or-field"` — accepted FieldCategory[]. */
  accepts?: FieldCategory[];
  /**
   * For `control: "value-or-field"` — the sub-control used to enter
   * the static value when the user picks the "static" mode. E.g. for
   * a `bold` option this would be `"toggle"`; for `color` it would
   * be `"color"`.
   */
  valueControl?: ControlKind;
  /** For `control: "custom"` — name of a registered custom component. */
  customComponent?: string;

  // validation metadata (read by R codegen; may inform a future TS validator)
  finite?: boolean;
  min?: number;
  max?: number;

  /**
   * Behavior pointer — names of behavior modules that read this option.
   * Wired in Round 2; the CI drift gate uses this to assert every
   * schema key has a registered consumer.
   */
  consumedBy?: string[];
}

/**
 * A column schema — declares an editor accordion section's worth of
 * options + the wire-shape metadata (if concrete).
 *
 * - **Abstract** schemas (`abstract: true`): structural only. They
 *   contribute options to descendants but can't be instantiated as a
 *   column type. Examples: BASE, SORTABLE. They don't have `bucket`
 *   or `type` or `slots`.
 *
 * - **Concrete** schemas: have `bucket`, `type`, `slots`. Appear in
 *   the column-picker. Examples: TEXT, NUMERIC, PERCENT.
 *
 * Inheritance is via `inherits` — a single parent key or an array of
 * parent keys (multi-inheritance). The resolver walks the DAG and
 * topo-sorts to produce the effective option list.
 */
export interface ColumnSchema {
  /** Identifier — used for inheritance, section state, codegen. */
  key: string;
  /** Editor label (accordion title + picker entry for concrete schemas). */
  label: string;
  /**
   * UI glyph token for this column type. Shown in the column-type
   * picker, the editor popover header, the column-header badge in
   * the table chrome. References the central vocabulary in
   * `src/lib/ui-glyphs.ts`. Optional on abstract schemas (they don't
   * appear in the picker); should be set on every concrete schema.
   */
  glyph?: GlyphToken;
  /** True if this schema is structural only and can't be a column type. */
  abstract?: boolean;
  /** Initial open/closed state for the accordion. Default: true. */
  defaultOpen?: boolean;
  /**
   * Parent schema key(s). Multi-inheritance is intentional — TEXT
   * inherits both BASE (layout) and SORTABLE (capability). The
   * resolver topo-sorts via the DAG.
   */
  inherits?: string | string[];
  /** Options this schema contributes. */
  options: OptionSpec[];

  // ── Concrete-only fields (omit on abstract schemas) ────────────────

  /** Wire `column.type` value. */
  type?: ColumnType;
  /**
   * Bucket on `column.options` where this type's options live (for
   * options whose `at` is `"bucket"`).
   *
   * NAMING CONVENTION (3 names, related but distinct):
   *   - `key`    — registry/schema id; ALWAYS the namespaced long form for viz
   *                (`viz_forest`, `viz_bar`, `viz_boxplot`, `viz_violin`).
   *   - `type`   — the WIRE value serialized to JSON + matched in render
   *                branches. Equals `key` for most types.
   *   - `bucket` — the camelCase echo of the wire `type`
   *                (`viz_bar` → `vizBar`), where this type's options nest.
   *
   * Two deliberate, documented exceptions (legacy, preserved — both pre-date
   * the convention and changing the wire would ripple across ~40 render sites
   * and the R↔TS parity surface for no user benefit):
   *   - forest:  key `viz_forest`, but wire type AND bucket are the short
   *              `forest` (it was the original viz type). Bucket still follows
   *              the rule relative to its own type (camelCase of `forest`).
   *   - percent: bucket `percent` even though wire type is `numeric`.
   *
   * A NEW viz/column type MUST follow the rule: pick `type`, set
   * `bucket` = camelCase(type). Don't invent a third short form.
   */
  bucket?: string;
  /** Coarse grouping for the column-type menu. */
  category?: "text" | "numeric" | "visual" | "glyph" | "viz";
  /**
   * Flex weight for multi-flex width distribution (docs/dev/multi-flex-columns.md).
   * Higher = absorbs more of the extra/deficit width when the layout reshapes;
   * the effective weight is `flexWeight × naturalWidth`. Omitted → 1 (the default
   * for text/numeric/data columns). Plots weigh high; fixed-ish glyph columns
   * (pvalue/ring/stars/icon/badge) are penalized < 1. Starter values, tunable.
   */
  flexWeight?: number;
  /**
   * Designed natural width (px) for plot columns that have NO content-natural
   * width (forest/viz fill given space). Used as the `natural` in the
   * proportional distribution. Omit for content-measured columns.
   * ⚠️ Must eventually fold in intrinsic viz text (value labels, in-plot
   * annotations) — see docs/dev/multi-flex-columns.md.
   */
  naturalWidthPx?: number;
  /** Field slots — point/lower/upper, value, etc. Existing slot system. */
  slots?: SlotSpec[];
  /** Per-schema option default overrides (e.g. percent overrides numeric's decimals=2 to 1). */
  optionOverrides?: Record<string, unknown>;
  /** Fixed (non-tweakable) column-spec values (e.g. `sortable: false` for viz). */
  fixed?: Partial<ColumnSpec>;
  /**
   * Curated rendering recipes for this schema. Each variant is a
   * named branch in the schema's renderer; picked at edit time via
   * a `variant` option (set automatically when `variants` is
   * non-empty). First entry is the default.
   *
   *   INTERVAL_SCHEMA.variants = [
   *     { id: "traditional",   label: "Traditional",
   *       description: "0.85 (0.72, 0.99) — bounds in parens" },
   *     { id: "bracket_muted", label: "Bracket, muted bounds",
   *       description: "0.85 [0.72–0.99] — bounds in brackets, secondary" },
   *     // ...
   *   ];
   */
  variants?: VariantSpec[];
  /**
   * Hide these inherited option keys from the editor. The wire shape
   * still accepts them (back-compat); they just don't appear in the
   * picker for this concrete schema. E.g. NUMERIC inherits TEXT but
   * `maxChars` makes no sense for a formatted number — list it here.
   */
  suppressedOptions?: string[];
  /**
   * Declare option keys that are mutually exclusive. The editor
   * renders them as a single switch (only one is "set" at a time);
   * R-side validators can also reference this to throw on conflict.
   *
   *   NUMERIC_SCHEMA.mutuallyExclusive = [["decimals", "digits"]];
   */
  mutuallyExclusive?: string[][];
}

/** Curated rendering recipe declared on a schema. */
export interface VariantSpec {
  /** Stable identifier; lands on `column.options.<bucket>.variant`. */
  id: string;
  /** Display label in the editor. */
  label: string;
  /** One-line description; shown as hint when this variant is hovered/selected. */
  description?: string;
  /**
   * Preview snippet shown on the variant card in the editor — a
   * small fixed sample (text or HTML-ish) demonstrating the visual
   * recipe. Pure presentation hint; not part of the wire format.
   *
   *   INTERVAL.traditional.preview   = '0.85 (0.72, 0.99)'
   *   INTERVAL.bracket_muted.preview = '0.85 [0.72–0.99]'
   *
   * If absent, the card shows the label only.
   */
  preview?: string;
  /**
   * Bucket-scoped primitive options this variant compiles to. The
   * ingest-time `compileVariants` pass copies these onto
   * `column.options.<bucket>.__resolved`; renderers read only from
   * `__resolved` and never branch on `variant` directly. The variant
   * id stays on the wire so the editor segmented control round-trips
   * (authoring intent preserved); the renderer reads primitives so
   * theme nodeRules can target structural tags without competing with
   * a second-channel dispatch (schema-sprint Phase 3).
   *
   *   INTERVAL.traditional.resolved   = { boundsLayout: "row", … }
   *   INTERVAL.bracket_muted.resolved = { boundsDelimiter: ["[", "]"], … }
   *
   * Shape is schema-specific; each schema's renderer documents what
   * it expects to find here.
   */
  resolved?: Record<string, unknown>;
}

/** The registry — populated by `columns/index.ts`. */
export type SchemaRegistry = Record<string, ColumnSchema>;

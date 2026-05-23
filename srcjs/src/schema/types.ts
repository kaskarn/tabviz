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
 * Option category — affects editor grouping/visual treatment but not
 * wire shape.
 *
 * - `"core"` (default): the option controls *what* the column does —
 *   data slots, format precision, behavioral toggles, layout. Lives
 *   in the main accordion flow.
 * - `"styling"`: pure visual override — bold/italic/color/bg/token/
 *   stroke/fill. The editor groups these separately (own sub-section
 *   per layer, or a dedicated "Styling" panel) so authors can edit
 *   appearance without scrolling through formatting knobs.
 *
 * Distinction is purely presentational. Both kinds use the same
 * OptionSpec shape and the same primitives.
 */
export type OptionKind = "core" | "styling";

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
  /** "core" (default) vs "styling" — affects editor grouping only. */
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
   * options whose `at` is `"bucket"`). For percent the bucket is
   * `"percent"` even though the wire `type` is `"numeric"` —
   * historical, preserved.
   */
  bucket?: string;
  /** Coarse grouping for the column-type menu. */
  category?: "text" | "numeric" | "visual" | "glyph" | "viz";
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
}

/** The registry — populated by `columns/index.ts`. */
export type SchemaRegistry = Record<string, ColumnSchema>;

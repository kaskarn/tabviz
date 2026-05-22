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
}

/** The registry — populated by `columns/index.ts`. */
export type SchemaRegistry = Record<string, ColumnSchema>;

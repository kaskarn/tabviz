// Column schema — single source of truth for column-type metadata.
//
// Each ColumnTypeSpec declares: which layers contribute its options,
// where on the wire each option lives, and what control the editor
// uses to surface it. The editor reads this registry to build its
// accordion sections; the codegen script reads it to emit
// `column-options.generated.ts` and `R/schema-defaults.R`.
//
// See plan: /Users/antoine/.claude/plans/encapsulated-snacking-leaf.md
//
// "Layer" is a column-schema vocabulary term distinct from the
// theme-resolution Tier / Cluster / Slot / Token in CLAUDE.md.

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
  | "custom";

/**
 * Wire location for an option. Default `"bucket"` puts the option at
 * `column.options[<bucket>][<key>]`. `"top"` puts it at
 * `column.options[<key>]` (for legacy fields like `naText`). `"fixed"`
 * puts it as a top-level ColumnSpec property (for `width`, `align`,
 * `header`, etc. — used by the layout-header layer).
 */
export type WireAt = "bucket" | "top" | "fixed";

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
  /** For `control: "field"` — which `FieldCategory[]` values are accepted. */
  accepts?: FieldCategory[];
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

/** A named, reusable bundle of options. */
export interface LayerSpec {
  /** Identifier — used in section state persistence + codegen. */
  key: string;
  /** Accordion title in the editor. */
  label: string;
  /** Options contributed by this layer. */
  options: OptionSpec[];
  /** Initial open/closed state for the accordion. Default: true. */
  defaultOpen?: boolean;
}

/** Full schema for one column type. */
export interface ColumnTypeSpec {
  /** Wire `column.type` value. */
  type: ColumnType;
  /** Editor label (presentation only). */
  label: string;
  /** Coarse grouping for the column-type menu. */
  category: "text" | "numeric" | "visual" | "glyph" | "viz";
  /**
   * Bucket on `column.options` where this type's options live (for
   * options whose `at` is `"bucket"`). For percent columns the bucket
   * is `"percent"` even though the wire `type` is `"numeric"` —
   * historical, preserved.
   */
  bucket: string;
  /**
   * Layers contributing options, root → leaf order. Listing order is
   * **inheritance order for the editor only**; wire shape is flat
   * inside the column's bucket. Lists, not trees — diamonds work
   * (the viz-axis layer is shared by 4 unrelated viz types).
   */
  layers: LayerSpec[];
  /** Field slots — point/lower/upper, value, etc. Existing slot system. */
  slots: SlotSpec[];
  /** Per-column-type defaults that override layer defaults. */
  layerOverrides?: Record<string, Record<string, unknown>>;
  /** Fixed (non-tweakable) column-spec values (e.g. `sortable: false` for viz). */
  fixed?: Partial<ColumnSpec>;
}

/** The registry — populated by `columns/index.ts`. */
export type ColumnRegistry = Record<string, ColumnTypeSpec>;

// Schema-driven column editor: type definitions + registry.
//
// Each column type registers a ColumnTypeSchema describing the slot bindings
// (data fields) and the type-specific option fields. The host component
// (ColumnEditor) composes these with COMMON_FIELDS — universal web_col args
// shared by every type — and renders the resulting list through SchemaField.
//
// Types whose UI doesn't fit a flat field list (viz_bar / viz_boxplot /
// viz_violin) declare `customRenderer` and own their slice of state. The
// host renders the named component in place of the schema-driven body.
//
// The registry is the single extension point: built-in schemas register
// themselves at module load via `registerColumnSchema()`. Future custom
// user-defined column types will register through the same API.

import type {
  ColumnSpec,
  ColumnType,
  FieldCategory,
  SlotSpec,
} from "../types";

// ────────────────────────────────────────────────────────────────────────────
// Editor state — owned by ColumnEditor, referenced by FieldDescriptor.visibleWhen
// ────────────────────────────────────────────────────────────────────────────

/** Generic per-effect record used by the viz_* custom renderers. */
export interface VizEffectRow {
  label?: string;
  color?: string;
  opacity?: string;
  value?: string;
  data?: string;
  min?: string;
  q1?: string;
  median?: string;
  q3?: string;
  max?: string;
  outliers?: string;
}

export interface EditorState {
  type: ColumnType;
  /** slot.key → field name (data binding) */
  slots: Record<string, string>;
  /** Top-level ColumnSpec fields: header, align, headerAlign, showHeader, wrap, sortable, … */
  spec: Partial<ColumnSpec>;
  /** Type-specific option bundles (ColumnSpec.options.<type>.<key>) */
  options: NonNullable<ColumnSpec["options"]>;
  /** Populated only when the active type uses a viz_* custom renderer. */
  effects?: VizEffectRow[];
  /** viz_boxplot has two data shapes (raw array vs. precomputed stats). */
  vizBoxplotMode?: "array" | "stats";
}

// ────────────────────────────────────────────────────────────────────────────
// Field descriptors
// ────────────────────────────────────────────────────────────────────────────

export type ControlKind =
  | "number"
  | "text"
  | "checkbox"
  | "color"
  | "segmented"
  | "select"
  | "field-picker"
  | "ticks-list";

export type Section = "data" | "format" | "advanced";

/**
 * Where on the spec the descriptor's value lives. `path[0]` discriminates
 * between top-level ColumnSpec fields and the options bundle:
 *  - `["spec", key]` — top-level ColumnSpec field (header, align, …).
 *  - `["options", key]` — top-level options field (e.g. options.naText).
 *  - `["options", typeKey, key]` — nested under ColumnSpec.options.<typeKey>.
 *
 * The `typeKey` for options is usually the column type, but can differ
 * (e.g. viz_bar's options live under `options.bar`, not `options.viz_bar`).
 */
export type FieldPath = readonly [string, ...string[]];

export interface SelectOption {
  label: string;
  value: string | number | boolean;
}

export interface FieldDescriptor {
  /** Stable id, unique within a schema. */
  key: string;
  label: string;
  control: ControlKind;
  section: Section;
  path: FieldPath;

  // Control-specific options. Each control kind reads only the props it cares about.
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** For "select" / "segmented". */
  options?: SelectOption[];
  /** For "field-picker": filter AvailableField by category. */
  accepts?: FieldCategory[];

  /**
   * Hide unless predicate returns true. Used for conditional fields
   * (e.g. boxplot stat slots only when mode === "stats").
   */
  visibleWhen?: (state: EditorState) => boolean;

  /**
   * Default value applied on insert. When omitted, the field is left empty
   * and absent from the emitted ColumnSpec.
   */
  defaultOnInsert?: unknown;
}

// ────────────────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────────────────

export interface ColumnTypeSchema {
  type: ColumnType;
  /** Slot bindings (data fields). Reuse SlotSpec from types/index.ts. */
  slots: SlotSpec[];
  /** Type-specific option fields. COMMON_FIELDS are prepended at render time. */
  fields: FieldDescriptor[];
  /**
   * Per-slot path overrides. The default destination for a slot value is
   * `["options", schema.type, slotKey]`. Schemas where slot keys differ
   * from option keys (range: min/max → minField/maxField) or where the
   * options bucket differs from the type name (custom → events) declare
   * paths explicitly here.
   *
   * The primary slot (slots[0]) is also written to `spec.field`; that is
   * separate from `slotPaths` and always happens.
   */
  slotPaths?: Record<string, FieldPath>;
  /**
   * Discriminator for types whose UI doesn't fit a flat field list. When set,
   * the host renders the named custom component in place of `fields` (slots
   * + COMMON_FIELDS still render around it). Currently used for viz_bar /
   * viz_boxplot / viz_violin.
   */
  customRenderer?: "viz-effects";
}

/**
 * Universal web_col() args shared by every type. Composed at render time:
 * `[...COMMON_FIELDS, ...schema.fields]`. Defined here as a placeholder
 * sentinel; the actual list is populated in column-editor-schema-builtins.ts
 * to keep this module purely structural.
 */
export const COMMON_FIELDS: FieldDescriptor[] = [];

// ────────────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────────────

const REGISTRY = new Map<ColumnType, ColumnTypeSchema>();

export function registerColumnSchema(schema: ColumnTypeSchema): void {
  REGISTRY.set(schema.type, schema);
}

export function getColumnSchema(type: ColumnType): ColumnTypeSchema | undefined {
  return REGISTRY.get(type);
}

export function listRegisteredTypes(): ColumnType[] {
  return Array.from(REGISTRY.keys());
}

/** Test-only: clear the registry. Not for production callers. */
export function _resetSchemaRegistry(): void {
  REGISTRY.clear();
}

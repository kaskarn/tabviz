// Widget banks — first-class storage for cross-cutting widget state
// (footnotes, axes, legends, ...). Each kind:
//   - has typed entries with stable ids + optional `producer` tag
//   - is author-able via tabviz() args (entries flow through the wire)
//   - is auto-populated by schema behaviors that contribute entries
//     when their column is present
//   - is auto-cleaned: removing a column removes its derived entries
//     (matched by producer id); user-authored entries (no producer)
//     persist independently.
//
// computeEffectiveBanks(spec) is the single function that returns the
// merged set: user-authored + derived. It's pure — same spec produces
// the same banks. The renderer / R-side serializer call it once per
// spec change.
//
// Side-effect lifecycle (DOM mount/unmount, event handlers, zoom/pan
// state) lives in SchemaLifecycle in render-types.ts and is wired up
// in Phase 7. Bank contributions are pure / declarative; suitable for
// stateless computation.

import type { MarkerShape, ColumnSpec, ColumnDef, ColumnGroup } from "../types";
import { getSchema, getBehaviors, allSchemaKeys } from "./extend";
import type { ColumnSchema } from "./types";

// ────────────────────────────────────────────────────────────────────
// Entry types
// ────────────────────────────────────────────────────────────────────

export interface BankEntry {
  /** Stable identifier, unique within its bank. */
  id: string;
  /**
   * Column id that produced this entry, if any. User-authored entries
   * leave this unset. Removing the producer column removes derived
   * entries; user-authored entries persist.
   */
  producer?: string;
}

export interface FootnoteEntry extends BankEntry {
  /** 1-based display number assigned at compute time. */
  index?: number;
  /** Footnote text body. */
  text: string;
  /** Optional URL — citation link, DOI, etc. */
  href?: string;
}

export interface AxisEntry extends BankEntry {
  scale: "linear" | "log";
  range: [number, number];
  label?: string;
  ticks?: number[] | null;
  gridlines?: boolean;
  /** Top, bottom, or both. */
  position?: "top" | "bottom" | "both";
  /** Color override for the axis line + ticks (raw or theme role). */
  color?: string | null;
  /**
   * Column ids that render against this axis. Empty / undefined means
   * the axis is free-standing (author-declared).
   */
  attachedTo?: string[];
  /**
   * When the parent table is split, duplicate the axis once per group
   * vs render a single shared axis below the splits.
   */
  perGroup?: boolean;
}

export interface LegendItem {
  label: string;
  color: string;
  shape?: MarkerShape;
}

export interface LegendEntry extends BankEntry {
  items: LegendItem[];
  position?: "top" | "bottom" | "right" | "left";
  /** Column ids this legend describes. */
  attachedTo?: string[];
}

/**
 * Named, pre-computed row predicate. Evaluated once at spec-build
 * (in R or TS) over the whole-table view; the renderer NEVER
 * re-evaluates. Filters / sorts in the widget operate on row indices
 * — they don't change condition values.
 *
 * Today: boolean only. The `kind` discriminator leaves room for
 * numeric / string / categorical conditions later.
 */
export interface ConditionEntry extends BankEntry {
  /** Display label (defaults to id). */
  label?: string;
  /** Discriminator — only "boolean" today. */
  kind: "boolean";
  /** Per-row values; aligned to data.rows order. */
  values: boolean[];
  /** Original rule for display + round-trip; renderer never reads. */
  ruleText?: string;
  /** UI grouping ("statistical" / "geometric" / ...). */
  category?: string;
}

// ────────────────────────────────────────────────────────────────────
// Bank container
// ────────────────────────────────────────────────────────────────────

/** Bank container on WebSpec — author-able + serialized. */
export interface WidgetBanks {
  footnotes?:  FootnoteEntry[];
  axes?:       AxisEntry[];
  legends?:    LegendEntry[];
  conditions?: ConditionEntry[];
  /** Escape hatch for plugin-introduced bank kinds. */
  custom?:     Record<string, BankEntry[]>;
}

/** Resolved banks after merging authored + derived entries. */
export interface EffectiveBanks {
  footnotes:  FootnoteEntry[];
  axes:       AxisEntry[];
  legends:    LegendEntry[];
  conditions: ConditionEntry[];
  custom:     Record<string, BankEntry[]>;
}

/** What a schema's behavior contributes when its column is present. */
export interface BankContribution {
  footnotes?:  FootnoteEntry[];
  axes?:       AxisEntry[];
  legends?:    LegendEntry[];
  conditions?: ConditionEntry[];
  custom?:     Record<string, BankEntry[]>;
}

// ────────────────────────────────────────────────────────────────────
// computeEffectiveBanks
// ────────────────────────────────────────────────────────────────────

interface SpecLike {
  banks?: WidgetBanks;
  columns: ColumnDef[];
}

/**
 * Merge author-supplied bank entries with the entries contributed by
 * each present column's schema behaviors. Pure; stateless;
 * deterministic.
 *
 * The dispatcher walks all columns (recursing into ColumnGroup
 * children), looks up each column's schema → behaviors →
 * `contributeBanks(column, spec)`, and accumulates the returned
 * entries. Contributions get the column's `id` set as `producer`
 * automatically if the behavior didn't set one.
 *
 * Numbered fields (footnote `index`) are filled in a final pass in
 * display order: user-authored entries appear first (preserving the
 * author's order), then derived entries in column-walk order.
 */
export function computeEffectiveBanks(spec: SpecLike): EffectiveBanks {
  const out: EffectiveBanks = {
    footnotes:  [...(spec.banks?.footnotes ?? [])],
    axes:       [...(spec.banks?.axes ?? [])],
    legends:    [...(spec.banks?.legends ?? [])],
    conditions: [...(spec.banks?.conditions ?? [])],
    custom:     { ...(spec.banks?.custom ?? {}) },
  };

  for (const col of walkColumns(spec.columns)) {
    // A column may match multiple schemas: built-in resolution via
    // (type, bucket-in-options), plus any user-registered schemas
    // that target the same column. Fire `contributeBanks` for each
    // matching schema so plugins can layer additive behaviors.
    for (const schema of getSchemasForColumn(col)) {
      const behaviors = getBehaviors(schema.key);
      const contributeBanks = behaviors?.contributeBanks;
      if (!contributeBanks) continue;

      const contrib = contributeBanks(col, spec as never);
      if (!contrib) continue;

      if (contrib.footnotes)  out.footnotes.push(...stampProducer(contrib.footnotes,  col.id));
      if (contrib.axes)       out.axes.push(...stampProducer(contrib.axes,            col.id));
      if (contrib.legends)    out.legends.push(...stampProducer(contrib.legends,      col.id));
      if (contrib.conditions) out.conditions.push(...stampProducer(contrib.conditions, col.id));
      if (contrib.custom) {
        for (const [k, entries] of Object.entries(contrib.custom)) {
          out.custom[k] = [...(out.custom[k] ?? []), ...stampProducer(entries, col.id)];
        }
      }
    }
  }

  // Number footnotes in walk order (author-first, derived-second).
  out.footnotes = out.footnotes.map((f, i) => ({ ...f, index: i + 1 }));

  return out;
}

/**
 * Look up a condition by id from effective banks. Returns null when
 * not found — callers (renderers) treat as "value not set" / theme
 * default.
 */
export function findCondition(
  banks: EffectiveBanks,
  name: string,
): ConditionEntry | null {
  return banks.conditions.find((c) => c.id === name || c.label === name) ?? null;
}

/**
 * Find all schemas that could own a column. A column has one PRIMARY
 * concrete schema (matched by `type` + optional `bucket-in-options`),
 * plus any user-registered schemas explicitly extending it (Phase 7
 * may formalize this further; today we just include schemas whose
 * `type` matches). Schemas are returned in registration order;
 * built-ins first.
 */
function getSchemasForColumn(col: ColumnSpec): ColumnSchema[] {
  const opts = col.options as Record<string, unknown> | undefined;
  const candidates: ColumnSchema[] = [];
  for (const key of allSchemaKeys()) {
    const s = getSchema(key);
    if (!s || s.abstract) continue;
    if (s.type !== col.type) continue;
    candidates.push(s);
  }
  if (candidates.length <= 1) return candidates;
  // Multiple concrete schemas for this wire type — disambiguate by
  // bucket-in-options. Prefer schemas whose `bucket` is a key on the
  // column's options (e.g. percent vs numeric both share type
  // "numeric" but bucket differs).
  const bucketed = candidates.filter((s) => s.bucket && opts && s.bucket in opts);
  if (bucketed.length > 0) return bucketed;
  return candidates;
}

/** Walk columns (and ColumnGroup children) yielding only ColumnSpecs. */
function* walkColumns(cols: ColumnDef[]): Generator<ColumnSpec> {
  for (const c of cols) {
    if ((c as ColumnGroup).isGroup) {
      yield* walkColumns((c as ColumnGroup).columns);
    } else {
      yield c as ColumnSpec;
    }
  }
}

/** Stamp every entry with the producer column id (unless already set). */
function stampProducer<T extends BankEntry>(entries: T[], producer: string): T[] {
  return entries.map((e) => (e.producer ? e : { ...e, producer }));
}

// ────────────────────────────────────────────────────────────────────
// Helpers for behavior authors
// ────────────────────────────────────────────────────────────────────

/** Stable id for derived entries: `{column}:{key}`. */
export function derivedId(column: string, key: string | number): string {
  return `${column}:${key}`;
}

// Column-schema introspection — the machine-readable column contract.
//
// The SCHEMA_REGISTRY already knows every column type, the options each
// accepts, each option's `kind` (core / styling / editor), default, valid
// choices, and which behaviors consume it. None of that was reachable from
// outside the engine — an R author or an LLM driver had no way to ask "what
// column types exist? what does col_pvalue accept? which options can a theme
// default?" These two pure functions expose exactly that, over the V8 bridge
// (R `list_column_types()` / `column_schema()`), so the schema becomes a
// first-class, queryable contract instead of tribal knowledge.
//
// Inheritance is resolved here directly over the static SCHEMA_REGISTRY (not
// the runtime `getSchema` registry) so the answer is identical in every
// runtime regardless of which side-effect registrations have run — the V8
// export context is the consumer that matters.

import { SCHEMA_REGISTRY } from "../schema/columns";
import type { ColumnSchema, OptionKind, OptionSpec } from "../schema/types";

/** Ancestors-first topo order of the inheritance DAG for one type, self last.
 *  Mirrors `resolveSchema` but over SCHEMA_REGISTRY so it needs no runtime
 *  registration. */
function inheritanceChain(typeKey: string): ColumnSchema[] {
  const out: ColumnSchema[] = [];
  const seen = new Set<string>();
  const emit = (key: string, stack: string[]): void => {
    if (seen.has(key)) return;
    if (stack.includes(key)) return; // defensive: ignore a cycle rather than throw
    const s = SCHEMA_REGISTRY[key];
    if (!s) return;
    const parents = Array.isArray(s.inherits) ? s.inherits : s.inherits ? [s.inherits] : [];
    for (const p of parents) emit(p, [...stack, key]);
    out.push(s);
    seen.add(key);
  };
  emit(typeKey, []);
  return out;
}

/** The effective option set for a type: every option from the chain, with the
 *  most-derived declaration winning (self overrides ancestors), and a record
 *  of which schema in the chain supplied the winning definition. */
function effectiveOptions(typeKey: string): Map<string, { opt: OptionSpec; from: string }> {
  const map = new Map<string, { opt: OptionSpec; from: string }>();
  for (const s of inheritanceChain(typeKey)) {
    for (const o of s.options ?? []) map.set(o.key, { opt: o, from: s.key });
  }
  return map;
}

export interface ColumnTypeInfo {
  /** Column `type` string (what `col_*()` emits, e.g. "pvalue"). */
  type: string;
  /** Human label from the schema. */
  label: string;
  /** UI glyph token, or null. */
  glyph: string | null;
  /** Direct parent schema key(s). */
  inherits: string[];
  /** Effective option count (own + inherited). */
  options: number;
  /** How many of those are theme-defaultable (kind styling|editor). */
  themeable: number;
}

/** Every CONCRETE (instantiable) column type with summary counts. Abstract
 *  structural schemas (BASE, SORTABLE, …) are excluded — they can't be a
 *  column type. */
export function listColumnTypes(): ColumnTypeInfo[] {
  const out: ColumnTypeInfo[] = [];
  for (const [key, s] of Object.entries(SCHEMA_REGISTRY)) {
    if (s.abstract) continue;
    const eff = effectiveOptions(key);
    let themeable = 0;
    for (const { opt } of eff.values()) {
      if (opt.kind === "styling" || opt.kind === "presentation") themeable++;
    }
    const inherits = Array.isArray(s.inherits) ? s.inherits : s.inherits ? [s.inherits] : [];
    out.push({ type: key, label: s.label, glyph: s.glyph ?? null, inherits, options: eff.size, themeable });
  }
  out.sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
  return out;
}

export interface ColumnOptionInfo {
  /** Option key (as it appears under `options.<type>.<key>`). */
  option: string;
  /** Human label. */
  label: string;
  /** core | styling | editor (undeclared → "core", the conservative default). */
  kind: OptionKind;
  /** True when a theme's `column_defaults` may set this (kind ≠ core). */
  themeable: boolean;
  /** Editor control primitive (select, color, toggle, number, …). */
  control: string;
  /** Schema default value (null when unset). */
  default: unknown;
  /** Valid choices for enum-like controls (from `segments`), else null. */
  choices: unknown[] | null;
  /** Numeric [min, max] for slider/number controls, else null. */
  range: [number, number] | null;
  /** Inline hint, or null. */
  hint: string | null;
  /** Behaviors that read this option (the drift contract), or null. */
  consumedBy: string[] | null;
  /** Which schema in the chain declares the winning definition (self or an
   *  ancestor like "base"). */
  inheritedFrom: string;
}

/** The full option contract for one column type, resolved across inheritance.
 *  Throws on an unknown type. `args.type` is the column type string. */
export function columnSchema(args: { type?: string } | string): ColumnOptionInfo[] {
  const type = typeof args === "string" ? args : args?.type;
  if (!type || !SCHEMA_REGISTRY[type]) {
    throw new Error(`columnSchema: unknown column type "${String(type)}"`);
  }
  if (SCHEMA_REGISTRY[type].abstract) {
    throw new Error(`columnSchema: "${type}" is an abstract schema, not a column type`);
  }
  const rows: ColumnOptionInfo[] = [];
  for (const [key, { opt, from }] of effectiveOptions(type)) {
    const kind = (opt.kind ?? "core") as OptionKind;
    const choices = opt.segments ? opt.segments.map((s) => s.value) : null;
    rows.push({
      option: key,
      label: opt.label,
      kind,
      themeable: kind !== "core",
      control: opt.control,
      default: opt.default ?? null,
      choices,
      range: opt.range ?? null,
      hint: opt.hint ?? null,
      consumedBy: opt.consumedBy ?? null,
      inheritedFrom: from,
    });
  }
  rows.sort((a, b) => (a.option < b.option ? -1 : a.option > b.option ? 1 : 0));
  return rows;
}

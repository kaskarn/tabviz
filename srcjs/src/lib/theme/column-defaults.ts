// Theme-as-house-style: apply a theme's per-column-TYPE default options.
//
// The maintainer's goal (2026-06-09): "a clinical theme makes p-value columns
// show stars by default." A theme declares `column_defaults` (ThemeInputs)
// keyed by column type → a partial options object; at spec construction those
// defaults merge UNDER each matching column's own options.
//
// TWO HARD RULES make this safe (so a theme can never change what the data
// MEANS or override an author's explicit choice):
//   1. DEFAULT MODE — the author always wins. A theme default fills only an
//      option the column left unset; an explicit `col_*(stars = FALSE)` is
//      never clobbered.
//   2. KIND GATE — only options whose schema `kind` is "styling" or "editor"
//      are accepted. "core" options (data/behavior — e.g. `field`, `decimals`
//      precision that changes the number shown) are dropped. An option with no
//      declared kind is treated as "core" (the conservative default), so a
//      theme can't reach an un-annotated option.

import { getSchema } from "../../schema/extend";
import type { OptionKind } from "../../schema/types";
import type { ColumnDef, WebSpec } from "../../types";

interface OptionMeta { kind: OptionKind; default: unknown }

/** Resolve every option's `kind` + schema `default` for a column type, walking
 *  the schema's inheritance chain (`inherits`). Unknown/undeclared kind →
 *  "core" (not theme-defaultable). */
function optionMetaFor(type: string): Map<string, OptionMeta> {
  const meta = new Map<string, OptionMeta>();
  const seen = new Set<string>();
  // `inherits` can be a string OR string[] (multi-parent DAG), so walk a stack.
  const stack: string[] = [type];
  while (stack.length) {
    const key = stack.pop()!;
    if (seen.has(key)) continue;
    seen.add(key);
    const schema = getSchema(key);
    if (!schema) continue;
    for (const opt of schema.options ?? []) {
      if (!meta.has(opt.key)) meta.set(opt.key, { kind: opt.kind ?? "core", default: opt.default });
    }
    const inh = schema.inherits;
    if (typeof inh === "string") stack.push(inh);
    else if (Array.isArray(inh)) stack.push(...inh);
  }
  return meta;
}

/** Shallow structural equality good enough for option values (primitives +
 *  small arrays of primitives). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return false;
}

/**
 * Merge a theme's `column_defaults` under each column's own options. Pure —
 * returns a new column list; unchanged columns are returned by reference.
 * `default` mode + kind gate (see file header).
 */
export function applyThemeColumnDefaults(
  columns: readonly ColumnDef[],
  columnDefaults: Partial<Record<string, Record<string, unknown>>> | undefined,
): ColumnDef[] {
  if (!columnDefaults || typeof columnDefaults !== "object") return [...columns];
  return columns.map((col) => {
    const c = col as ColumnDef & { type?: string; options?: Record<string, unknown> };
    const type = c.type;
    if (typeof type !== "string") return col;
    const defs = columnDefaults[type];
    if (!defs || typeof defs !== "object") return col;

    const meta = optionMetaFor(type);
    // The wire nests a column's options under its own type key:
    // `options.pvalue.stars`. Merge into that namespace.
    const existingNs = (c.options?.[type] as Record<string, unknown> | undefined) ?? {};
    const mergedNs: Record<string, unknown> = { ...existingNs };
    let changed = false;
    for (const [k, v] of Object.entries(defs)) {
      const m = meta.get(k);
      if (!m || m.kind === "core") continue;     // rule 2: never set unknown/core options
      const current = mergedNs[k];
      // Rule 1 (author wins): apply the theme default only when the column is
      // still at the SCHEMA default — i.e. the author hasn't deviated. The
      // col_* builders eager-fill defaults, so "unset" and "== schema default"
      // are indistinguishable; treating both as themeable is the standard
      // theme-default-over-schema-default precedence. An author who changed the
      // option to a NON-default value keeps it.
      const atSchemaDefault = current === undefined || current === null || sameValue(current, m.default);
      if (atSchemaDefault && !sameValue(current, v)) {
        mergedNs[k] = v;
        changed = true;
      }
    }
    if (!changed) return col;
    return { ...c, options: { ...(c.options ?? {}), [type]: mergedNs } } as ColumnDef;
  });
}

/**
 * Spec-level entry: apply `spec.theme.authoringInputs.column_defaults` to the
 * spec's columns. This is the CROSS-RUNTIME, CROSS-LANGUAGE seam — it runs at
 * every engine spec-ingest point (store `setSpec` + svg-generator export),
 * just before `compileVariants`. Because it reads the theme that already rode
 * the wire, an R-authored spec (which never runs the TS `tabviz()` builder)
 * gets the same house-style merge as a TS-authored one, with NO schema/kind
 * logic replicated R-side: R declares `column_defaults`, the TS engine applies
 * it. Pure + idempotent (re-applying is a no-op — the merged value is no
 * longer at the schema default), so it is safe on every ingest.
 */
export function applyThemeColumnDefaultsToSpec(spec: WebSpec): WebSpec {
  const cd = spec.theme?.authoringInputs?.column_defaults;
  if (!cd) return spec;
  const columns = applyThemeColumnDefaults(spec.columns, cd);
  // applyThemeColumnDefaults always returns a fresh array but reuses the
  // element ref for any unchanged column — skip the spec reallocation when
  // nothing actually moved (the common case in the hot setSpec path).
  if (columns.every((c, i) => c === spec.columns[i])) return spec;
  return { ...spec, columns };
}

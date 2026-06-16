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
//   2. KIND GATE — only options whose schema `kind` is "styling" or "presentation"
//      are accepted. "core" options (data/behavior — e.g. `field`, `decimals`
//      precision that changes the number shown) are dropped. An option with no
//      declared kind is treated as "core" (the conservative default), so a
//      theme can't reach an un-annotated option.
//   3. XSS GRAMMAR GATE — column_defaults can ride an UNTRUSTED, shareable
//      theme wire, and several styling options are colors emitted RAW into SVG
//      attributes (bar-renderer `fill="${color}"`). A string value failing the
//      shared pin grammar (isValidPinValue) is dropped at the merge below.
//
// AUTHORSHIP MODEL (D18, maintainer ruling 2026-06-11): authorship is
// DIVIDED — the theme writer (institution) is the DELEGATED half of
// authoring, the spec author (individual) the other. Themes get broad
// latitude by default; the value-equality author-wins rule below is the
// deliberate contract, not an approximation awaiting provenance marks.
// An author who fights the house style states a non-default value, and
// non-default values always win.
//
// THEME-SWITCH RE-BASE (#65, fixed 2026-06-11): the merge bakes the themed
// value INTO spec.columns, so to a later merge a prior theme's bake looks
// like an author choice. `rebaseThemeColumnDefaults` (below) undoes the OLD
// theme's bake before the new theme merges: any option whose current value
// still equals the old theme's default resets to the schema default. The
// store's setSpec runs it with the previous spec's defaults. Epsilon: an
// author who EXPLICITLY set the same value as the outgoing theme's default
// gets re-based — indistinguishable by construction, and the author can
// re-set it. Interactive `configure` is unaffected: it overlays
// columnSpecOverrides as a derived replacement and never re-triggers the
// merge.

import { getSchema } from "../../schema/extend";
import { isValidPinValue } from "./consumer-bridge";
import type { OptionKind } from "../../schema/types";
import type { ColumnDef, WebSpec } from "../../types";

interface OptionMeta { kind: OptionKind; default: unknown }

/** Memo of resolved option-meta per column type. SCHEMA_REGISTRY is static, so
 *  the walk below is pure in `type` — cache it (a spec with N same-type columns
 *  otherwise rebuilt the inheritance-DAG meta N times per ingest). */
const optionMetaCache = new Map<string, Map<string, OptionMeta>>();

/** Resolve every option's `kind` + schema `default` for a column type, walking
 *  the schema's inheritance chain (`inherits`). Unknown/undeclared kind →
 *  "core" (not theme-defaultable). */
function optionMetaFor(type: string): Map<string, OptionMeta> {
  const cached = optionMetaCache.get(type);
  if (cached) return cached;
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
  optionMetaCache.set(type, meta);
  return meta;
}

/** True when EVERY string leaf of a value (a primitive, or an array/object of
 *  them — e.g. badge.colors is a Record<string,string>) passes the shared pin
 *  grammar. A column_defaults value can ride an UNTRUSTED theme wire and some
 *  styling options reach SVG attributes raw (`fill="${color}"`), so a single
 *  hostile string ANYWHERE in the value must reject the whole value. Non-string
 *  leaves (number/bool/null) can't carry markup; functions/symbols reject. */
function valueLeavesSafe(v: unknown): boolean {
  if (typeof v === "string") return isValidPinValue(v);
  if (v === null || v === undefined || typeof v === "number" || typeof v === "boolean") {
    return true;
  }
  if (Array.isArray(v)) return v.every(valueLeavesSafe);
  if (typeof v === "object") return Object.values(v).every(valueLeavesSafe);
  return false;
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
      // Rule 3 (XSS chokepoint): column_defaults can ride an UNTRUSTED theme
      // wire, and several styling options are colors that reach SVG attributes
      // raw (e.g. bar-renderer `fill="${color}"`; badge.colors is a
      // Record<string,string> whose leaves reach fill=/stroke=). Drop the value
      // unless EVERY string leaf passes the shared pin grammar (bans <>{};" +
      // control chars), so a hostile theme can't inject an attribute/handler
      // into a SHARED exported artifact — including via a nested object/array
      // value. This is the one merge chokepoint every runtime + both languages
      // pass through.
      if (!valueLeavesSafe(v)) continue;
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
    // Variant SELECTION is themeable too, but `variant` is NOT a declared
    // OptionSpec — it's the recipe selector handled SPECIALLY everywhere (the
    // editor's variant-card picker owns it; compileVariants reads it from
    // options.<bucket>.variant; declaring it as a normal option would
    // double-render an editor control). So merge it here on the same terms:
    //   • only a DECLARED variant id (an unknown id can't select a recipe);
    //   • XSS grammar (variant ids reach nothing raw, but ride the same
    //     untrusted theme wire — gate them like every other value);
    //   • AUTHOR-WINS against the first-declared variant (the convention
    //     default `resolveVariant` falls back to), mirroring rule 1 above.
    // compileVariants (which runs AFTER this merge in every ingest path)
    // expands the selected id into options.<bucket>.__resolved.
    const schemaVariants = getSchema(type)?.variants;
    if (schemaVariants && schemaVariants.length > 0 && typeof defs.variant === "string") {
      const id = defs.variant;
      const firstId = schemaVariants[0]!.id;
      const cur = mergedNs.variant;
      const atDefault = cur === undefined || cur === null || cur === firstId;
      if (schemaVariants.some((sv) => sv.id === id) && isValidPinValue(id) && atDefault && cur !== id) {
        mergedNs.variant = id;
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
 * it. Pure, and stable under re-applying the SAME theme (the merged value is
 * no longer at the schema default, so a second pass is a no-op), so it is safe
 * on every ingest. NOTE: not stable across a theme SWITCH — see the
 * theme-switch stickiness limitation in the file header.
 */
/**
 * Undo a PREVIOUS theme's column_defaults bake (#65): for every option the
 * old theme could have themed, if the column's current value still equals
 * the OLD theme's default, reset it to the schema default — so the NEXT
 * merge sees it as themeable again. Same kind/XSS gates as the merge (a
 * value the merge could never have written is never re-based).
 */
export function rebaseThemeColumnDefaults(
  columns: readonly ColumnDef[],
  oldDefaults: Partial<Record<string, Record<string, unknown>>> | undefined,
): ColumnDef[] {
  if (!oldDefaults || typeof oldDefaults !== "object") return [...columns];
  return columns.map((col) => {
    const c = col as ColumnDef & { type?: string; options?: Record<string, unknown> };
    const type = c.type;
    if (typeof type !== "string") return col;
    const defs = oldDefaults[type];
    if (!defs || typeof defs !== "object") return col;
    const meta = optionMetaFor(type);
    const existingNs = (c.options?.[type] as Record<string, unknown> | undefined) ?? {};
    const mergedNs: Record<string, unknown> = { ...existingNs };
    let changed = false;
    for (const [k, v] of Object.entries(defs)) {
      const m = meta.get(k);
      if (!m || m.kind === "core") continue;
      if (!valueLeavesSafe(v)) continue;
      if (sameValue(mergedNs[k], v) && !sameValue(mergedNs[k], m.default)) {
        mergedNs[k] = m.default;
        changed = true;
      }
    }
    if (!changed) return col;
    return { ...c, options: { ...(c.options ?? {}), [type]: mergedNs } } as ColumnDef;
  });
}

/** Spec-level re-base + re-merge for a theme SWITCH: undo `previousDefaults`,
 *  then apply the incoming spec's own theme. The store calls this from
 *  setSpec with the outgoing spec's defaults. */
export function rebaseSpecForThemeSwitch(
  spec: WebSpec,
  previousDefaults: Partial<Record<string, Record<string, unknown>>> | undefined,
): WebSpec {
  if (!previousDefaults) return applyThemeColumnDefaultsToSpec(spec);
  const rebased = rebaseThemeColumnDefaults(spec.columns, previousDefaults);
  const next = rebased.every((c, i) => c === spec.columns[i]) ? spec : { ...spec, columns: rebased };
  return applyThemeColumnDefaultsToSpec(next);
}

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

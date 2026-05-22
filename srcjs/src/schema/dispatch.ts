// Runtime behavior dispatcher for the schema system.
//
// `dispatch(schemaKey, name)` returns a callable that:
//   - walks the inheritance chain leaf → root
//   - calls the most-specific (leaf-most) schema that defines the behavior
//   - injects a `parents` proxy so the leaf can delegate up:
//       parents["numeric"](value, opts, ctx)
//     and each ancestor likewise gets its own `parents` of its own
//     ancestors. Composition is recursive and lazy.
//
// `dispatchForColumn(col, name)` is the convenience entry point: it
// resolves the right concrete schema for a ColumnSpec (type +
// bucket-disambiguation) and forwards.
//
// Returns `undefined` when no schema in the chain implements the
// behavior, letting call sites apply their default fallback.

import type { ColumnSpec } from "../types";
import type { ColumnSchema } from "./types";
import type { SchemaBehaviors } from "./render-types";
import { getSchema, getBehaviors, allSchemaKeys } from "./extend";
import { resolveSchema } from "./resolve";

// ────────────────────────────────────────────────────────────────────
// Schema lookup from a ColumnSpec
// ────────────────────────────────────────────────────────────────────
//
// Same algorithm banks.ts uses internally: filter by wire `type`, then
// disambiguate by `bucket`-in-options. Moved here so callers outside
// banks can reuse it.

export function findSchemaForColumn(col: ColumnSpec): ColumnSchema | undefined {
  const opts = col.options as Record<string, unknown> | undefined;
  const candidates: ColumnSchema[] = [];
  for (const key of allSchemaKeys()) {
    const s = getSchema(key);
    if (!s || s.abstract) continue;
    if (s.type !== col.type) continue;
    candidates.push(s);
  }
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const bucketed = candidates.filter((s) => s.bucket && opts && s.bucket in opts);
  if (bucketed.length === 1) return bucketed[0];
  return candidates[0];
}

// ────────────────────────────────────────────────────────────────────
// Behavior dispatcher
// ────────────────────────────────────────────────────────────────────

/**
 * Strip the trailing `parents` argument from a behavior function's
 * signature. The dispatcher injects parents automatically; callers
 * pass only the leading args.
 */
type StripLast<F> = F extends (...args: [...infer A, infer _Last]) => infer R
  ? (...args: A) => R
  : never;

/**
 * `unknown[] → unknown` shape we use internally to call schema
 * behaviors without committing to a specific arity at the type level.
 * Public `dispatch` narrows back to the right signature via `StripLast`.
 */
type AnyBehaviorFn = (...args: unknown[]) => unknown;

export function dispatch<K extends keyof SchemaBehaviors>(
  schemaKey: string,
  behaviorName: K,
): StripLast<NonNullable<SchemaBehaviors[K]>> | undefined {
  const schema = getSchema(schemaKey);
  if (!schema) return undefined;

  // base-first → leaf-last
  const chain = resolveSchema(schema);

  // Find the leaf-most schema in the chain that defines this behavior.
  let leafIdx = -1;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (getBehaviors(chain[i].key)?.[behaviorName] != null) {
      leafIdx = i;
      break;
    }
  }
  if (leafIdx === -1) return undefined;

  // Recursively build a callable at index `idx`:
  //  - look up the raw fn on chain[idx]
  //  - assemble its `parents` map from all strictly older ancestors
  //    that also define this behavior, each with its own `parents`
  const buildAt = (idx: number): AnyBehaviorFn => {
    const raw = getBehaviors(chain[idx].key)?.[behaviorName] as
      | AnyBehaviorFn
      | undefined;
    if (!raw) {
      throw new Error(
        `dispatch: chain[${idx}] (${chain[idx].key}) lost its ${String(behaviorName)} behavior between lookup and build`,
      );
    }
    const parents: Record<string, AnyBehaviorFn> = {};
    for (let i = 0; i < idx; i++) {
      if (getBehaviors(chain[i].key)?.[behaviorName] != null) {
        parents[chain[i].key] = buildAt(i);
      }
    }
    return (...args: unknown[]) => raw(...args, parents);
  };

  return buildAt(leafIdx) as StripLast<NonNullable<SchemaBehaviors[K]>>;
}

/**
 * Convenience: resolve the schema for a ColumnSpec and dispatch on it.
 */
export function dispatchForColumn<K extends keyof SchemaBehaviors>(
  col: ColumnSpec,
  behaviorName: K,
): StripLast<NonNullable<SchemaBehaviors[K]>> | undefined {
  const schema = findSchemaForColumn(col);
  if (!schema) return undefined;
  return dispatch(schema.key, behaviorName);
}

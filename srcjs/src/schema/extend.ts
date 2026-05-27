// Public extension API for tabviz schemas — runtime registries.
//
// Third-party packages — or in-tree code — use these helpers to add
// new column types, register renderers, attach lifecycle hooks, and
// register type-dispatched behaviors. Standard plugin pattern: import
// the helpers, call them at module load time (typically from the
// package's entry file), and tabviz picks them up.
//
// The public surface is re-exported from `@tabviz/core/extend` (see
// `src/extend/index.ts`). The renderer + behavior dispatchers in
// `dispatch.ts` walk the inheritance chain and read from the registries
// here; lifecycle invocation lands in Phase 7 of the schema sprint.
//
//   import { defineSchema, registerColumnType, compose, tag, text }
//     from "@tabviz/core/extend";
//
//   const FANCY_RING = defineSchema({
//     key: "fancy_ring",
//     label: "Fancy Ring",
//     inherits: "ring",
//     options: [{ key: "innerRadius", control: "number", default: 0.5 }],
//   });
//
//   registerColumnType({
//     schema: FANCY_RING,
//     renderer: (val, opts, ctx, parents) => {
//       const ringSvg = parents.ring(val, opts, ctx);
//       return compose(
//         tag(ringSvg, ["fancy-ring-glyph"]),
//         tag(text(String(val)), ["fancy-ring-label", "minor"]),
//         { sep: "" },
//       );
//     },
//   });

import type { ColumnSchema } from "./types";
import type {
  CellFormatter,
  SchemaLifecycle,
  SchemaBehaviors,
  SchemaRenderers,
  RegisterSpec,
} from "./render-types";
import { SCHEMA_REGISTRY } from "./columns";

/** Which runtime a renderer targets. */
export type RenderTarget = "dom" | "svg";

// ────────────────────────────────────────────────────────────────────
// defineSchema — typed identity helper
// ────────────────────────────────────────────────────────────────────

/**
 * Typed-identity wrapper for declaring a column schema. Today's
 * schema files are const-object literals; `defineSchema` makes them
 * uniform and exportable from third-party packages, and gives TS a
 * single inference site.
 */
export function defineSchema(spec: ColumnSchema): ColumnSchema {
  return spec;
}

// ────────────────────────────────────────────────────────────────────
// Runtime registries (separate from the in-tree SCHEMA_REGISTRY const)
// ────────────────────────────────────────────────────────────────────

/**
 * Schemas registered at runtime. Read by `resolveSchema` and the
 * editor — merged with the compile-time SCHEMA_REGISTRY.
 */
const userSchemas: Record<string, ColumnSchema> = {};

/**
 * Renderer functions keyed by (target, schema key). The dispatcher
 * (`dispatchRenderer`) reads from this map.
 */
const renderers: Record<RenderTarget, Record<string, CellFormatter>> = {
  dom: {},
  svg: {},
};

/**
 * Lifecycle hooks keyed by schema key. The widget host invokes these
 * on column add/remove and widget mount/unmount (wiring lands in
 * Phase 7 of the schema sprint; the registry itself is live).
 */
const lifecycles: Record<string, SchemaLifecycle> = {};

/**
 * Behavior functions (sortKey / estimateWidth / emitSource / …) keyed
 * by schema key. The dispatcher in `dispatch.ts` walks the schema
 * inheritance chain and resolves behaviors with parent-proxy support.
 */
const behaviors: Record<string, SchemaBehaviors> = {};

// ────────────────────────────────────────────────────────────────────
// register* — runtime registration
// ────────────────────────────────────────────────────────────────────

/**
 * Add a schema to the runtime registry. Conflicts with an existing
 * key (whether built-in or already-registered) throw.
 */
export function registerSchema(schema: ColumnSchema): void {
  const k = schema.key;
  if (k in SCHEMA_REGISTRY) {
    throw new Error(`registerSchema: built-in schema "${k}" cannot be overridden`);
  }
  if (k in userSchemas) {
    throw new Error(`registerSchema: schema "${k}" already registered`);
  }
  userSchemas[k] = schema;
}

/**
 * Attach the DOM (browser) cell formatter to a registered schema.
 * Shorthand for `registerRenderers(key, { dom: fn })`. Replacing
 * a built-in renderer is allowed and intended — themes / plugins
 * may want to override default rendering.
 */
export function registerRenderer(key: string, fn: CellFormatter): void {
  registerRenderers(key, { dom: fn });
}

/**
 * Attach the DOM and/or SVG cell formatters to a registered schema.
 * Pass one or both slots. Subsequent calls merge into the existing
 * registration, so libraries can register a DOM renderer first and
 * an SVG renderer later (or vice versa).
 */
export function registerRenderers(key: string, fns: SchemaRenderers): void {
  if (!(key in SCHEMA_REGISTRY) && !(key in userSchemas)) {
    throw new Error(`registerRenderers: no schema "${key}" registered`);
  }
  if (fns.dom) renderers.dom[key] = fns.dom;
  if (fns.svg) renderers.svg[key] = fns.svg;
}

/**
 * Attach lifecycle hooks to a registered schema.
 */
export function registerLifecycle(key: string, hooks: SchemaLifecycle): void {
  if (!(key in SCHEMA_REGISTRY) && !(key in userSchemas)) {
    throw new Error(`registerLifecycle: no schema "${key}" registered`);
  }
  lifecycles[key] = hooks;
}

/**
 * Attach behavior functions (sortKey / estimateWidth / emitSource /
 * searchKey / tooltipText / aggregate) to a registered schema. Each
 * behavior can call into its parents via the parents proxy.
 */
export function registerBehaviors(key: string, fns: SchemaBehaviors): void {
  if (!(key in SCHEMA_REGISTRY) && !(key in userSchemas)) {
    throw new Error(`registerBehaviors: no schema "${key}" registered`);
  }
  // Merge — multiple registerBehaviors calls for the same key combine.
  behaviors[key] = { ...behaviors[key], ...fns };
}

/**
 * Convenience: register schema + renderer + lifecycle + behaviors in
 * one call.
 */
export function registerColumnType(spec: RegisterSpec): void {
  registerSchema(spec.schema);
  if (spec.renderer)  registerRenderer(spec.schema.key, spec.renderer);
  if (spec.renderers) registerRenderers(spec.schema.key, spec.renderers);
  if (spec.lifecycle) registerLifecycle(spec.schema.key, spec.lifecycle);
  if (spec.behaviors) registerBehaviors(spec.schema.key, spec.behaviors);
}

// ────────────────────────────────────────────────────────────────────
// Read accessors (used by the resolver / renderer / editor)
// ────────────────────────────────────────────────────────────────────

/** Combined view of built-in + user-registered schemas. */
export function getSchema(key: string): ColumnSchema | undefined {
  return SCHEMA_REGISTRY[key] ?? userSchemas[key];
}

/**
 * Look up a registered renderer. `target` defaults to `"dom"` for
 * back-compat with the original single-renderer API; `"svg"` is the
 * V8/export path.
 */
export function getRenderer(
  key: string,
  target: RenderTarget = "dom",
): CellFormatter | undefined {
  return renderers[target][key];
}

export function getLifecycle(key: string): SchemaLifecycle | undefined {
  return lifecycles[key];
}

export function getBehaviors(key: string): SchemaBehaviors | undefined {
  return behaviors[key];
}

/** All registered schema keys (built-in + user). */
export function allSchemaKeys(): string[] {
  return [...new Set([
    ...Object.keys(SCHEMA_REGISTRY),
    ...Object.keys(userSchemas),
  ])];
}

// Test-only — clears user-registered state between tests.
export function __resetRuntimeRegistries(): void {
  for (const k of Object.keys(userSchemas))    delete userSchemas[k];
  for (const k of Object.keys(renderers.dom))  delete renderers.dom[k];
  for (const k of Object.keys(renderers.svg))  delete renderers.svg[k];
  for (const k of Object.keys(lifecycles))     delete lifecycles[k];
  for (const k of Object.keys(behaviors))      delete behaviors[k];
}

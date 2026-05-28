// Component registry consumed by `RenderTree.svelte` to resolve
// `RenderComponent` nodes to actual Svelte components.
//
// Visual cell schemas register a Svelte component once at module
// load (typically alongside their schema/behaviors), then their
// `dom` renderer returns `{ kind: "component", name, props }` and
// the mounter looks the component up here.
//
// Keeping this separate from `extend.ts` (the schema registry)
// avoids a Svelte-import dependency in the schema core — schemas
// stay framework-neutral; only this file knows about Svelte.

import type { Component } from "svelte";

const components = new Map<string, Component<Record<string, unknown>>>();

/** Register a Svelte component under a name. Subsequent lookups via
 *  `<RenderTree>` mount it when a `RenderComponent` node with the
 *  same `name` appears. Re-registering replaces the prior entry. */
export function registerCellComponent(name: string, c: Component<never>): void {
  components.set(name, c as unknown as Component<Record<string, unknown>>);
}

export function getCellComponent(name: string): Component<Record<string, unknown>> | undefined {
  return components.get(name);
}

/** Test helper — clear the registry. Production code never calls this. */
export function __resetCellComponents(): void {
  components.clear();
}

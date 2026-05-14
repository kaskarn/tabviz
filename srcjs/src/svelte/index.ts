// Public Svelte subpath — re-exports the top-level components and
// store factories that npm consumers reach for under
// `@tabviz/core/svelte`. Per spec §3.3:
//
//   import { ForestPlot, createForestStore } from "@tabviz/core/svelte";
//
// The aliased subpath today (`$svelte`) maps to this directory; the
// build-time `@tabviz/core/svelte` mapping is wired up in package.json
// `exports` when Phase 3 publishes. Component implementations live as
// sibling files; the store factories live in `$stores` (see note below).

export { default as ForestPlot } from "./ForestPlot.svelte";
export { default as SplitForestPlot } from "./SplitForestPlot.svelte";

// Stores ship under the same subpath rather than a separate `$stores`
// surface — `createForestStore()` is the imperative entrypoint for
// consumers who want store-only access without mounting a component
// (e.g., custom Svelte wrappers, headless testing). They physically
// live in `src/stores/` for source-tree readability; this file is the
// publication-surface re-export.
export { createForestStore } from "$stores/forestStore.svelte";
export { createSplitForestStore } from "$stores/splitForestStore.svelte";
export type { ForestStore } from "$stores/forestStore.svelte";
export type { SplitForestStore } from "$stores/splitForestStore.svelte";

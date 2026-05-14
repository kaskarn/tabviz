// Public core subpath — re-exports the framework-agnostic factories
// that npm consumers reach for under the main `@tabviz/core` entry.
// Per spec §3.3:
//
//   import { createTabviz, createSplitTabviz } from "@tabviz/core";
//
// `createTheme` (the JS theme-resolver port, spec §0c-C5) is deferred
// to Phase 1.x; once it lands it joins this surface.

export { createTabviz } from "./createTabviz";
export { createSplitTabviz } from "./createSplitTabviz";
export type { TabvizInstance, TabvizOptions } from "./createTabviz";
export type {
  SplitTabvizInstance,
  SplitTabvizOptions,
} from "./createSplitTabviz";

// Wire-format types — consumers passing specs in need these for type
// safety. The JSON Schema in `$spec` is the authoritative wire contract.
export type {
  WebSpec,
  SplitForestPayload,
  ColumnFilter,
  SemanticToken,
  WebTheme,
  ZoomState,
  SortConfig,
} from "$types";

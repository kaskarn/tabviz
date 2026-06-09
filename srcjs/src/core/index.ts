// Public core subpath — re-exports the framework-agnostic factories
// that npm consumers reach for under the main `@tabviz/core` entry.
// Per spec §3.3:
//
//   import { createTabviz, createSplitTabviz, tabviz, colText, themeNejm } from "@tabviz/core";
//
// Runtime factories: mount a pre-built WebSpec into a DOM node.
// Authoring API (added 0.2.0): build a WebSpec programmatically. See
// `srcjs/src/authoring/` and `docs/dev/r-ts-parity-notes.md`.

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

// Authoring API — function builders mirroring R's tabviz()/col_*()/viz_*()/theme*().
export * from "../authoring";

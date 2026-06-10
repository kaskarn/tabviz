// Typed event contract — what the store emits, what listeners receive.
//
// Two roles:
//   1. `TabvizEvents` is the typed payload-per-event map consumed by
//      `createEventEmitter<TabvizEvents>()` inside the store. Consumers
//      get full type information when subscribing.
//   2. `SHINY_EVENT_FIELDS` is the snake_case wire-field list the
//      Shiny adapter forwards each event to. It's exported here (rather
//      than living in the adapter) so the R side has a single source of
//      truth to sync against — the `test-wire-version.R` doc-test asserts
//      it matches `TABVIZ_STATE_FIELDS` in R/shiny.R.
//
// Adding a new emitted dimension:
//   1. Add the event name + payload type to TabvizEvents
//   2. Add the camelCase → snake_case mapping in EVENT_TO_SHINY_FIELD
//   3. Add the snake_case name to SHINY_EVENT_FIELDS (and to R-side
//      TABVIZ_STATE_FIELDS, kept in sync by the doc-test)
//   4. Fire the event from the store (tabvizStore.svelte.ts)
//   5. Subscribe in the Shiny adapter (htmlwidgets/index.svelte.ts setupShinyBindings)

import type {
  CellEdits,
  ColumnFilter,
  RowStyle,
  CellStyle,
  SortConfig,
  ZoomState,
  SemanticToken,
} from "$types";

/** PaintTool wire shape. Inlined here because the store type for this
 *  isn't exported in $types today; can be lifted once the store's
 *  internal types graduate to the public surface in Phase 1. */
export interface PaintTool {
  token: SemanticToken;
  scope: "row" | "cell";
}

/**
 * Payload-per-event map. Used as the generic argument to
 * `createEventEmitter<TabvizEvents>()`.
 */
export type TabvizEvents = {
  // Tier 1 — core interaction
  selected: string[];
  hover: string | null;
  sort: SortConfig;
  filters: Record<string, ColumnFilter>;
  rowStyles: Record<string, Partial<RowStyle>>;
  cellStyles: Record<string, Record<string, Partial<CellStyle>>>;
  paintTool: PaintTool;
  collapsedGroups: string[];
  expandedRows: string[];
  hiddenColumns: string[];
  columnOrder: string[];
  columnWidths: Record<string, number>;
  /** Per-row-kind height pins (px) — layer 5 of the height cascade.
   *  Round-trips through `spec.figureLayout.rowKindHeights` (P1). */
  rowKindHeights: Record<string, number>;
  cellEdits: CellEdits;
  labelEdits: Record<string, string | null | undefined>;
  zoom: ZoomState;
  // Tier 2 — forest/plot-specific overrides
  axisZooms: Record<string, { min: number; max: number } | null>;
  banding: { mode: string | null; startsWithBand: boolean | null } | null;
  plotWidth: number | null;
  // Derived
  visibleRows: string[];
  // Aggregate — fires whenever any of the above does. The adapter uses
  // this to drive the debounced `_state` bundle emission. Payload is
  // void; subscribers read whatever they need from the store directly.
  change: undefined;
}

/** Type-only check that the snake_case map below covers every event. */
type EventName = keyof TabvizEvents;

/**
 * Maps each typed event name (camelCase) to its Shiny input wire name
 * (snake_case). The adapter uses this to emit
 * `setShinyInput(`${widgetId}_${EVENT_TO_SHINY_FIELD[event]}`, ...)`.
 *
 * `change` has no Shiny field of its own — the adapter consumes it
 * separately to drive the debounced `_state` bundle.
 */
export const EVENT_TO_SHINY_FIELD: Record<Exclude<EventName, "change">, string> = {
  selected: "selected",
  hover: "hover",
  sort: "sort",
  filters: "filters",
  rowStyles: "row_styles",
  cellStyles: "cell_styles",
  paintTool: "paint_tool",
  collapsedGroups: "collapsed_groups",
  expandedRows: "expanded_rows",
  hiddenColumns: "hidden_columns",
  columnOrder: "column_order",
  columnWidths: "column_widths",
  rowKindHeights: "row_kind_heights",
  cellEdits: "cell_edits",
  labelEdits: "label_edits",
  zoom: "zoom",
  axisZooms: "axis_zooms",
  banding: "banding",
  plotWidth: "plot_width",
  visibleRows: "visible_rows",
};

/**
 * Ordered list of every Shiny wire field this widget emits. **SYNC POINT
 * (spec §2.5-S13 / §4 Phase 0e-G6):** must match R-side
 * `TABVIZ_STATE_FIELDS` in `R/shiny.R`. Enforced by the doc-test in
 * `tests/testthat/test-wire-version.R`.
 *
 * Ordered by tier (matching R-side comment groupings) so the lists are
 * comparable line-by-line on drift.
 */
export const SHINY_EVENT_FIELDS = [
  // Tier 1
  "sort", "filters", "row_styles", "cell_styles", "paint_tool",
  "selected", "hover", "collapsed_groups", "expanded_rows", "hidden_columns",
  "column_order", "column_widths", "row_kind_heights", "cell_edits",
  "label_edits", "zoom",
  // Tier 2
  "axis_zooms", "banding", "plot_width",
  // Derived
  "visible_rows",
] as const;

export type ShinyEventField = (typeof SHINY_EVENT_FIELDS)[number];

# tabviz event contract

**Status:** Stable. Part of the JS API (`store.on(event, callback)`) and the Shiny adapter (each typed event forwards to a `Shiny.setInputValue` per `EVENT_TO_SHINY_FIELD`).
**Audience:** Anyone writing a Shiny dashboard that reads tabviz output, or anyone building a non-Shiny consumer of the eventual `@tabviz/core` package.

---

## At a glance

The store fires typed events whenever its observable state changes. Each event has:
- a **camelCase name** (the JS-side identifier consumers subscribe to)
- a **typed payload** (TypeScript type checked at the subscription boundary)
- a **Shiny wire field** (snake_case) when forwarded to Shiny — one input per event
- a **change** signal in the aggregate `change` event, plus appearance in the debounced `_state` bundle

Source:
- TS definitions: `srcjs/src/spec/events.ts`
- Emitter: `srcjs/src/stores/forestStore.svelte.ts` (search for `events.emit`)
- Wire-name map: `EVENT_TO_SHINY_FIELD` in `srcjs/src/spec/events.ts`
- R-side reader: `R/shiny.R` (`tabviz_state`, `tabviz_state_envelope`, `TABVIZ_STATE_FIELDS`)

---

## Events

All events fire **synchronously** from a Svelte `$effect` block in the store, triggered by the underlying `$state` they observe. No debouncing at the event level; the Shiny adapter applies a 150ms debounce only to the aggregate `_state` bundle.

### Tier 1 — core interaction

| Event | Payload | Shiny wire field | Fires when |
|---|---|---|---|
| `selected` | `string[]` (row IDs) | `selected` | Set of rows painted with the active token changes |
| `hover` | `string \| null` (row ID) | `hover` | User hovers a different row (or no row) |
| `sort` | `SortConfig` | `sort` | `store.sortBy()` is called |
| `filters` | `Record<string, ColumnFilter>` | `filters` | Multi-column filter map changes |
| `rowStyles` | `Record<string, Partial<RowStyle>>` | `row_styles` | Any row-level paint or style edit |
| `cellStyles` | `Record<string, Record<string, Partial<CellStyle>>>` | `cell_styles` | Any cell-level paint or style edit |
| `paintTool` | `{ token: SemanticToken; scope: "row" \| "cell" }` | `paint_tool` | Painter token / scope changes |
| `collapsedGroups` | `string[]` (group IDs) | `collapsed_groups` | Group expand/collapse |
| `hiddenColumns` | `string[]` (column IDs) | `hidden_columns` | Hide/show column |
| `columnOrder` | `string[]` (column IDs in display order) | `column_order` | Drag-reorder column or `setColumnOrder` |
| `columnWidths` | `Record<string, number>` | `column_widths` | Column resize |
| `cellEdits` | `CellEdits` | `cell_edits` | Cell value edit |
| `labelEdits` | `Record<string, string>` | `label_edits` | Plot title/subtitle/caption/footnote edit |
| `zoom` | `ZoomState` (zoom + autoFit + maxWidth + maxHeight + showZoomControls) | `zoom` | Any zoom-related setter |

### Tier 2 — forest/plot overrides

| Event | Payload | Shiny wire field | Fires when |
|---|---|---|---|
| `axisZooms` | `Record<string, { min: number; max: number } \| null>` | `axis_zooms` | Per-axis zoom in a multi-axis forest |
| `banding` | `{ mode: string \| null; startsWithBand: boolean \| null } \| null` | `banding` | Banding override changes (settings panel) |
| `plotWidth` | `number \| null` | `plot_width` | Plot-width drag override |

### Derived

| Event | Payload | Shiny wire field | Fires when |
|---|---|---|---|
| `visibleRows` | `string[]` (row IDs in display order, post sort+filter+collapse) | `visible_rows` | Any of `sort`, `filters`, `collapsedGroups`, or row reorder changes |

### Aggregate

| Event | Payload | Shiny wire field | Fires when |
|---|---|---|---|
| `change` | `undefined` | (drives the 150ms debounced `_state` bundle, not a single field) | Any of the above events fires |

---

## Shiny wire format

Each event becomes one `Shiny.setInputValue(`${widgetId}_${field}`, envelope)` call where `envelope` is the `ShinyEnvelope<T>` shape:

```ts
interface ShinyEnvelope<T = unknown> {
  value: T;             // the typed payload
  source: "user" | "proxy";  // provenance — see docs/dev/source-tagging.md
  ts: number;           // epoch ms at emission
}
```

See `docs/dev/source-tagging.md` for the full source-tag contract and rationale.

### The aggregate `_state` bundle

The Shiny adapter listens to `change` and (after 150ms of inactivity) emits one combined input:

```
input$<widgetId>_state = ShinyEnvelope<{
  sort, filters, row_styles, cell_styles, paint_tool, selected,
  collapsed_groups, hidden_columns, column_order, column_widths,
  cell_edits, label_edits, zoom, axis_zooms, banding, plot_width
}>
```

Field names use snake_case (matching the individual wire fields) and values come from the current store state at flush time, not from the events. This means the bundle is always a consistent snapshot — there's no risk of stale fields mixing with fresh ones.

---

## R-side consumers

Two helpers in `R/shiny.R`:

| Helper | Use |
|---|---|
| `tabviz::tabviz_state(input, id)` | Named list of `value`s only — no envelope metadata. Suitable when you don't need provenance. |
| `tabviz::tabviz_state_envelope(input, id)` | Named list of full envelopes including `source` and `ts`. Required when filtering feedback loops (`if (envelope$source == "user") ...`). |

Both read from the `TABVIZ_STATE_FIELDS` constant in `R/shiny.R`. **This list is the load-bearing R↔JS sync point** (spec §2.5-G6). A test in `tests/testthat/test-wire-version.R` reads `SHINY_EVENT_FIELDS` from `srcjs/src/spec/events.ts` and asserts the lists match.

---

## Subscribing from non-Shiny consumers

When the eventual `@tabviz/core` ships (Phase 3), JS consumers subscribe directly:

```ts
const instance = createTabviz(element, spec);
instance.on("selected", (rowIds) => { /* ... */ });
instance.on("change", () => {
  // For non-Shiny consumers who want batched state — read the
  // current state from the instance whenever change fires, or
  // debounce yourself.
});
```

The payload types are exported from `@tabviz/core/spec` (the `TabvizEvents` interface in `events.ts`) so consumers get full type checking.

---

## Adding a new event

Order matters — every step blocks the next:

1. Add the camelCase name + typed payload to `TabvizEvents` in `srcjs/src/spec/events.ts`.
2. Add the camelCase → snake_case mapping to `EVENT_TO_SHINY_FIELD`.
3. Add the snake_case wire-field name to `SHINY_EVENT_FIELDS`.
4. Update R-side `TABVIZ_STATE_FIELDS` in `R/shiny.R` to match (the sync test will fail until this is done).
5. Fire the event from the store (`forestStore.svelte.ts`, add a `$effect` in the emitter block).
6. Subscribe in the Shiny adapter (`index.svelte.ts::setupShinyBindings`) — the existing `store.on(event, value => emit(EVENT_TO_SHINY_FIELD.event, value))` pattern.
7. Update this doc.

---

## What this contract does NOT cover

- **Method calls** on the store/instance (sort, filter, hide, edit, paint) — those are the *proxy method* contract; see `$spec/proxy-args.ts` for the typed interface and `docs/dev/source-tagging.md` for the `source: "proxy"` tag that proxy-driven mutations carry.
- **Spec changes** from R via `renderValue` (htmlwidget) or `update_data()` (proxy) — those don't fire individual events; they cause every event to potentially re-fire based on the new state.
- **Internal `$effect` runs** — only events with named entries above are part of the public contract.

---

## Versioning

The event field list (`SHINY_EVENT_FIELDS`) is part of the v1 wire format. Adding fields is a minor-version-additive change (older readers must ignore unknown fields). Removing or renaming fields is a major-version break.

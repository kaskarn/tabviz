# Source-tagging envelope contract

**Status:** Stable contract. Part of the JS → R wire format. Honored by both `tabviz` and `tabviz_split` widget bindings.
**Audience:** Anyone touching the Shiny-bridge code (`srcjs/src/index*.svelte.ts`, `R/shiny.R`), or anyone writing a Shiny dashboard that needs to filter feedback loops.

---

## The envelope

Every value the widget pushes to Shiny via `Shiny.setInputValue()` is wrapped in a `ShinyEnvelope<T>`:

```ts
interface ShinyEnvelope<T = unknown> {
  value: T;       // the actual payload
  source: SourceTag; // "user" | "proxy"
  ts: number;     // epoch milliseconds at emission
}
```

The TS definition lives in `srcjs/src/types/index.ts`; the runtime constructor is `shinyEnvelope(value, source)` in `srcjs/src/lib/shiny-envelope.ts`. **Construct envelopes via the helper, not by hand** — keeps the shape defined in one place.

## What each field means

### `value: T`

The actual payload. Type depends on the emitter — `string[]` for `_selected`, a `SortConfig` for `_sort`, the whole debounced state bundle for `_state`, etc. Per-emitter typing comes in 0a-PR5 when the typed event emitter ships.

### `source: SourceTag`

Provenance — *which path most-recently mutated the field*:

- `"user"` — the mutation came from a widget-side interaction (click, drag, paint, slider, etc.)
- `"proxy"` — the mutation came from an R-side proxy call (`tabviz::sort_rows()`, `paint_row()`, etc., dispatched via the `tabviz-proxy` / `tabviz-split-proxy` Shiny custom message channel)

Source tagging is **synchronous** — the store's `source` slice (`srcjs/src/stores/slices/source.svelte.ts`) tracks `currentSource` as a plain closure variable, mutated transiently by `withSource("proxy", () => ...)` wrapping every proxy-dispatched handler. Inside that wrapper, `markSource(field)` captures `"proxy"`; outside it, the default is `"user"`. The `lastSource` record is `$state` so Shiny output observers reactively read the latest tag.

The window between `currentSource = "proxy"` and `currentSource = prev` (the try/finally restore) is **synchronous and very short** — no `await`, no `setTimeout`, no `$effect.flush()`. Every `markSource()` call inside the handler body lands while `currentSource` is still `"proxy"`. This is why the contract is sound.

### `ts: number`

Epoch milliseconds at emission (`Date.now()`). Lets observers detect stale events in pathological scheduling cases. Not used by any current consumer; reserved.

## Why this exists — the feedback-loop story

Without `source`, Shiny dashboards that bidirectionally bind widget state run into a classic feedback loop:

1. User drags a column to reorder.
2. Widget emits `input$tbl_column_order = c("a","c","b")`.
3. Dashboard observes the change, runs some logic, then calls `tabviz::move_column(proxy, ...)` to commit the new order back.
4. Proxy dispatch fires `setSpec` / `applyFilter` / etc. on the widget.
5. Widget emits `input$tbl_column_order` *again* — same value, but a new event.
6. Dashboard observer re-fires. Loop.

With `source`, the dashboard can disambiguate:

```r
observeEvent(input$tbl_column_order, {
  envelope <- input$tbl_column_order
  if (envelope$source != "user") return()  # ignore proxy-driven echoes
  do_dashboard_work(envelope$value)
})
```

Or using the helpers in `R/shiny.R`:

```r
# tabviz_state(input, id) returns just `value` from every envelope
# tabviz_state_envelope(input, id) returns the full envelope so callers
# can filter on source
state <- tabviz_state_envelope(input, "tbl")
if (state$sort$source == "user") ...
```

## Reading envelopes R-side

Two helpers live in `R/shiny.R`:

| Helper | Returns | Use when |
|---|---|---|
| `tabviz_state(input, id)` | A named list of just `value`s | You don't care about provenance; just want the current values |
| `tabviz_state_envelope(input, id)` | A named list of full envelopes | You need to filter feedback loops on `source` |

Both read from `TABVIZ_STATE_FIELDS` — a hardcoded list of the field names the widget emits. This list is the load-bearing R↔JS sync point handled by §2.5-G6 / §4 Phase 0e. As of v1.0 the sync mechanism is doc-tested (the test reads the TS file and asserts the constants match). When the typed event emitter ships (0a-PR5), the sync mechanism extends to validate the field list too.

## What the envelope is NOT

- **Not a versioned protocol.** The envelope shape (`{value, source, ts}`) is part of the v1.0 wire contract. If it ever needs to change shape (add fields, rename, drop), that's a major version bump — same rules as `WebSpec` versioning (see `docs/dev/frontend-split-spec.md` §3.4).
- **Not a queue.** Each `setInputValue` call replaces the previous value for that field; there's no buffering. The `ts` field can be used to detect dropped events if a consumer is sampling at a slower cadence, but Shiny itself doesn't buffer.
- **Not a security boundary.** `source: "user"` just means "this came from the widget UI" — it doesn't mean the user authenticated, nor that the widget UI wasn't tampered with. If you need that, layer authentication on top; the envelope is for *causality*, not *trust*.

## Construction and consumption sites

| Site | Direction | What it does |
|---|---|---|
| `srcjs/src/lib/shiny-envelope.ts::shinyEnvelope()` | Construction | The only place envelopes are created (or should be) |
| `srcjs/src/htmlwidgets/index.svelte.ts::setupShinyBindings::emit()` | Construction | Wraps per-field emissions for the single widget |
| `srcjs/src/htmlwidgets/index.svelte.ts` debounced `_state` block | Construction | The aggregate bundle |
| `srcjs/src/htmlwidgets/index-split.svelte.ts::setupShinyBindings` | Construction | The split widget's `active_plot` and `selected` |
| `R/shiny.R::tabviz_state` | Consumption | Returns unwrapped values |
| `R/shiny.R::tabviz_state_envelope` | Consumption | Returns full envelopes for feedback-loop filtering |

## Open questions / future work

- **0a-PR5** ships the typed event emitter, at which point envelope values become typed per emitter — the helper signature stays the same but the `T` becomes meaningful.
- **Phase 2** restructures the source tree; `$lib/shiny-envelope.ts` likely moves to `htmlwidgets/glue.ts` since envelopes are an adapter-level concern.
- If a non-Shiny consumer ever wants similar provenance-tagged emissions, the envelope shape is a documented pattern they can copy. v1 doesn't generalize it beyond Shiny.

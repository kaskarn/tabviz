import type { WebSpec, HTMLWidgetsBinding, WidgetInstance } from "$types";
import type { TabvizStore } from "$stores/tabvizStore.svelte";
import { createTabviz, type TabvizInstance } from "$core/createTabviz";
import { exportToSVG, exportToPNG } from "$export";
import { shinyEnvelope } from "$lib/shiny-envelope";
import { normalize } from "$spec/proxy-args.ts";
import { validateSpec } from "$spec/validate.ts";
import { EVENT_TO_SHINY_FIELD } from "$spec/events.ts";
import {
  exposeDevHook,
  hasShiny,
  registerCustomMessageHandler,
  registerWidget,
  setShinyInput,
} from "./glue";
import "../styles.css";
// V4 canonical paint surface (wire-audit Pass 1a / B13): shell+paper,
// textures, HC fidelity, glow/strip. Bundles into tabviz.css alongside
// the structural reset — no JS payload.
import "../lib/theme/theme-runtime.css";
// Side-effect: register built-in schema behaviors + DOM cell
// renderers before any widget mounts. `init-dom` includes the
// Svelte-importing renderers; `init` (which it loads first) covers
// behaviors + text-composition renderers.
import "../schema/init-dom";

// Development hook: expose export helpers under window.__tabvizExports
exposeDevHook("__tabvizExports", { exportToSVG, exportToPNG });

// Store registry for Shiny proxy support. Also exposed as a dev hook
// (`window.__tabvizStoreRegistry`) for puppeteer / playwright introspection.
const storeRegistry = new Map<string, TabvizStore>();
exposeDevHook("__tabvizStoreRegistry", storeRegistry);

// Teardown disposers keyed by element id. htmlwidgets gives output bindings NO
// teardown hook, so when Shiny removes + recreates an element under the same id
// (conditionalPanel / insertUI/removeUI), the prior store's ~20 subscriptions +
// debounce timer + mounted Svelte component would leak. We dispose the stale
// instance when a new one mounts under the same id (bounded: ≤1 stale per id).
const teardownRegistry = new Map<string, () => void>();

// Proxy method handlers. Keys match the method names sent from R's
// invoke_proxy_method(); each value normalizes the raw wire payload via
// `normalize.<method>` from `$spec/proxy-args.ts` then dispatches into
// the store with typed args. Coercion lives in normalize, not here.
//
// Adding a new method:
//   1. Add an interface + normalize entry in $spec/proxy-args.ts
//   2. Add a handler below that calls the normalizer and dispatches
//   3. Add a behavior test in srcjs/src/htmlwidgets/index.proxy.test.ts
export const proxyMethods: Record<string, (store: TabvizStore, args: Record<string, unknown>) => void> = {
  updateData: (store, raw) => {
    const a = normalize.updateData(raw);
    if (!a) return;
    // Live ingress wall: a malformed proxy spec must NOT corrupt the running
    // widget. Unlike the constructor (which throws to fail the mount), the
    // live path validates and SKIPS on error-severity issues, logging a clear
    // diagnostic instead of crashing cryptically inside setSpec's group walk.
    const errors = validateSpec(a.spec).filter((i) => i.severity === "error");
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error("[tabviz] proxy updateData rejected — invalid spec:", errors);
      return;
    }
    store.setSpec(a.spec);
  },
  toggleGroup: (store, raw) => {
    const a = normalize.toggleGroup(raw);
    if (!a) return;
    store.toggleGroup(a.groupId, a.collapsed);
  },
  toggleRowDetails: (store, raw) => {
    const a = normalize.toggleRowDetails(raw);
    if (!a) return;
    store.toggleRowDetails(a.rowId, a.expanded);
  },
  applyFilter: (store, raw) => {
    const a = normalize.applyFilter(raw);
    if (!a) return;
    store.setColumnFilter(a.field, a.filter);
  },
  clearFilter: (store) => {
    store.clearAllFilters();
  },
  sortBy: (store, raw) => {
    const a = normalize.sortBy(raw);
    if (!a) return;
    store.sortBy(a.column, a.direction);
  },

  // ---- Column ops ----
  addColumn: (store, raw) => {
    const a = normalize.addColumn(raw);
    if (!a) return;
    store.insertColumn(a.column, a.afterId);
  },
  hideColumn: (store, raw) => {
    const a = normalize.hideColumn(raw);
    if (!a) return;
    store.hideColumn(a.id);
  },
  moveColumn: (store, raw) => {
    const a = normalize.moveColumn(raw);
    if (!a) return;
    let newIndex: number;
    if (a.position.kind === "index") {
      newIndex = a.position.value;
    } else {
      // "before" mode: resolve the target sibling's index from the store's
      // current column scope. This dispatch step is the genuine reason
      // S12 keeps both positional modes (R can't resolve sibling indexes
      // without store knowledge). See the diary's PR4 note.
      const scope = store.findColumnScope(a.itemId) ?? "__root__";
      const siblings = store.siblingsForColumnScope(scope).map((d) => d.id);
      const targetIdx = siblings.indexOf(a.position.value);
      if (targetIdx < 0) return;
      newIndex = targetIdx;
    }
    store.moveColumnItem(a.itemId, newIndex);
  },
  setColumnWidth: (store, raw) => {
    const a = normalize.setColumnWidth(raw);
    if (!a) return;
    store.setColumnWidth(a.columnId, a.width);
  },
  updateColumn: (store, raw) => {
    const a = normalize.updateColumn(raw);
    if (!a) return;
    store.updateColumnPatch(a.id, a.patch);
  },

  // ---- Row ops ----
  selectRows: (store, raw) => {
    const a = normalize.selectRows(raw);
    if (!a) return;
    store.setSelectedRows(a.rowIds);
  },
  moveRow: (store, raw) => {
    const a = normalize.moveRow(raw);
    if (!a) return;
    store.moveRowItem(a.rowId, a.position.value);
  },

  // ---- Cell edits ----
  setCell: (store, raw) => {
    const a = normalize.setCell(raw);
    if (!a) return;
    store.setCellValue(a.rowId, a.field, a.value as Parameters<TabvizStore["setCellValue"]>[2]);
  },
  setRowLabel: (store, raw) => {
    const a = normalize.setRowLabel(raw);
    if (!a) return;
    store.setRowLabel(a.rowId, a.label);
  },
  // R set_title/set_subtitle/set_caption/set_footnote/set_tag on a proxy.
  // This handler was MISSING until the Labels tab build (settings-redesign
  // P2): R sent setLabel and the table silently dropped it — live Shiny
  // label updates never worked.
  setLabel: (store, raw) => {
    const a = normalize.setLabel(raw);
    if (!a) return;
    store.setLabel(a.which, a.text);
  },
  clearEdits: (store) => {
    store.clearAllEdits();
  },

  // ---- Paint (semantic-flag toggles) ----
  // R's `paint_row(proxy, row_id, token)` sends `{rowId, token}`. A
  // string token paints; `NA_character_` (-> null over wire) clears
  // every active token on that row via store.clearSemantic.
  setRowSemantic: (store, raw) => {
    const a = normalize.setRowSemantic(raw);
    if (!a) return;
    if (a.token !== null) {
      store.setRowSemantic(a.rowId, a.token, true);
    } else {
      store.clearSemantic(a.rowId);
    }
  },
  setCellSemantic: (store, raw) => {
    const a = normalize.setCellSemantic(raw);
    if (!a) return;
    if (a.token !== null) {
      store.setCellSemantic(a.rowId, a.field, a.token, true);
    } else {
      store.clearCellSemantic(a.rowId, a.field);
    }
  },

  // ---- Global ----
  setTheme: (store, raw) => {
    const a = normalize.setTheme(raw);
    if (!a) return;
    if (a.kind === "name") {
      store.setTheme(a.name);
    } else if (a.kind === "theme") {
      // Apply a full WebTheme payload (round-2 cross-runtime review P1):
      // R `set_theme(proxy, web_theme(...))` serializes the resolved
      // theme — incl. pins/roleOverrides — and the DOM widget must apply
      // it, or Shiny diverges from export/static for every custom theme.
      // setThemeObject already exists; the dispatch branch was the only
      // missing link.
      store.setThemeObject(a.theme as never);
    }
  },
  setZoom: (store, raw) => {
    const a = normalize.setZoom(raw);
    if (!a) return;
    if (a.zoom !== undefined) store.setZoom(a.zoom);
    if (a.autoFit !== undefined) store.setAutoFit(a.autoFit);
    if (a.maxWidth !== undefined) store.setMaxWidth(a.maxWidth);
    if (a.maxHeight !== undefined) store.setMaxHeight(a.maxHeight);
    if (a.showZoomControls !== undefined) store.setShowZoomControls(a.showZoomControls);
  },
  setAspectRatio: (store, raw) => {
    const a = normalize.setAspectRatio(raw);
    if (!a) return;
    store.setTargetAspect(a.ratio);
    if (a.anchor !== undefined) store.setTargetAspectAnchor(a.anchor);
  },
};

// HTMLWidgets binding — consumes the public `createTabviz` factory.
// Phase 1: the factory now owns wire-version validation, spec ingestion,
// initial-state seeding, zoom-field application, and the Svelte mount.
// This adapter is a thin shell.
const binding: HTMLWidgetsBinding = {
  name: "tabviz",
  type: "output",
  factory: (el: HTMLElement, width: number, height: number): WidgetInstance => {
    let instance: TabvizInstance | null = null;

    return {
      renderValue: (raw: unknown) => {
        const x = raw as WebSpec;
        if (instance === null) {
          // First mount: factory validates the spec version, ingests the
          // spec + initial state, applies zoom fields, mounts TabvizPlot.
          instance = createTabviz(el, x, { width, height });
          // Let htmlwidgets container expand to fit content (sizing handled by CSS).
          el.style.height = "auto";
          if (el.id) {
            // Dispose any stale instance left under this id before re-registering.
            teardownRegistry.get(el.id)?.();
            storeRegistry.set(el.id, instance.store);
            const disposeBindings = hasShiny()
              ? setupShinyBindings(el.id, instance.store)
              : undefined;
            const inst = instance;
            const id = el.id;
            teardownRegistry.set(id, () => {
              disposeBindings?.();
              inst.destroy();
              storeRegistry.delete(id);
              teardownRegistry.delete(id);
            });
          }
        } else {
          instance.update(x);
        }
      },

      resize: (newWidth: number, newHeight: number) => {
        instance?.store.setDimensions(newWidth, newHeight);
      },
    };
  },
};

// Set up Shiny input bindings.
//
// Every outbound input uses the uniform ShinyEnvelope: { value, source, ts }.
// `source` is "user" for widget-driven mutations and "proxy" for Shiny-pushed
// ones — the store's withSource() wrapper around proxy dispatch (below) makes
// markSource() capture the right tag synchronously inside each setter, before
// $effect runs. See docs/dev/source-tagging.md for the contract.
function setupShinyBindings(widgetId: string, store: TabvizStore): () => void {
  // Collect every subscription so the widget teardown can release them (htmlwidgets
  // has no teardown hook — see teardownRegistry). `sub` keeps store.on's typed
  // overload while pushing the returned Unsubscribe.
  const subs: Array<() => void> = [];
  const sub: TabvizStore["on"] = (event, listener) => {
    const u = store.on(event, listener);
    subs.push(u);
    return u;
  };
  const emit = (field: string, value: unknown) => {
    setShinyInput(
      `${widgetId}_${field}`,
      shinyEnvelope(value, store.getSource(field)),
    );
  };

  // Per-dimension subscriptions — the store fires typed events from its
  // reactive $effect blocks (see tabvizStore::eventEmitter), we map each
  // to its snake_case Shiny field name via EVENT_TO_SHINY_FIELD and forward.
  // Replaces the prior $effect.root(() => $effect(...) x18) block; same
  // wire behavior, narrower contract.
  sub("selected", (value) => emit(EVENT_TO_SHINY_FIELD.selected, value));
  sub("hover", (value) => emit(EVENT_TO_SHINY_FIELD.hover, value));
  sub("sort", (value) => emit(EVENT_TO_SHINY_FIELD.sort, value));
  sub("filters", (value) => emit(EVENT_TO_SHINY_FIELD.filters, value));
  sub("rowStyles", (value) => emit(EVENT_TO_SHINY_FIELD.rowStyles, value));
  sub("cellStyles", (value) => emit(EVENT_TO_SHINY_FIELD.cellStyles, value));
  sub("paintTool", (value) => emit(EVENT_TO_SHINY_FIELD.paintTool, value));
  sub("collapsedGroups", (value) => emit(EVENT_TO_SHINY_FIELD.collapsedGroups, value));
  sub("expandedRows", (value) => emit(EVENT_TO_SHINY_FIELD.expandedRows, value));
  sub("hiddenColumns", (value) => emit(EVENT_TO_SHINY_FIELD.hiddenColumns, value));
  sub("columnOrder", (value) => emit(EVENT_TO_SHINY_FIELD.columnOrder, value));
  sub("columnWidths", (value) => emit(EVENT_TO_SHINY_FIELD.columnWidths, value));
  sub("rowKindHeights", (value) => emit(EVENT_TO_SHINY_FIELD.rowKindHeights, value));
  sub("cellEdits", (value) => emit(EVENT_TO_SHINY_FIELD.cellEdits, value));
  sub("labelEdits", (value) => emit(EVENT_TO_SHINY_FIELD.labelEdits, value));
  sub("zoom", (value) => emit(EVENT_TO_SHINY_FIELD.zoom, value));
  sub("axisZooms", (value) => emit(EVENT_TO_SHINY_FIELD.axisZooms, value));
  sub("banding", (value) => emit(EVENT_TO_SHINY_FIELD.banding, value));
  sub("plotWidth", (value) => emit(EVENT_TO_SHINY_FIELD.plotWidth, value));
  sub("visibleRows", (value) => emit(EVENT_TO_SHINY_FIELD.visibleRows, value));

  // Aggregate — debounced `_state` bundle. The store's `change` event
  // fires on every mutation; we coalesce 150ms of activity into a single
  // setInputValue with the current snapshot. The snapshot is read from
  // the store's reactive getters at flush time, not from the event
  // payload (which is empty for `change`).
  let stateTimer: ReturnType<typeof setTimeout> | null = null;
  sub("change", () => {
    if (stateTimer) clearTimeout(stateTimer);
    stateTimer = setTimeout(() => {
      if (!hasShiny()) return;
      const bundle = {
        sort: store.sortConfig,
        filters: store.filters,
        row_styles: store.styleEdits.rows,
        cell_styles: store.styleEdits.cells,
        paint_tool: store.paintTool,
        selected: Array.from(store.selectedRowIds),
        collapsed_groups: Array.from(store.collapsedGroups),
        expanded_rows: Array.from(store.expandedRows),
        hidden_columns: Array.from(store.hiddenColumnIds),
        column_order: store.allColumns.map((c) => c.id),
        column_widths: { ...store.columnWidths },
        row_kind_heights: { ...store.rowKindHeights },
        cell_edits: store.cellEdits,
        label_edits: store.labelEdits,
        zoom: {
          zoom: store.zoom,
          autoFit: store.autoFit,
          maxWidth: store.maxWidth,
          maxHeight: store.maxHeight,
          showZoomControls: store.showZoomControls,
        },
        axis_zooms: store.axisZooms,
        banding: store.bandingOverride == null && store.bandingStartsWithBandOverride == null
          ? null
          : { mode: store.bandingOverride, startsWithBand: store.bandingStartsWithBandOverride },
        plot_width: store.plotWidthOverride,
      };
      setShinyInput(`${widgetId}_state`, shinyEnvelope(bundle, "user"));
    }, 150);
  });

  // Disposer: release every subscription + cancel the pending debounce.
  return () => {
    for (const u of subs) u();
    if (stateTimer) clearTimeout(stateTimer);
  };
}

// Register with HTMLWidgets
registerWidget(binding);

// Shiny proxy message handler. withSource('proxy', ...) sets the store's
// currentSource for the synchronous mutation block, so every markSource()
// call inside the dispatched handler captures 'proxy' before the outbound
// $effect tick fires. Dashboards can then filter their own writes via
// `req(input$tbl_sort$source == "user")`. See docs/dev/source-tagging.md.
registerCustomMessageHandler("tabviz-proxy", (raw: unknown) => {
  const msg = raw as { id: string; method: string; args: Record<string, unknown> };
  const store = storeRegistry.get(msg.id);
  if (store && msg.method in proxyMethods) {
    store.withSource("proxy", () => {
      proxyMethods[msg.method](store, msg.args);
    });
  }
});


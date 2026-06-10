import type { WebSpec, HTMLWidgetsBinding, WidgetInstance } from "$types";
import type { TabvizStore } from "$stores/tabvizStore.svelte";
import { createTabviz, type TabvizInstance } from "$core/createTabviz";
import { exportToSVG, exportToPNG } from "$export";
import { shinyEnvelope } from "$lib/shiny-envelope";
import { normalize } from "$spec/proxy-args.ts";
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
          // Register the store reference for proxy + Shiny adapters.
          if (el.id) storeRegistry.set(el.id, instance.store);
          // Let htmlwidgets container expand to fit content (sizing handled by CSS).
          el.style.height = "auto";
          if (hasShiny() && el.id) {
            setupShinyBindings(el.id, instance.store);
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
function setupShinyBindings(widgetId: string, store: TabvizStore) {
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
  store.on("selected", (value) => emit(EVENT_TO_SHINY_FIELD.selected, value));
  store.on("hover", (value) => emit(EVENT_TO_SHINY_FIELD.hover, value));
  store.on("sort", (value) => emit(EVENT_TO_SHINY_FIELD.sort, value));
  store.on("filters", (value) => emit(EVENT_TO_SHINY_FIELD.filters, value));
  store.on("rowStyles", (value) => emit(EVENT_TO_SHINY_FIELD.rowStyles, value));
  store.on("cellStyles", (value) => emit(EVENT_TO_SHINY_FIELD.cellStyles, value));
  store.on("paintTool", (value) => emit(EVENT_TO_SHINY_FIELD.paintTool, value));
  store.on("collapsedGroups", (value) => emit(EVENT_TO_SHINY_FIELD.collapsedGroups, value));
  store.on("expandedRows", (value) => emit(EVENT_TO_SHINY_FIELD.expandedRows, value));
  store.on("hiddenColumns", (value) => emit(EVENT_TO_SHINY_FIELD.hiddenColumns, value));
  store.on("columnOrder", (value) => emit(EVENT_TO_SHINY_FIELD.columnOrder, value));
  store.on("columnWidths", (value) => emit(EVENT_TO_SHINY_FIELD.columnWidths, value));
  store.on("rowKindHeights", (value) => emit(EVENT_TO_SHINY_FIELD.rowKindHeights, value));
  store.on("cellEdits", (value) => emit(EVENT_TO_SHINY_FIELD.cellEdits, value));
  store.on("labelEdits", (value) => emit(EVENT_TO_SHINY_FIELD.labelEdits, value));
  store.on("zoom", (value) => emit(EVENT_TO_SHINY_FIELD.zoom, value));
  store.on("axisZooms", (value) => emit(EVENT_TO_SHINY_FIELD.axisZooms, value));
  store.on("banding", (value) => emit(EVENT_TO_SHINY_FIELD.banding, value));
  store.on("plotWidth", (value) => emit(EVENT_TO_SHINY_FIELD.plotWidth, value));
  store.on("visibleRows", (value) => emit(EVENT_TO_SHINY_FIELD.visibleRows, value));

  // Aggregate — debounced `_state` bundle. The store's `change` event
  // fires on every mutation; we coalesce 150ms of activity into a single
  // setInputValue with the current snapshot. The snapshot is read from
  // the store's reactive getters at flush time, not from the event
  // payload (which is empty for `change`).
  let stateTimer: ReturnType<typeof setTimeout> | null = null;
  store.on("change", () => {
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


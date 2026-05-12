import type { WebSpec, HTMLWidgetsBinding, WidgetInstance } from "$types";
import ForestPlot from "$lib/ForestPlot.svelte";
import { createForestStore, type ForestStore } from "$stores/forestStore.svelte";
import { exportToSVG, exportToPNG } from "$lib/export";
import { shinyEnvelope } from "$lib/shiny-envelope";
import { validateSpecVersion } from "$spec";
import { normalize } from "$spec/proxy-args.ts";
import {
  exposeDevHook,
  hasShiny,
  registerCustomMessageHandler,
  registerWidget,
  setShinyInput,
} from "./htmlwidgets-glue";
import { mount, unmount } from "svelte";
import "./styles.css";

// Development hook: expose export helpers under window.__tabvizExports
exposeDevHook("__tabvizExports", { exportToSVG, exportToPNG });

// Store registry for Shiny proxy support. Also exposed as a dev hook
// (`window.__tabvizStoreRegistry`) for puppeteer / playwright introspection.
const storeRegistry = new Map<string, ForestStore>();
exposeDevHook("__tabvizStoreRegistry", storeRegistry);

// Proxy method handlers. Keys match the method names sent from R's
// invoke_proxy_method(); each value normalizes the raw wire payload via
// `normalize.<method>` from `$spec/proxy-args.ts` then dispatches into
// the store with typed args. Coercion lives in normalize, not here.
//
// Adding a new method:
//   1. Add an interface + normalize entry in $spec/proxy-args.ts
//   2. Add a handler below that calls the normalizer and dispatches
//   3. Add a behavior test in srcjs/src/index.proxy.test.ts
export const proxyMethods: Record<string, (store: ForestStore, args: Record<string, unknown>) => void> = {
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
  applyFilter: (store, raw) => {
    const a = normalize.applyFilter(raw);
    if (!a) return;
    if (a.kind === "column") {
      store.setColumnFilter(a.field, a.filter);
    } else {
      store.setFilter(a.filter);
    }
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
    store.setCellValue(a.rowId, a.field, a.value as Parameters<ForestStore["setCellValue"]>[2]);
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
  // every active token on that row. The store's `setRowSemantic`
  // takes (rowId, token, on); the clear-all case fans out below.
  setRowSemantic: (store, raw) => {
    const a = normalize.setRowSemantic(raw);
    if (!a) return;
    if (a.token !== null) {
      store.setRowSemantic(a.rowId, a.token, true);
    } else {
      // Clear all painted tokens on the row. The PR6 milestone adds a
      // dedicated store.clearSemantic() method (S5); for PR4 we still
      // fan out manually here.
      const tokens: ReadonlyArray<"bold" | "emphasis" | "muted" | "accent" | "fill"> =
        ["bold", "emphasis", "muted", "accent", "fill"];
      for (const t of tokens) store.setRowSemantic(a.rowId, t, false);
    }
  },
  setCellSemantic: (store, raw) => {
    const a = normalize.setCellSemantic(raw);
    if (!a) return;
    if (a.token !== null) {
      store.setCellSemantic(a.rowId, a.field, a.token, true);
    } else {
      const tokens: ReadonlyArray<"bold" | "emphasis" | "muted" | "accent" | "fill"> =
        ["bold", "emphasis", "muted", "accent", "fill"];
      for (const t of tokens) store.setCellSemantic(a.rowId, a.field, t, false);
    }
  },

  // ---- Global ----
  setTheme: (store, raw) => {
    const a = normalize.setTheme(raw);
    if (!a) return;
    if (a.kind === "name") {
      store.setTheme(a.name);
    }
    // Full WebTheme payloads aren't applied runtime-side yet; the
    // normalizer accepts them so the proxy call doesn't error. Future
    // store wiring will add `setThemeObject(a.theme)` here.
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

// HTMLWidgets binding
const binding: HTMLWidgetsBinding = {
  name: "tabviz",
  type: "output",
  factory: (el: HTMLElement, width: number, height: number): WidgetInstance => {
    let component: ReturnType<typeof mount> | null = null;
    const store = createForestStore();

    // Register store for potential Shiny proxy access
    if (el.id) {
      storeRegistry.set(el.id, store);
    }

    return {
      renderValue: (raw: unknown) => {
        // Validate wire-format version before handing off to the store; throws
        // with a clear message on unrecognized major. See $spec/index.ts.
        validateSpecVersion(raw as { version?: unknown }, "WebSpec");
        const x = raw as WebSpec & {
          zoom?: number;
          autoFit?: boolean;
          maxWidth?: number | null;
          maxHeight?: number | null;
          showZoomControls?: boolean;
          initialState?: {
            sort?: { column: string; direction: "asc" | "desc" | "none" };
            filters?: Array<{ field: string; operator: string; value: unknown }>;
            hiddenColumns?: string[];
          };
        };
        store.setSpec(x);
        store.setDimensions(width, height);

        // Apply zoom and sizing settings from R
        if (typeof x.zoom === 'number') {
          store.setZoom(x.zoom);
        }
        if (typeof x.autoFit === 'boolean') {
          store.setAutoFit(x.autoFit);
        }
        if (x.maxWidth !== undefined) {
          store.setMaxWidth(x.maxWidth);
        }
        if (x.maxHeight !== undefined) {
          store.setMaxHeight(x.maxHeight);
        }
        if (typeof x.showZoomControls === 'boolean') {
          store.setShowZoomControls(x.showZoomControls);
        }

        // Apply authored initial state before mount so the first paint matches
        // the dashboard's expected sort/filter/visibility — no post-mount
        // flash of unsorted content. Source is "user" (the author wrote it).
        if (x.initialState) {
          if (x.initialState.sort) {
            store.sortBy(
              x.initialState.sort.column,
              x.initialState.sort.direction,
            );
          }
          if (x.initialState.filters) {
            for (const f of x.initialState.filters) {
              store.setColumnFilter(f.field, {
                operator: f.operator,
                value: f.value,
              } as Parameters<ForestStore["setColumnFilter"]>[1]);
            }
          }
          if (x.initialState.hiddenColumns) {
            for (const id of x.initialState.hiddenColumns) {
              store.hideColumn(id);
            }
          }
        }

        // Let htmlwidgets container expand to fit content - sizing handled by CSS
        el.style.height = 'auto';

        if (component) {
          unmount(component);
        }

        component = mount(ForestPlot, {
          target: el,
          props: { store },
        });

        // Set up Shiny event forwarding if in Shiny context
        if (hasShiny() && el.id) {
          setupShinyBindings(el.id, store);
        }
      },

      resize: (newWidth: number, newHeight: number) => {
        store.setDimensions(newWidth, newHeight);
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
function setupShinyBindings(widgetId: string, store: ForestStore) {
  const emit = (field: string, value: unknown) => {
    setShinyInput(
      `${widgetId}_${field}`,
      shinyEnvelope(value, store.getSource(field)),
    );
  };

  $effect.root(() => {
    // ── Tier 1 — core interaction ─────────────────────────────────────────
    $effect(() => {
      emit("selected", Array.from(store.selectedRowIds));
    });
    $effect(() => {
      emit("hover", store.hoveredRowId);
    });
    $effect(() => {
      emit("sort", store.sortConfig);
    });
    $effect(() => {
      emit("filters", store.filters);
    });
    $effect(() => {
      emit("row_styles", store.styleEdits.rows);
    });
    $effect(() => {
      emit("cell_styles", store.styleEdits.cells);
    });
    $effect(() => {
      emit("paint_tool", store.paintTool);
    });
    $effect(() => {
      emit("collapsed_groups", Array.from(store.collapsedGroups));
    });
    $effect(() => {
      emit("hidden_columns", Array.from(store.hiddenColumnIds));
    });
    $effect(() => {
      emit("column_order", store.allColumns.map((c) => c.id));
    });
    $effect(() => {
      emit("column_widths", { ...store.columnWidths });
    });
    $effect(() => {
      emit("cell_edits", store.cellEdits);
    });
    $effect(() => {
      emit("label_edits", store.labelEdits);
    });
    $effect(() => {
      emit("zoom", {
        zoom: store.zoom,
        autoFit: store.autoFit,
        maxWidth: store.maxWidth,
        maxHeight: store.maxHeight,
        showZoomControls: store.showZoomControls,
      });
    });

    // ── Tier 2 — plot/layout overrides (forest-specific) ──────────────────
    $effect(() => {
      emit("axis_zooms", store.axisZooms);
    });
    $effect(() => {
      const mode = store.bandingOverride;
      const startsWithBand = store.bandingStartsWithBandOverride;
      emit("banding", mode == null && startsWithBand == null
        ? null
        : { mode, startsWithBand });
    });
    $effect(() => {
      emit("plot_width", store.plotWidthOverride);
    });

    // ── Derived: rows currently visible after filter+collapse+sort ────────
    // visibleRows is the same derivation the renderer uses; emit just the IDs
    // in display order so dashboards can mirror the shown set.
    $effect(() => {
      emit("visible_rows", store.visibleRows.map((r) => r.id));
    });

    // ── Aggregate — debounced bundle of every Tier 1+2 dimension ──────────
    let stateTimer: ReturnType<typeof setTimeout> | null = null;
    $effect(() => {
      // Touch every reactive dependency so the effect re-fires when any field
      // changes; the actual emit is debounced via setTimeout below.
      void store.sortConfig;
      void store.filters;
      void store.styleEdits;
      void store.paintTool;
      void store.selectedRowIds;
      void store.collapsedGroups;
      void store.hiddenColumnIds;
      void store.allColumns;
      void store.columnWidths;
      void store.cellEdits;
      void store.labelEdits;
      void store.zoom;
      void store.autoFit;
      void store.maxWidth;
      void store.maxHeight;
      void store.showZoomControls;
      void store.axisZooms;
      void store.bandingOverride;
      void store.bandingStartsWithBandOverride;
      void store.plotWidthOverride;

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
          hidden_columns: Array.from(store.hiddenColumnIds),
          column_order: store.allColumns.map((c) => c.id),
          column_widths: { ...store.columnWidths },
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

// Export for potential npm package use
export { ForestPlot, createForestStore };
export type * from "$types";

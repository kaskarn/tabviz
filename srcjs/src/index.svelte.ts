import type { WebSpec, HTMLWidgetsBinding, WidgetInstance, ColumnSpec } from "$types";
import type { ThemeName } from "$lib/theme-presets";
import ForestPlot from "$lib/ForestPlot.svelte";
import { createForestStore, type ForestStore } from "$stores/forestStore.svelte";
import { exportToSVG, exportToPNG } from "$lib/export";
import { mount, unmount } from "svelte";
import "./styles.css";

// Development hook: expose export helpers under window.__tabvizExports
if (typeof window !== "undefined") {
  (window as unknown as { __tabvizExports: { exportToSVG: typeof exportToSVG; exportToPNG: typeof exportToPNG } }).__tabvizExports = { exportToSVG, exportToPNG };
}

// Store registry for Shiny proxy support
const storeRegistry = new Map<string, ForestStore>();

// Expose the registry (and a few helpers) to window for debugging / automated tests.
// This is a development aid; safe to leave in production — the surface is read-only.
if (typeof window !== "undefined") {
  (window as unknown as { __tabvizStoreRegistry: Map<string, ForestStore> }).__tabvizStoreRegistry = storeRegistry;
}

// Proxy method handlers. Keys match the method names sent from R's
// invoke_proxy_method(); values read the JSON-decoded args and dispatch
// into the Svelte store. Keep this table flat — one entry per verb.
export const proxyMethods: Record<string, (store: ForestStore, args: Record<string, unknown>) => void> = {
  updateData: (store, args) => {
    if (args.spec) {
      store.setSpec(args.spec as WebSpec);
    }
  },
  toggleGroup: (store, args) => {
    store.toggleGroup(
      args.groupId as string,
      args.collapsed as boolean | undefined
    );
  },
  applyFilter: (store, args) => {
    // Accepts either legacy FilterConfig { field, operator, value } or
    // new multi-column { field, filter: ColumnFilter }.
    if (args.filter && typeof args.filter === "object") {
      const f = args.filter as Record<string, unknown>;
      if ("kind" in f) {
        store.setColumnFilter(f.field as string, f as unknown as Parameters<ForestStore["setColumnFilter"]>[1]);
        return;
      }
      store.setFilter(args.filter as Parameters<ForestStore["setFilter"]>[0]);
    } else if (args.field && "filter" in args) {
      store.setColumnFilter(args.field as string, args.filter as Parameters<ForestStore["setColumnFilter"]>[1]);
    }
  },
  clearFilter: (store) => {
    store.clearAllFilters();
  },
  sortBy: (store, args) => {
    store.sortBy(
      args.column as string,
      args.direction as "asc" | "desc" | "none"
    );
  },

  // ---- Column ops ----
  addColumn: (store, args) => {
    const column = args.column as ColumnSpec | undefined;
    if (!column) return;
    const afterId = typeof args.afterId === "string" ? args.afterId : "";
    store.insertColumn(column, afterId);
  },
  hideColumn: (store, args) => {
    if (typeof args.id === "string") store.hideColumn(args.id);
  },
  moveColumn: (store, args) => {
    const itemId = args.itemId as string | undefined;
    if (!itemId) return;
    let newIndex: number | undefined;
    if (typeof args.newIndex === "number" && Number.isFinite(args.newIndex)) {
      newIndex = args.newIndex;
    } else if (typeof args.before === "string" && args.before) {
      // Position relative to another column id.
      const scope = store.findColumnScope(itemId) ?? "__root__";
      const siblings = store.siblingsForColumnScope(scope).map((d) => d.id);
      const targetIdx = siblings.indexOf(args.before);
      if (targetIdx >= 0) newIndex = targetIdx;
    }
    if (newIndex === undefined) return;
    store.moveColumnItem(itemId, newIndex);
  },
  setColumnWidth: (store, args) => {
    if (typeof args.columnId === "string" && typeof args.width === "number") {
      store.setColumnWidth(args.columnId, args.width);
    }
  },
  updateColumn: (store, args) => {
    const id = args.id as string | undefined;
    if (!id) return;
    // R sends a `changes` payload of named properties to merge. Resolve the
    // current ColumnSpec from the store's effective column defs, merge, and
    // write back via updateColumn(id, newSpec).
    const current = store.allColumns.find((c) => c.id === id);
    if (!current) return;
    const changes = (args.changes as Record<string, unknown>) ?? {};
    const topProps = new Set([
      "header", "align", "headerAlign", "header_align", "wrap",
      "sortable", "width", "type", "field",
    ]);
    const next: ColumnSpec = { ...current };
    for (const [k, v] of Object.entries(changes)) {
      if (k === "options" && typeof v === "object" && v !== null) {
        next.options = { ...(next.options ?? {}), ...(v as Record<string, unknown>) };
      } else if (topProps.has(k)) {
        const destKey = k === "header_align" ? "headerAlign" : k;
        (next as unknown as Record<string, unknown>)[destKey] = v;
      } else {
        // Unknown key falls into options (mirrors R-side semantics).
        next.options = { ...(next.options ?? {}), [k]: v };
      }
    }
    store.updateColumn(id, next);
  },

  // ---- Row ops ----
  selectRows: (store, args) => {
    const ids = Array.isArray(args.rowIds) ? (args.rowIds as unknown[]).map(String) : [];
    store.setSelectedRows(ids);
  },
  moveRow: (store, args) => {
    const rowId = args.rowId as string | undefined;
    if (!rowId) return;
    let newIndex: number | undefined;
    if (typeof args.newIndex === "number" && Number.isFinite(args.newIndex)) {
      newIndex = args.newIndex;
    } else if (typeof args.before === "string" && args.before) {
      // Need row's scope to resolve an id-relative position.
      // Store doesn't expose a direct getter, but siblings-for-scope can be
      // derived via spec.data.rows. Keep this simple: only numeric moves for now.
      return;
    }
    if (newIndex === undefined) return;
    store.moveRowItem(rowId, newIndex);
  },

  // ---- Cell edits ----
  setCell: (store, args) => {
    if (typeof args.rowId === "string" && typeof args.field === "string") {
      store.setCellValue(args.rowId, args.field, args.value as Parameters<ForestStore["setCellValue"]>[2]);
    }
  },
  setRowLabel: (store, args) => {
    if (typeof args.rowId === "string" && typeof args.label === "string") {
      store.setRowLabel(args.rowId, args.label);
    }
  },
  clearEdits: (store) => {
    store.clearAllEdits();
  },

  // ---- Global ----
  setTheme: (store, args) => {
    if (typeof args.name === "string") {
      store.setTheme(args.name as ThemeName);
    }
    // Full WebTheme payloads are not yet applied runtime-side; silently
    // accept so the proxy call doesn't error, and let the future wire-up
    // populate `args.theme` into a store method.
  },
  setZoom: (store, args) => {
    if (typeof args.zoom === "number") store.setZoom(args.zoom);
    if (typeof args.autoFit === "boolean") store.setAutoFit(args.autoFit);
    if (args.maxWidth === null || typeof args.maxWidth === "number") {
      store.setMaxWidth(args.maxWidth as number | null);
    }
    if (args.maxHeight === null || typeof args.maxHeight === "number") {
      store.setMaxHeight(args.maxHeight as number | null);
    }
    if (typeof args.showZoomControls === "boolean") {
      store.setShowZoomControls(args.showZoomControls);
    }
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
        if (window.Shiny && el.id) {
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
// Every outbound input uses a uniform envelope: { value, source, ts }. `source`
// is "user" for widget-driven mutations and "proxy" for Shiny-pushed ones — the
// store's withSource() wrapper around proxy dispatch (below) makes markSource()
// capture the right tag synchronously inside each setter, before $effect runs.
function setupShinyBindings(widgetId: string, store: ForestStore) {
  const emit = (field: string, value: unknown) => {
    if (!window.Shiny) return;
    window.Shiny.setInputValue(
      `${widgetId}_${field}`,
      { value, source: store.getSource(field), ts: Date.now() },
      { priority: "event" },
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
        if (!window.Shiny) return;
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
        window.Shiny.setInputValue(
          `${widgetId}_state`,
          { value: bundle, source: "user", ts: Date.now() },
          { priority: "event" },
        );
      }, 150);
    });
  });
}

// Register with HTMLWidgets
if (typeof window !== "undefined" && window.HTMLWidgets) {
  window.HTMLWidgets.widget(binding);
}

// Shiny proxy message handler. withSource('proxy', ...) sets the store's
// currentSource for the synchronous mutation block, so every markSource()
// call inside the dispatched handler captures 'proxy' before the outbound
// $effect tick fires. Dashboards can then filter their own writes via
// `req(input$tbl_sort$source == "user")`.
if (typeof window !== "undefined" && window.Shiny) {
  window.Shiny.addCustomMessageHandler(
    "tabviz-proxy",
    (raw: unknown) => {
      const msg = raw as { id: string; method: string; args: Record<string, unknown> };
      const store = storeRegistry.get(msg.id);
      if (store && msg.method in proxyMethods) {
        store.withSource("proxy", () => {
          proxyMethods[msg.method](store, msg.args);
        });
      }
    }
  );
}

// Export for potential npm package use
export { ForestPlot, createForestStore };
export type * from "$types";

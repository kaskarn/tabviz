import type { WebSpec, HTMLWidgetsBinding, WidgetInstance } from "$types";
import ForestPlot from "$lib/ForestPlot.svelte";
import { createForestStore, type ForestStore } from "$stores/forestStore.svelte";
import { mount, unmount } from "svelte";
import "./styles.css";

// Store registry for Shiny proxy support
const storeRegistry = new Map<string, ForestStore>();

// Proxy method handlers
const proxyMethods: Record<string, (store: ForestStore, args: Record<string, unknown>) => void> = {
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
    store.setFilter(args.filter as Parameters<ForestStore["setFilter"]>[0]);
  },
  clearFilter: (store) => {
    store.setFilter(null);
  },
  sortBy: (store, args) => {
    store.sortBy(
      args.column as string,
      args.direction as "asc" | "desc" | "none"
    );
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
      renderValue: (x: WebSpec & {
        zoom?: number;
        autoFit?: boolean;
        maxWidth?: number | null;
        maxHeight?: number | null;
        showZoomControls?: boolean;
      }) => {
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

// Set up Shiny input bindings
function setupShinyBindings(widgetId: string, store: ForestStore) {
  // Use $effect.root() to create a reactive context outside component initialization
  $effect.root(() => {
    // Forward selection events
    $effect(() => {
      const ids = store.selectedRowIds;
      window.Shiny?.setInputValue(`${widgetId}_selected`, Array.from(ids), {
        priority: "event",
      });
    });

    // Forward hover events
    $effect(() => {
      const hovered = store.hoveredRowId;
      window.Shiny?.setInputValue(`${widgetId}_hover`, hovered, {
        priority: "event",
      });
    });
  });
}

// Register with HTMLWidgets
if (typeof window !== "undefined" && window.HTMLWidgets) {
  window.HTMLWidgets.widget(binding);
}

// Shiny proxy message handler
if (typeof window !== "undefined" && window.Shiny) {
  window.Shiny.addCustomMessageHandler(
    "tabviz-proxy",
    (msg: { id: string; method: string; args: Record<string, unknown> }) => {
      const store = storeRegistry.get(msg.id);
      if (store && msg.method in proxyMethods) {
        proxyMethods[msg.method](store, msg.args);
      }
    }
  );
}

// Export for potential npm package use
export { ForestPlot, createForestStore };
export type * from "$types";

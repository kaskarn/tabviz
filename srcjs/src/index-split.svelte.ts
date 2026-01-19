import type { SplitForestPayload, HTMLWidgetsBinding, WidgetInstance } from "$types";
import SplitForestPlot from "$lib/SplitForestPlot.svelte";
import { createSplitForestStore, type SplitForestStore } from "$stores/splitForestStore.svelte";
import { mount, unmount } from "svelte";
import "./styles.css";

// Store registry for Shiny proxy support
const storeRegistry = new Map<string, SplitForestStore>();

// HTMLWidgets binding for split forest
const binding: HTMLWidgetsBinding = {
  name: "tabviz_split",
  type: "output",
  factory: (el: HTMLElement, width: number, height: number): WidgetInstance => {
    let component: ReturnType<typeof mount> | null = null;
    const store = createSplitForestStore();

    // Register store for potential Shiny proxy access
    if (el.id) {
      storeRegistry.set(el.id, store);
    }

    return {
      renderValue: (x: SplitForestPayload) => {
        store.setPayload(x);
        store.setDimensions(width, height);

        // Set container to fill available space
        el.style.height = '100%';
        el.style.minHeight = '400px';

        if (component) {
          unmount(component);
        }

        component = mount(SplitForestPlot, {
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
function setupShinyBindings(widgetId: string, store: SplitForestStore) {
  // Use $effect.root() to create a reactive context outside component initialization
  $effect.root(() => {
    // Forward active plot selection events
    $effect(() => {
      const activeKey = store.activeKey;
      window.Shiny?.setInputValue(`${widgetId}_active_plot`, activeKey, {
        priority: "event",
      });
    });

    // Forward row selection from active store
    $effect(() => {
      const ids = store.activeStore.selectedRowIds;
      window.Shiny?.setInputValue(`${widgetId}_selected`, Array.from(ids), {
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
    "tabviz-split-proxy",
    (msg: { id: string; method: string; args: Record<string, unknown> }) => {
      const store = storeRegistry.get(msg.id);
      if (!store) return;

      if (msg.method === "selectPlot" && typeof msg.args.key === "string") {
        store.selectSpec(msg.args.key);
      }
    }
  );
}

// Export for potential npm package use
export { SplitForestPlot, createSplitForestStore };

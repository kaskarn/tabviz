import type { SplitForestPayload, HTMLWidgetsBinding, WidgetInstance } from "$types";
import SplitForestPlot from "$lib/SplitForestPlot.svelte";
import { createSplitForestStore, type SplitForestStore } from "$stores/splitForestStore.svelte";
import { shinyEnvelope } from "$lib/shiny-envelope";
import { validateSpecVersion } from "$spec";
import {
  hasShiny,
  registerCustomMessageHandler,
  registerWidget,
  setShinyInput,
} from "./htmlwidgets-glue";
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
      renderValue: (raw: unknown) => {
        // Validate wire-format version before handing off to the store; throws
        // with a clear message on unrecognized major. See $spec/index.ts.
        validateSpecVersion(raw as { version?: unknown }, "SplitForestPayload");
        const x = raw as SplitForestPayload;
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
// Split-widget v1 emits ShinyEnvelope-wrapped values for active_plot and
// selected (paint-derived from the active sub-store). Per-active-store
// full Tier-1 observability is deferred — consumers can still observe the
// active sub-store's own outputs once richer cross-cutting wiring lands.
// See docs/dev/source-tagging.md for the envelope contract.
function setupShinyBindings(widgetId: string, store: SplitForestStore) {
  $effect.root(() => {
    $effect(() => {
      const activeKey = store.activeKey;
      setShinyInput(
        `${widgetId}_active_plot`,
        shinyEnvelope(activeKey, store.activeKeySource),
      );
    });

    $effect(() => {
      const ids = Array.from(store.activeStore.selectedRowIds);
      setShinyInput(
        `${widgetId}_selected`,
        shinyEnvelope(ids, store.activeStore.getSource("selected")),
      );
    });
  });
}

// Register with HTMLWidgets
registerWidget(binding);

// Shiny proxy message handler
registerCustomMessageHandler("tabviz-split-proxy", (raw: unknown) => {
  const msg = raw as { id: string; method: string; args: Record<string, unknown> };
  const store = storeRegistry.get(msg.id);
  if (!store) return;

  if (msg.method === "selectPlot" && typeof msg.args.key === "string") {
    store.selectSpec(msg.args.key, "proxy");
  }
});

// Export for potential npm package use
export { SplitForestPlot, createSplitForestStore };

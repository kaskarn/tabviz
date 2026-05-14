import type { SplitForestPayload, HTMLWidgetsBinding, WidgetInstance } from "$types";
import type { SplitForestStore } from "$stores/splitForestStore.svelte";
import { createSplitTabviz, type SplitTabvizInstance } from "$lib/createSplitTabviz";
import { shinyEnvelope } from "$lib/shiny-envelope";
import { normalize } from "$spec/proxy-args.ts";
import {
  hasShiny,
  registerCustomMessageHandler,
  registerWidget,
  setShinyInput,
} from "./glue";
import "../styles.css";

// Store registry for Shiny proxy support
const storeRegistry = new Map<string, SplitForestStore>();

// HTMLWidgets binding — consumes the public `createSplitTabviz` factory.
// Phase 1: factory owns wire-version validation, payload ingestion, mount.
const binding: HTMLWidgetsBinding = {
  name: "tabviz_split",
  type: "output",
  factory: (el: HTMLElement, width: number, height: number): WidgetInstance => {
    let instance: SplitTabvizInstance | null = null;

    return {
      renderValue: (raw: unknown) => {
        const x = raw as SplitForestPayload;
        if (instance === null) {
          instance = createSplitTabviz(el, x, { width, height });
          if (el.id) storeRegistry.set(el.id, instance.store);
          // Set container to fill available space.
          el.style.height = "100%";
          el.style.minHeight = "400px";
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

// Shiny proxy message handler.
//
// Dispatch table mirrors the single-widget shape from ./index.svelte.ts
// (typed normalizer per method; handlers receive typed args). Currently
// the split widget exposes only `selectPlot`; future methods (re-pane,
// reorder panes, etc.) land here as siblings.
const splitProxyMethods: Record<string, (store: SplitForestStore, args: Record<string, unknown>) => void> = {
  selectPlot: (store, raw) => {
    const a = normalize.selectPlot(raw);
    if (!a) return;
    store.selectSpec(a.key, "proxy");
  },
};
export { splitProxyMethods };

registerCustomMessageHandler("tabviz-split-proxy", (raw: unknown) => {
  const msg = raw as { id: string; method: string; args: Record<string, unknown> };
  const store = storeRegistry.get(msg.id);
  if (!store) return;
  const handler = splitProxyMethods[msg.method];
  if (!handler) return;
  handler(store, msg.args);
});


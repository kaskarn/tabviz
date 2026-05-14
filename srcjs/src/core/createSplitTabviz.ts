// createSplitTabviz — public factory for the split-widget (multi-pane)
// tabviz instance. Peer of `createTabviz` per spec §3.1 and §3.10.
//
// The split widget composes multiple ForestStore instances under a
// SplitForestStore shell, navigating between panes via the activeKey.
// Its public API is a strict subset of the single-widget instance API
// (no per-row sort/filter etc. — those would target the active pane's
// inner store, which a future API revision can expose).

import { mount, unmount, type Component } from "svelte";
import SplitForestPlot from "$svelte/SplitForestPlot.svelte";
import {
  createSplitForestStore,
  type SplitForestStore,
} from "$stores/splitForestStore.svelte";
import { validateSpecVersion } from "$spec";
import type { SplitForestPayload } from "$types";

export interface SplitTabvizOptions {
  width?: number;
  height?: number;
}

export interface SplitTabvizInstance {
  /** Replace the current split payload wholesale. */
  update(payload: SplitForestPayload): void;
  /** Switch to a specific pane by key. The R-side `select_plot()` proxy
   *  routes here via the htmlwidgets adapter. */
  selectPane(key: string): void;
  /** Unmount the rendered widget. */
  destroy(): void;
  /**
   * Direct split-store reference. Exposed for the htmlwidgets adapter
   * (which forwards events from the inner active store) and advanced
   * consumers. Not part of the stable public surface.
   */
  readonly store: SplitForestStore;
}

export function createSplitTabviz(
  element: HTMLElement,
  payload: SplitForestPayload,
  options: SplitTabvizOptions = {},
): SplitTabvizInstance {
  validateSpecVersion(payload as { version?: unknown }, "SplitForestPayload");
  const store = createSplitForestStore();
  store.setPayload(payload);
  const w = options.width ?? element.clientWidth;
  const h = options.height ?? element.clientHeight;
  if (w > 0 && h > 0) store.setDimensions(w, h);

  const component = mount(SplitForestPlot as unknown as Component, {
    target: element,
    props: { store },
  });

  return {
    update(nextPayload) {
      validateSpecVersion(nextPayload as { version?: unknown }, "SplitForestPayload");
      store.setPayload(nextPayload);
    },
    selectPane(key) {
      store.selectSpec(key, "user");
    },
    destroy() {
      unmount(component);
    },
    get store() {
      return store;
    },
  };
}

export type { SplitForestPayload, SplitForestStore };

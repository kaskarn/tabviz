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

/**
 * Validate the wire discriminator. R-side `serialize_split_table` emits
 * `type: "split_table"` (matches the function name `split_table()`);
 * anything else means we've been handed the wrong payload shape and the
 * runtime should refuse rather than silently render an empty pane.
 */
function validateSplitPayloadType(payload: { type?: unknown }): void {
  if (payload.type !== "split_table") {
    throw new TypeError(
      `SplitForestPayload: expected type === "split_table" (R emits this from serialize_split_table()), ` +
      `got ${JSON.stringify(payload.type)}. Are you handing this a single-table WebSpec?`,
    );
  }
}

export function createSplitTabviz(
  element: HTMLElement,
  payload: SplitForestPayload,
  options: SplitTabvizOptions = {},
): SplitTabvizInstance {
  validateSpecVersion(payload as { version?: unknown }, "SplitForestPayload");
  validateSplitPayloadType(payload as { type?: unknown });
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
      validateSplitPayloadType(nextPayload as { type?: unknown });
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

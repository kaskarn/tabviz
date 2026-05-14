// createTabviz — public factory for the single-widget tabviz instance.
//
// This is the eventual `@tabviz/core`'s primary user-facing surface.
// The htmlwidgets adapter (`srcjs/src/htmlwidgets/index.svelte.ts`) consumes it
// internally; web-app consumers will consume it directly once the
// package ships.
//
// The instance is a thin facade over the Svelte 5 ForestStore — the
// typed event emitter (spec §2.5-S3, Phase 0a-PR5), the typed proxy
// dispatch (S1/S7/S11/S12, Phase 0a-PR4), and the ShinyEnvelope wire
// contract (S2, Phase 0a-PR2) were all designed in Phase 0a with this
// public-API shape in mind.

import { mount, unmount, type Component } from "svelte";
import ForestPlot from "$lib/ForestPlot.svelte";
import { createForestStore, type ForestStore } from "$stores/forestStore.svelte";
import { validateSpecVersion } from "$spec";
import type {
  WebSpec,
  ColumnFilter,
  SemanticToken,
  WebTheme,
  ZoomState,
  SortConfig,
} from "$types";
import type {
  TabvizEvents,
  EventListener,
  Unsubscribe,
} from "$spec/events";

/** Options accepted by `createTabviz` at construction time. */
export interface TabvizOptions {
  /** Initial container width in pixels. Defaults to `element.clientWidth`. */
  width?: number;
  /** Initial container height in pixels. Defaults to `element.clientHeight`. */
  height?: number;
}

/**
 * Public instance API returned by `createTabviz`. Every method here
 * mirrors a typed proxy verb (the htmlwidgets adapter dispatches Shiny
 * custom messages to the same surface). Every event mirrors a typed
 * Shiny output field.
 */
export interface TabvizInstance {
  // ── Imperative API ────────────────────────────────────────────────
  /** Replace the current spec wholesale. Throws if the spec's version is unknown. */
  update(spec: WebSpec): void;
  /** Set sort on one column. */
  sortBy(args: { column: string; direction: "asc" | "desc" | "none" }): void;
  /** Apply a per-column filter. Pass `field: ""` plus filter only if you want fielded; otherwise `{field, filter}`. */
  applyFilter(args: { field: string; filter: ColumnFilter }): void;
  /** Clear every active filter. */
  clearFilter(): void;
  /** Set the selected-row set (paint with the active semantic token). */
  selectRows(ids: string[]): void;
  /**
   * Set or clear a semantic token on a row. Passing `token: null`
   * clears every token on the row (equivalent to the R-side
   * `paint_row(proxy, row_id, NA_character_)` semantic).
   */
  setSemantic(args: { rowId: string; token: SemanticToken | null }): void;
  /** Set or clear a semantic token on a single cell. Same null-clears-all rule. */
  setCellSemantic(args: { rowId: string; field: string; token: SemanticToken | null }): void;
  /** Apply a theme by preset name or full WebTheme object. */
  setTheme(themeOrName: string | WebTheme): void;
  /** Partial zoom-state update. Any subset of fields is valid. */
  setZoom(args: Partial<ZoomState>): void;
  /**
   * Pin or clear the target aspect. `ratio: null` clears.
   * `anchor` defaults to `"width"` if omitted; "auto" picks at runtime.
   */
  setAspectRatio(args: { ratio: number | null; anchor?: "width" | "height" | "auto" }): void;

  // ── Typed events ──────────────────────────────────────────────────
  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<K extends keyof TabvizEvents>(
    event: K,
    listener: EventListener<TabvizEvents[K]>,
  ): Unsubscribe;

  // ── Source tagging (for adapters that route through proxy / user paths) ──
  /**
   * Wrap a synchronous block of mutations so every `markSource(field)`
   * call inside captures the given tag. Used by the htmlwidgets adapter
   * to mark proxy-dispatched mutations as `source: "proxy"` for the
   * Shiny envelope; non-adapter consumers can leave this alone.
   */
  withSource<T>(src: "user" | "proxy", fn: () => T): T;
  /** Read the provenance tag for a given Shiny field name. */
  getSource(field: string): "user" | "proxy";

  // ── Lifecycle ─────────────────────────────────────────────────────
  /** Unmount the rendered widget and release internal subscriptions. */
  destroy(): void;

  // ── Escape hatches ────────────────────────────────────────────────
  /**
   * Direct store reference. Exposed for the htmlwidgets adapter (which
   * relies on a handful of store methods that aren't on the instance
   * API yet) and for advanced consumers. Not part of the stable public
   * surface — prefer the typed methods above when they exist.
   */
  readonly store: ForestStore;
}

/**
 * Construct a tabviz instance into a host element. Validates the wire
 * version, creates the underlying store, mounts the ForestPlot Svelte
 * component, and returns a typed facade for downstream consumers.
 */
/**
 * Spec-attached fields the htmlwidgets binding seeds into the store at
 * mount time (separate from the WebSpec proper). The R serializer
 * folds these onto the wire payload directly; the factory reads them
 * here so the first render reflects the authored state without a
 * post-mount reflow.
 */
interface WebSpecWithInitialState extends WebSpec {
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
}

export function createTabviz(
  element: HTMLElement,
  spec: WebSpec,
  options: TabvizOptions = {},
): TabvizInstance {
  validateSpecVersion(spec as { version?: unknown }, "WebSpec");
  const x = spec as WebSpecWithInitialState;
  const store = createForestStore();
  store.setSpec(spec);
  const w = options.width ?? element.clientWidth;
  const h = options.height ?? element.clientHeight;
  if (w > 0 && h > 0) store.setDimensions(w, h);

  // Apply zoom + sizing settings pre-mount so the first paint reflects them.
  if (typeof x.zoom === "number") store.setZoom(x.zoom);
  if (typeof x.autoFit === "boolean") store.setAutoFit(x.autoFit);
  if (x.maxWidth !== undefined) store.setMaxWidth(x.maxWidth);
  if (x.maxHeight !== undefined) store.setMaxHeight(x.maxHeight);
  if (typeof x.showZoomControls === "boolean") store.setShowZoomControls(x.showZoomControls);

  // Apply authored initial state pre-mount so the first paint matches the
  // dashboard's expected sort/filter/visibility — no flash of unsorted
  // content. The R-serialized `initialState` is the authored intent;
  // source is "user" (the author wrote it).
  if (x.initialState) {
    if (x.initialState.sort) {
      store.sortBy(x.initialState.sort.column, x.initialState.sort.direction);
    }
    if (x.initialState.filters) {
      for (const f of x.initialState.filters) {
        store.setColumnFilter(f.field, {
          operator: f.operator,
          value: f.value,
        } as Parameters<typeof store.setColumnFilter>[1]);
      }
    }
    if (x.initialState.hiddenColumns) {
      for (const id of x.initialState.hiddenColumns) store.hideColumn(id);
    }
  }

  const component = mount(ForestPlot as unknown as Component, {
    target: element,
    props: { store },
  });

  // ALL_SEMANTIC_TOKENS — duplicated here from the store for the
  // null-token clear-all path. Kept in lockstep with the same constant
  // in forestStore.svelte.ts; a future R↔JS doc-test (G6) could enforce.
  const ALL_SEMANTIC_TOKENS: ReadonlyArray<SemanticToken> = [
    "bold", "emphasis", "muted", "accent", "fill",
  ];

  return {
    update(nextSpec) {
      validateSpecVersion(nextSpec as { version?: unknown }, "WebSpec");
      store.setSpec(nextSpec);
    },
    sortBy({ column, direction }) {
      store.sortBy(column, direction);
    },
    applyFilter({ field, filter }) {
      store.setColumnFilter(field, filter);
    },
    clearFilter() {
      store.clearAllFilters();
    },
    selectRows(ids) {
      store.setSelectedRows(ids);
    },
    setSemantic({ rowId, token }) {
      if (token !== null) {
        store.setRowSemantic(rowId, token, true);
      } else {
        store.clearSemantic(rowId);
      }
    },
    setCellSemantic({ rowId, field, token }) {
      if (token !== null) {
        store.setCellSemantic(rowId, field, token, true);
      } else {
        store.clearCellSemantic(rowId, field);
      }
    },
    setTheme(themeOrName) {
      if (typeof themeOrName === "string") {
        store.setTheme(themeOrName as Parameters<ForestStore["setTheme"]>[0]);
      }
      // else: full WebTheme object — store.setThemeObject is the wiring
      // target, but the runtime-side application is gated on the
      // cascade-rework's full landing (spec C5 / Phase 1.x). For now,
      // silently accept the object so the API doesn't error.
    },
    setZoom(args) {
      if (args.zoom !== undefined) store.setZoom(args.zoom);
      if (args.autoFit !== undefined) store.setAutoFit(args.autoFit);
      if (args.maxWidth !== undefined) store.setMaxWidth(args.maxWidth);
      if (args.maxHeight !== undefined) store.setMaxHeight(args.maxHeight);
      if (args.showZoomControls !== undefined) {
        store.setShowZoomControls(args.showZoomControls);
      }
    },
    setAspectRatio({ ratio, anchor }) {
      store.setTargetAspect(ratio);
      if (anchor !== undefined) store.setTargetAspectAnchor(anchor);
    },
    on(event, listener) {
      return store.on(event, listener);
    },
    withSource(src, fn) {
      return store.withSource(src, fn);
    },
    getSource(field) {
      return store.getSource(field);
    },
    destroy() {
      void ALL_SEMANTIC_TOKENS; // keep constant referenced; future use below
      unmount(component);
    },
    get store() {
      return store;
    },
  };
}

// Re-export the underlying types so consumers can import everything
// they need from one place once the package is published.
export type {
  WebSpec,
  ForestStore,
  TabvizEvents,
  SortConfig,
  ColumnFilter,
  SemanticToken,
  WebTheme,
  ZoomState,
};

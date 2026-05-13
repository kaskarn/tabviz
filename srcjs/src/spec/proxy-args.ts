// Wire-format types for tabviz-proxy / tabviz-split-proxy method args.
//
// Each interface here is the typed shape that `normalize.<method>(raw)`
// produces from the raw `Record<string, unknown>` R sends over the
// Shiny custom message channel. Per-method handlers in
// `srcjs/src/index.svelte.ts::proxyMethods` consume these typed shapes
// and dispatch to the store; coercion and validation live HERE, not in
// the handlers.
//
// SPEC ITEMS: S1 (typed dispatch), S7 (single-point snake/camel
// normalization), S11 (typed `updateColumn` patch), S12 (typed move
// positional union — see MoveColumnArgs/MoveRowArgs note below).
//
// SYNC POINT (G6): the R-side `R/shiny.R::invoke_proxy_method` dispatcher
// must keep its method-name list in sync with this file. The 0e
// synchronization audit deliberately reconciles them (the current
// proxy.test.ts fixture covers behavior on the JS side; an R-side
// doc-test will land in 0e).

import type {
  ColumnDef,
  ColumnFilter,
  ColumnSpec,
  SemanticToken,
  WebSpec,
  WebTheme,
} from "$types";
import type { ThemeName } from "$lib/theme-presets";

// ────────────────────────────────────────────────────────────────────────
// Per-method typed args
// ────────────────────────────────────────────────────────────────────────

/** `updateData` — wholesale spec replacement. R sends `{spec: ...}`. */
export interface UpdateDataArgs {
  spec: WebSpec;
}

/** `toggleGroup` — collapse/expand a row group. */
export interface ToggleGroupArgs {
  groupId: string;
  collapsed?: boolean;
}

/**
 * `applyFilter` — single typed shape post-PR7 (spec S4 + D3): always
 * carries a per-column `ColumnFilter` keyed by `field`. The pre-PR7
 * legacy `FilterConfig` shape is no longer accepted; payloads in that
 * shape are rejected by `normalize.applyFilter` and the dispatcher
 * silently drops them.
 */
export interface ApplyFilterArgs {
  field: string;
  filter: ColumnFilter;
}

/** `sortBy` — set sort on one column. */
export interface SortByArgs {
  column: string;
  direction: "asc" | "desc" | "none";
}

/** `addColumn` — insert a new column. */
export interface AddColumnArgs {
  column: ColumnSpec;
  afterId: string;
}

/** `hideColumn` — hide an existing column by id. */
export interface HideColumnArgs {
  id: string;
}

/**
 * `moveColumn` — reposition a column. Two-mode positional argument:
 * either an explicit index (resolved client-side from R's 0-based wire
 * value) or a sibling id to insert before. The "before" mode requires
 * store knowledge (sibling list) to materialize the final index, so it
 * lives JS-side by necessity — see the diary's PR4 note on S12.
 */
export interface MoveColumnArgs {
  itemId: string;
  position:
    | { kind: "index"; value: number }
    | { kind: "before"; value: string };
}

/** `moveRow` — reposition a row. Only index mode is supported today. */
export interface MoveRowArgs {
  rowId: string;
  position: { kind: "index"; value: number };
}

/** `setColumnWidth` — pin a column's width in pixels. */
export interface SetColumnWidthArgs {
  columnId: string;
  width: number;
}

/**
 * `updateColumn` — apply a partial patch to a column. The R-side wire
 * shape uses `{id, changes: {...}}` with `changes` carrying named
 * top-level props AND a special `options` sub-object. Normalize maps
 * snake_case top-level fields (e.g., `header_align`) to camelCase
 * before producing this typed patch.
 */
export interface UpdateColumnArgs {
  id: string;
  patch: ColumnPatch;
}

/**
 * Typed partial of `ColumnSpec`. Top-level fields are pre-normalized to
 * camelCase (the legacy `header_align` is mapped to `headerAlign`);
 * unknown fields in the wire `changes` payload land in `options`.
 */
export interface ColumnPatch {
  header?: ColumnSpec["header"];
  align?: ColumnSpec["align"];
  headerAlign?: ColumnSpec["headerAlign"];
  wrap?: ColumnSpec["wrap"];
  sortable?: ColumnSpec["sortable"];
  width?: ColumnSpec["width"];
  type?: ColumnSpec["type"];
  field?: ColumnSpec["field"];
  options?: Record<string, unknown>;
}

/** `selectRows` — set the selected-row set. */
export interface SelectRowsArgs {
  rowIds: string[];
}

/** `setCell` — author-side cell value override. */
export interface SetCellArgs {
  rowId: string;
  field: string;
  value: unknown;
}

/** `setRowLabel` — override a row's label. */
export interface SetRowLabelArgs {
  rowId: string;
  label: string;
}

/** `setRowSemantic` — toggle a row-level semantic token (or clear all). */
export interface SetRowSemanticArgs {
  rowId: string;
  token: SemanticToken | null;
}

/** `setCellSemantic` — toggle a cell-level semantic token (or clear all). */
export interface SetCellSemanticArgs {
  rowId: string;
  field: string;
  token: SemanticToken | null;
}

/** `setTheme` — apply a named preset, a full WebTheme object, or both. */
export type SetThemeArgs =
  | { kind: "name"; name: ThemeName }
  | { kind: "theme"; theme: WebTheme };

/** `setZoom` — partial zoom-state update; any subset of fields is valid. */
export interface SetZoomArgs {
  zoom?: number;
  autoFit?: boolean;
  maxWidth?: number | null;
  maxHeight?: number | null;
  showZoomControls?: boolean;
}

/**
 * `setAspectRatio` — pin or clear the target aspect, optionally with
 * an explicit anchor. `ratio: null` clears.
 */
export interface SetAspectRatioArgs {
  ratio: number | null;
  anchor?: "width" | "height" | "auto";
}

// ────────────────────────────────────────────────────────────────────────
// Normalization helpers
// ────────────────────────────────────────────────────────────────────────
//
// Each `normalize.<method>(raw)` validates a raw payload and returns the
// typed args, or `null` if the payload is invalid (proxy handler returns
// silently in that case — matches today's defensive style).

const VALID_SEMANTIC_TOKENS: ReadonlyArray<SemanticToken> = [
  "bold", "emphasis", "muted", "accent", "fill",
];

function isSemanticToken(x: unknown): x is SemanticToken {
  return typeof x === "string" && (VALID_SEMANTIC_TOKENS as ReadonlyArray<string>).includes(x);
}

/** True iff `x` is a finite number. */
function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** True iff `x` is the wire representation of an R `NA` (null). */
function isNA(x: unknown): boolean {
  return x === null || x === undefined;
}

export const normalize = {
  updateData(raw: Record<string, unknown>): UpdateDataArgs | null {
    if (!raw.spec || typeof raw.spec !== "object") return null;
    return { spec: raw.spec as WebSpec };
  },

  toggleGroup(raw: Record<string, unknown>): ToggleGroupArgs | null {
    if (typeof raw.groupId !== "string") return null;
    const collapsed = typeof raw.collapsed === "boolean" ? raw.collapsed : undefined;
    return { groupId: raw.groupId, collapsed };
  },

  applyFilter(raw: Record<string, unknown>): ApplyFilterArgs | null {
    // Post-PR7 wire shape (spec S4 + D3): exactly one of
    //   (a) { filter: { field, kind, operator, value, ... } }
    //   (b) { field, filter: { kind, operator, value, ... } }
    // The legacy untyped {filter: {field, operator, value}} shape is
    // rejected — R-side `filter_rows` was updated in the same PR to
    // always emit `kind`. If we see an old payload, return null
    // (dispatcher silently drops, dashboards continue working).
    if (raw.filter && typeof raw.filter === "object") {
      const f = raw.filter as Record<string, unknown>;
      // Inline-field shape (a)
      if ("kind" in f && typeof f.field === "string") {
        return { field: f.field, filter: f as unknown as ColumnFilter };
      }
      // External-field shape (b)
      if (typeof raw.field === "string" && "kind" in f) {
        return { field: raw.field, filter: f as unknown as ColumnFilter };
      }
    }
    return null;
  },

  sortBy(raw: Record<string, unknown>): SortByArgs | null {
    if (typeof raw.column !== "string") return null;
    if (raw.direction !== "asc" && raw.direction !== "desc" && raw.direction !== "none") return null;
    return { column: raw.column, direction: raw.direction };
  },

  addColumn(raw: Record<string, unknown>): AddColumnArgs | null {
    if (!raw.column || typeof raw.column !== "object") return null;
    const afterId = typeof raw.afterId === "string" ? raw.afterId : "";
    return { column: raw.column as ColumnSpec, afterId };
  },

  hideColumn(raw: Record<string, unknown>): HideColumnArgs | null {
    if (typeof raw.id !== "string") return null;
    return { id: raw.id };
  },

  moveColumn(raw: Record<string, unknown>): MoveColumnArgs | null {
    if (typeof raw.itemId !== "string") return null;
    if (isFiniteNumber(raw.newIndex)) {
      return { itemId: raw.itemId, position: { kind: "index", value: raw.newIndex } };
    }
    if (typeof raw.before === "string" && raw.before) {
      return { itemId: raw.itemId, position: { kind: "before", value: raw.before } };
    }
    return null;
  },

  moveRow(raw: Record<string, unknown>): MoveRowArgs | null {
    if (typeof raw.rowId !== "string") return null;
    if (!isFiniteNumber(raw.newIndex)) return null;
    return { rowId: raw.rowId, position: { kind: "index", value: raw.newIndex } };
  },

  setColumnWidth(raw: Record<string, unknown>): SetColumnWidthArgs | null {
    if (typeof raw.columnId !== "string") return null;
    if (!isFiniteNumber(raw.width)) return null;
    return { columnId: raw.columnId, width: raw.width };
  },

  updateColumn(raw: Record<string, unknown>): UpdateColumnArgs | null {
    if (typeof raw.id !== "string") return null;
    const changes = (raw.changes && typeof raw.changes === "object")
      ? raw.changes as Record<string, unknown>
      : {};

    const TOP_PROPS: ReadonlySet<keyof ColumnPatch | "header_align"> = new Set([
      "header", "align", "headerAlign", "header_align", "wrap",
      "sortable", "width", "type", "field",
    ] as const);

    const patch: ColumnPatch = {};
    for (const [k, v] of Object.entries(changes)) {
      if (k === "options" && v && typeof v === "object") {
        patch.options = { ...(patch.options ?? {}), ...(v as Record<string, unknown>) };
      } else if (TOP_PROPS.has(k as keyof ColumnPatch | "header_align")) {
        // snake/camel normalization at the wire boundary (S7).
        const destKey: keyof ColumnPatch = k === "header_align" ? "headerAlign" : (k as keyof ColumnPatch);
        (patch as Record<string, unknown>)[destKey] = v;
      } else {
        // Unknown key falls into options (mirrors R-side semantics).
        patch.options = { ...(patch.options ?? {}), [k]: v };
      }
    }
    return { id: raw.id, patch };
  },

  selectRows(raw: Record<string, unknown>): SelectRowsArgs | null {
    if (!Array.isArray(raw.rowIds)) return null;
    return { rowIds: raw.rowIds.map(String) };
  },

  setCell(raw: Record<string, unknown>): SetCellArgs | null {
    if (typeof raw.rowId !== "string" || typeof raw.field !== "string") return null;
    return { rowId: raw.rowId, field: raw.field, value: raw.value };
  },

  setRowLabel(raw: Record<string, unknown>): SetRowLabelArgs | null {
    if (typeof raw.rowId !== "string" || typeof raw.label !== "string") return null;
    return { rowId: raw.rowId, label: raw.label };
  },

  setRowSemantic(raw: Record<string, unknown>): SetRowSemanticArgs | null {
    if (typeof raw.rowId !== "string") return null;
    const token = isSemanticToken(raw.token) ? raw.token : isNA(raw.token) ? null : null;
    return { rowId: raw.rowId, token };
  },

  setCellSemantic(raw: Record<string, unknown>): SetCellSemanticArgs | null {
    if (typeof raw.rowId !== "string" || typeof raw.field !== "string") return null;
    const token = isSemanticToken(raw.token) ? raw.token : isNA(raw.token) ? null : null;
    return { rowId: raw.rowId, field: raw.field, token };
  },

  setTheme(raw: Record<string, unknown>): SetThemeArgs | null {
    if (typeof raw.name === "string") return { kind: "name", name: raw.name as ThemeName };
    if (raw.theme && typeof raw.theme === "object") return { kind: "theme", theme: raw.theme as WebTheme };
    return null;
  },

  setZoom(raw: Record<string, unknown>): SetZoomArgs | null {
    const args: SetZoomArgs = {};
    if (isFiniteNumber(raw.zoom)) args.zoom = raw.zoom;
    if (typeof raw.autoFit === "boolean") args.autoFit = raw.autoFit;
    if (raw.maxWidth === null || isFiniteNumber(raw.maxWidth)) args.maxWidth = raw.maxWidth as number | null;
    if (raw.maxHeight === null || isFiniteNumber(raw.maxHeight)) args.maxHeight = raw.maxHeight as number | null;
    if (typeof raw.showZoomControls === "boolean") args.showZoomControls = raw.showZoomControls;
    // Even if every field is absent, return the (empty) typed shape so the
    // handler can be uniform; the dispatcher will simply call no setters.
    return args;
  },

  setAspectRatio(raw: Record<string, unknown>): SetAspectRatioArgs | null {
    // Spec §2.5-S9: explicit contract. `null` (or R's NA_real_ → null
    // over wire) clears the target. A finite positive number pins it.
    // Anything else (NaN, Infinity, <=0, non-numeric) is invalid input
    // and we reject the call rather than inferring a clear — silent
    // inference was the bug this normalizer is paying down.
    let ratio: number | null;
    const r = raw.ratio;
    if (isNA(r)) {
      ratio = null;
    } else if (isFiniteNumber(r) && r > 0) {
      ratio = r;
    } else {
      return null;
    }
    const a = raw.anchor;
    const anchor: SetAspectRatioArgs["anchor"] =
      typeof a === "string" && (a === "width" || a === "height" || a === "auto") ? a : undefined;
    return { ratio, anchor };
  },
};

/** Type of the union of all method names handled above. */
export type ProxyMethod = keyof typeof normalize;

/**
 * Discriminated union of all typed proxy args. Indexed by method name
 * for use in handler tables.
 */
export type ProxyArgsByMethod = {
  [K in ProxyMethod]: NonNullable<ReturnType<typeof normalize[K]>>;
};

// Internal sanity: ensure every entry in `normalize` returns a value we
// can extract a type from. The `_unused` keeps tsc honest if a method
// is added without typing.
type _unused_AllReturned = ProxyArgsByMethod;
// Re-export `ColumnDef` so callers needing the broader column type have
// a single import surface. (No-op at runtime; verbatimModuleSyntax forces
// `import type` so tree-shaking elides.)
export type { ColumnDef };

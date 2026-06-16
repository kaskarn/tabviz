// Columns slice.
//
// Owns the entire column-state surface:
//   - columnWidths            Record<id, px>    — auto-measured + user-resized
//   - userResizedIds          Set<id>           — gate so re-measurement skips
//   - userInsertedColumns     InsertedColumn[]  — runtime "add column"
//   - hiddenColumnIds         Set<id>           — runtime "hide column"
//   - columnSpecOverrides     Record<id, spec>  — runtime "configure column"
//   - columnOrderOverrides    { topLevel, byGroup } — runtime reorder
//
// Plus the entire effective-column-tree derivation (effectiveColumnDefs,
// allColumns, allColumnDefs, primaryColumnId, forestColumns,
// hasExplicitForestColumns, vizColumns, hasVizColumns) — every consumer
// reads from these.
//
// Plus the big `measureAutoColumns()` + the `doMeasurement` inner — these
// touch only column state + the wrap-line-counts on the cells slice (via
// the `setWrapLineCounts` dep). Pulling them in keeps the slice
// self-contained: a single owner for "what columns exist, how wide they
// are, and how content wraps inside them."
//
// Dependencies (injected at construction):
//   - getSpec()              — WebSpec | null (read reactively)
//   - getAxisZooms()         — to mint a unique id that doesn't collide
//                              with an axis-zoom entry from a hidden col
//   - getWrapLineCounts()    — for the "did the count actually change?"
//                              short-circuit in doMeasurement
//   - setWrapLineCounts()    — written by doMeasurement after widths
//                              settle (cells slice owns the state)
//   - appendOp / markSource  — history + source-tag plumbing
//
// Phase 0c-C1 PR9.

import type {
  ColumnDef,
  ColumnGroup,
  ColumnOrderOverrides,
  ColumnSpec,
  WebSpec,
} from "$types";
import { getColumnDisplayText } from "$lib/formatters";
import { compileColumn } from "../../schema/variant-compile";
import { applyColumnOrder } from "$lib/column-order";
import { resolveInteraction } from "$lib/interaction-resolve";
import { glyphNaturalWidth, estimateTextWidth, tabularizeDigits } from "$lib/width-utils";
import { resolveRowKind, rowKindProps } from "$lib/layout/row-kind";
import {
  rankTopK,
  measureExact,
  DEFAULT_TOP_K,
  type FontKey,
} from "$lib/width-measure";
import {
  measureComposedColumnWidth,
  makeMeasureResolver,
  type ComposedCandidate,
} from "../../schema/measure-composed";
import type { StyleResolver } from "../../schema/render-svg";
import { ops, renderColumnBuilder, type OpRecord } from "$lib/op-recorder";
import {
  AUTO_WIDTH,
  BADGE,
  GROUP_HEADER,
  SPACING,
  TEXT_MEASUREMENT,
} from "$lib/rendering-constants";
import {
  getCssVars, readVar, readVarPx, readBodyFamily, readBodySize, readLabelSize,
} from "$lib/theme/consumer-bridge";

/**
 * Set of ids reserved for the store's internal use — colliding with these
 * would break scope detection and insert-anchor resolution. Kept in sync
 * with R's `RESERVED_COLUMN_IDS` (see `R/classes-components.R`). Exported
 * so tests + the main store can share the same set.
 */
export const RESERVED_COLUMN_IDS = new Set<string>(["__root__", "__start__"]);

/**
 * Pure helper: given a base id and a set of already-taken ids, return a
 * unique id by appending `_2`, `_3`, … to the base when needed.
 */
export function mintUniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

type InsertedColumn = { afterId: string; def: ColumnSpec };

export interface ColumnsSliceDeps {
  getSpec: () => WebSpec | null;
  getAxisZooms: () => Record<string, { domain: [number, number] }>;
  getWrapLineCounts: () => Record<string, number>;
  setWrapLineCounts: (counts: Record<string, number>) => void;
  appendOp: (record: OpRecord) => void;
  markSource: (field: string) => void;
  /** Live CSS-transform scale of `.tabviz-scalable` (rendered rect ÷ layout
   *  size). The widget lays out at a NATURAL size then transform-scales to
   *  fit, so a detached-canvas measure (visual px) under-states the grid's
   *  layout-space width by `1/scale`. Composed-cell tree measurement divides
   *  by this to land in the grid's space. Defaults to 1 (no scaling / first
   *  paint / V8). */
  getActualScale?: () => number;
}

export interface ColumnsSlice {
  readonly columnWidths: Record<string, number>;
  readonly userResizedIds: ReadonlySet<string>;
  readonly userInsertedColumns: readonly InsertedColumn[];
  readonly hiddenColumnIds: ReadonlySet<string>;
  readonly columnSpecOverrides: Record<string, ColumnSpec>;
  readonly columnOrderOverrides: ColumnOrderOverrides;

  readonly effectiveColumnDefs: ColumnDef[];
  readonly allColumns: ColumnSpec[];
  readonly allColumnDefs: ColumnDef[];
  readonly primaryColumnId: string | null;
  readonly forestColumns: { index: number; column: ColumnSpec }[];
  readonly hasExplicitForestColumns: boolean;
  readonly vizColumns: { index: number; column: ColumnSpec }[];
  readonly hasVizColumns: boolean;
  readonly hasColumnEdits: boolean;

  mintUniqueColumnId: (base: string) => string;
  insertColumn: (def: ColumnSpec, afterId: string) => void;
  hideColumn: (id: string) => void;
  updateColumn: (id: string, newSpec: ColumnSpec) => void;
  updateColumnPatch: (
    id: string,
    patch: {
      header?: ColumnSpec["header"];
      align?: ColumnSpec["align"];
      headerAlign?: ColumnSpec["headerAlign"];
      wrap?: ColumnSpec["wrap"];
      sortable?: ColumnSpec["sortable"];
      width?: ColumnSpec["width"];
      type?: ColumnSpec["type"];
      field?: ColumnSpec["field"];
      options?: Record<string, unknown>;
    },
  ) => void;
  clearColumnEdits: () => void;
  setColumnWidth: (columnId: string, width: number) => void;
  previewColumnWidth: (columnId: string, width: number) => void;
  /** Cancel a width-preview gesture: restore pre-drag width + pin state. */
  cancelPreviewColumnWidth: (columnId: string, startWidth: number, wasUserResized: boolean) => void;
  /** Reset one column to auto width (drop pin + re-measure). */
  resetColumnWidth: (columnId: string) => void;

  findColumnScope: (id: string) => string | null;
  siblingsForColumnScope: (scopeKey: string) => ColumnDef[];
  moveColumnItem: (itemId: string, newIndex: number) => void;
  clearColumnReorder: () => void;

  measureAutoColumns: () => void;
  clearAutoWidthsKeepingUserResizes: () => void;

  /** Called by `setSpec` to seed initial state from a fresh spec. */
  hydrateForSpec: () => void;
  /** Full wipe (used by `resetState`). Restores all column state to
   *  factory defaults; caller is expected to follow up with
   *  `measureAutoColumns()`. */
  reset: () => void;
}

export function createColumnsSlice(deps: ColumnsSliceDeps): ColumnsSlice {
  // `columnWidths` stays as `$state` (not `.raw`): `doMeasurement()` writes
  // entries in-place via `target[col.id] = w` (lines 584, 604, 710) and
  // `setColumnWidth` / `previewColumnWidth` also mutate keys directly
  // (lines 428, 445). Converting would require refactoring those writers
  // to spread-and-reassign; deferred until Phase 5 (see audit notes).
  let columnWidths = $state<Record<string, number>>({});
  // Remaining slice state is REPLACE-only (per audit). `$state.raw` skips
  // the deep-proxy wrap; the runtime read paths (Set.has, [k] lookup) work
  // identically without it.
  let userResizedIds = $state.raw<Set<string>>(new Set());
  let userInsertedColumns = $state.raw<InsertedColumn[]>([]);
  let hiddenColumnIds = $state.raw<Set<string>>(new Set());
  let columnSpecOverrides = $state.raw<Record<string, ColumnSpec>>({});
  let columnOrderOverrides = $state.raw<ColumnOrderOverrides>({ topLevel: null, byGroup: {} });

  // ── Helpers ────────────────────────────────────────────────────────────

  function flattenAllColumns(columns: ColumnDef[]): ColumnSpec[] {
    const result: ColumnSpec[] = [];
    for (const col of columns) {
      if (col.isGroup) {
        result.push(...flattenAllColumns(col.columns));
      } else {
        result.push(col);
      }
    }
    return result;
  }

  // applyColumnOrder lives in $lib/column-order — ONE implementation
  // shared with the SVG export path (which applies figureLayout.columnOrder
  // at spec ingest). Tolerance contract documented there.

  // Apply the user's runtime column edits to a ColumnDef list:
  //   1. replace specs the user Configure'd
  //   2. drop anything the user Hide'd
  //   3. insert user-added columns after their anchor id
  function applyColumnEdits(defs: ColumnDef[], isRoot: boolean): ColumnDef[] {
    const swappedOrHidden: ColumnDef[] = [];
    for (const def of defs) {
      if (hiddenColumnIds.has(def.id)) continue;
      if (!def.isGroup) {
        const override = columnSpecOverrides[def.id];
        if (override) {
          swappedOrHidden.push(override);
          continue;
        }
      }
      swappedOrHidden.push(def);
    }

    const out: ColumnDef[] = [];
    if (isRoot) {
      for (const ins of userInsertedColumns) {
        // User-inserted columns also honor hiddenColumnIds — without this
        // check, `hideColumn(insertedId)` adds the id to the set but the
        // inserted column still appears in the rendered output (GH #7).
        if (hiddenColumnIds.has(ins.def.id)) continue;
        if (ins.afterId === "__start__") out.push(ins.def as ColumnDef);
      }
    }
    for (const def of swappedOrHidden) {
      out.push(def);
      for (const ins of userInsertedColumns) {
        if (hiddenColumnIds.has(ins.def.id)) continue;
        if (ins.afterId === def.id) out.push(ins.def as ColumnDef);
      }
    }
    return out;
  }

  // ── Derived blocks ─────────────────────────────────────────────────────

  const effectiveColumnDefs = $derived.by((): ColumnDef[] => {
    const spec = deps.getSpec();
    if (!spec) return [];
    // Materialize the effective column list, prepending the wire-level
    // `labelColumn` slot when present. Legacy fallback: if `labelColumn`
    // is missing and `columns[0]?.id === "label"` (older R/TS wires
    // pre-0.34.2), we leave the inline column where it is — no need to
    // shuffle it. Both shapes produce identical rendering.
    const labelCol = spec.labelColumn ?? null;
    const baseColumns = labelCol ? [labelCol, ...spec.columns] : spec.columns;
    const merged = applyColumnEdits(baseColumns, true);
    const topOrdered = applyColumnOrder(merged, columnOrderOverrides.topLevel);
    return topOrdered.map((def) => {
      if (def.isGroup) {
        const mergedChildren = applyColumnEdits(def.columns, false);
        const reorderedChildren = applyColumnOrder(
          mergedChildren,
          columnOrderOverrides.byGroup[def.id],
        );
        return { ...def, columns: reorderedChildren };
      }
      return def;
    });
  });

  const allColumns = $derived.by((): ColumnSpec[] => {
    if (!deps.getSpec()) return [];
    return flattenAllColumns(effectiveColumnDefs);
  });

  const primaryColumnId = $derived.by((): string | null => {
    return allColumns[0]?.id ?? null;
  });

  const allColumnDefs = $derived.by((): ColumnDef[] => effectiveColumnDefs);

  const forestColumns = $derived.by((): { index: number; column: ColumnSpec }[] => {
    if (!deps.getSpec()) return [];
    const result: { index: number; column: ColumnSpec }[] = [];
    const cols = allColumns;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].type === "forest") {
        result.push({ index: i, column: cols[i] });
      }
    }
    return result;
  });

  const hasExplicitForestColumns = $derived(forestColumns.length > 0);

  const vizColumns = $derived.by((): { index: number; column: ColumnSpec }[] => {
    if (!deps.getSpec()) return [];
    const result: { index: number; column: ColumnSpec }[] = [];
    const cols = allColumns;
    const vizTypes = ["forest", "viz_bar", "viz_boxplot", "viz_violin"];
    for (let i = 0; i < cols.length; i++) {
      if (vizTypes.includes(cols[i].type)) {
        result.push({ index: i, column: cols[i] });
      }
    }
    return result;
  });

  const hasVizColumns = $derived(vizColumns.length > 0);

  const hasColumnEdits = $derived(
    userInsertedColumns.length > 0 ||
    hiddenColumnIds.size > 0 ||
    Object.keys(columnSpecOverrides).length > 0,
  );

  // ── Column reorder (DnD) ───────────────────────────────────────────────

  function findColumnScope(id: string): string | null {
    if (!deps.getSpec()) return null;
    for (const def of effectiveColumnDefs) {
      if (def.isGroup && def.columns.some((c) => c.id === id)) return def.id;
    }
    return null;
  }

  function siblingsForColumnScope(scopeKey: string): ColumnDef[] {
    if (scopeKey === "__root__") return effectiveColumnDefs;
    const group = effectiveColumnDefs.find((d) => d.isGroup && d.id === scopeKey) as ColumnGroup | undefined;
    return group ? group.columns : [];
  }

  function moveColumnItem(itemId: string, newIndex: number) {
    const scope = findColumnScope(itemId) ?? (effectiveColumnDefs.some((d) => d.id === itemId) ? "__root__" : null);
    if (!scope) return;
    const siblings = siblingsForColumnScope(scope);
    const order = siblings.map((d) => d.id);
    const fromIdx = order.indexOf(itemId);
    if (fromIdx === -1) return;

    order.splice(fromIdx, 1);
    const targetIdx = newIndex > fromIdx ? newIndex - 1 : newIndex;
    const clamped = Math.max(0, Math.min(order.length, targetIdx));
    order.splice(clamped, 0, itemId);

    if (scope === "__root__") {
      columnOrderOverrides = { ...columnOrderOverrides, topLevel: order };
    } else {
      columnOrderOverrides = {
        ...columnOrderOverrides,
        byGroup: { ...columnOrderOverrides.byGroup, [scope]: order },
      };
    }
    deps.appendOp(ops.moveColumn(itemId, newIndex + 1));
    deps.markSource("column_order");
  }

  function clearColumnReorder() {
    columnOrderOverrides = { topLevel: null, byGroup: {} };
  }

  // ── Interactive column add / remove / configure ────────────────────────

  function mintUniqueColumnId(base: string): string {
    const taken = new Set<string>(RESERVED_COLUMN_IDS);
    const spec = deps.getSpec();
    const walk = (defs: ColumnDef[]) => {
      for (const d of defs) {
        taken.add(d.id);
        if (d.isGroup) walk(d.columns);
      }
    };
    if (spec) walk(spec.columns);
    walk(userInsertedColumns.map((i) => i.def) as ColumnDef[]);
    for (const id of hiddenColumnIds) taken.add(id);
    for (const id of Object.keys(columnSpecOverrides)) taken.add(id);
    for (const id of Object.keys(columnWidths)) taken.add(id);
    for (const id of Object.keys(deps.getAxisZooms())) taken.add(id);
    for (const id of userResizedIds) taken.add(id);
    return mintUniqueId(base, taken);
  }

  function insertColumn(def: ColumnSpec, afterId: string) {
    const id = mintUniqueColumnId(def.id || def.field);
    userInsertedColumns = [...userInsertedColumns, { afterId, def: { ...def, id } }];
    const after = afterId === "__start__" ? "__start__" : afterId;
    deps.appendOp(ops.addColumn(renderColumnBuilder(def), after));
    deps.markSource("column_order");
  }

  function hideColumn(id: string) {
    if (hiddenColumnIds.has(id)) return;
    const next = new Set(hiddenColumnIds);
    next.add(id);
    hiddenColumnIds = next;
    deps.appendOp(ops.removeColumn(id));
    deps.markSource("hidden_columns");
    deps.markSource("column_order");
  }

  function updateColumn(id: string, newSpec: ColumnSpec) {
    // Recompile the active variant into options.<bucket>.__resolved for the
    // edited column. The bulk setSpec path runs compileVariants; this GRANULAR
    // edit path did not, so switching a column's variant in the editor set
    // options.<bucket>.variant but left the stale __resolved the renderer reads
    // — "doesn't fire, appearance unchanged" (2026-06-15). No-op for types
    // without variants (returned by reference).
    const compiled = compileColumn(newSpec);
    const insertedIdx = userInsertedColumns.findIndex((c) => c.def.id === id);
    if (insertedIdx >= 0) {
      const next = userInsertedColumns.slice();
      next[insertedIdx] = { ...next[insertedIdx], def: { ...compiled, id } };
      userInsertedColumns = next;
    } else {
      columnSpecOverrides = { ...columnSpecOverrides, [id]: { ...compiled, id } };
    }
    const patch: Record<string, unknown> = {};
    if (compiled.header !== undefined) patch.header = compiled.header;
    if (compiled.type !== undefined) patch.type = compiled.type;
    deps.appendOp(ops.updateColumn(id, patch));
    // Re-measure: a config change (header / type / options / variant / width)
    // can change a column's content width. Auto columns re-fit to the new
    // content; explicit-width columns drop their stale auto entry (see
    // measureLeafColumn). userResized columns are skipped by the measure pass.
    measureAutoColumns();
  }

  function updateColumnPatch(
    id: string,
    patch: {
      header?: ColumnSpec["header"];
      align?: ColumnSpec["align"];
      headerAlign?: ColumnSpec["headerAlign"];
      wrap?: ColumnSpec["wrap"];
      sortable?: ColumnSpec["sortable"];
      width?: ColumnSpec["width"];
      type?: ColumnSpec["type"];
      field?: ColumnSpec["field"];
      options?: Record<string, unknown>;
    },
  ) {
    const current = allColumns.find((c) => c.id === id);
    if (!current) return;
    const next: ColumnSpec = { ...current };
    if (patch.header !== undefined)      next.header = patch.header;
    if (patch.align !== undefined)       next.align = patch.align;
    if (patch.headerAlign !== undefined) next.headerAlign = patch.headerAlign;
    if (patch.wrap !== undefined)        next.wrap = patch.wrap;
    if (patch.sortable !== undefined)    next.sortable = patch.sortable;
    if (patch.width !== undefined)       next.width = patch.width;
    if (patch.type !== undefined)        next.type = patch.type;
    if (patch.field !== undefined)       next.field = patch.field;
    if (patch.options !== undefined)     next.options = { ...(next.options ?? {}), ...patch.options };
    updateColumn(id, next);
  }

  function clearColumnEdits() {
    userInsertedColumns = [];
    hiddenColumnIds = new Set();
    columnSpecOverrides = {};
  }

  function setColumnWidth(columnId: string, width: number) {
    const w = Math.max(40, width);
    columnWidths[columnId] = w;
    if (!userResizedIds.has(columnId)) {
      const next = new Set(userResizedIds);
      next.add(columnId);
      userResizedIds = next;
    }
    deps.appendOp(ops.resizeColumn(columnId, w));
    deps.markSource("column_widths");
  }

  /**
   * Live-preview a column width during drag without recording it to the op
   * log. Callers should still call `setColumnWidth()` on pointerup to commit
   * the final settled value.
   */
  function previewColumnWidth(columnId: string, width: number) {
    const w = Math.max(40, width);
    columnWidths[columnId] = w;
    if (!userResizedIds.has(columnId)) {
      const next = new Set(userResizedIds);
      next.add(columnId);
      userResizedIds = next;
    }
  }

  /**
   * Cancel a width-preview gesture (Escape mid-drag): restore the pre-drag
   * width and, when the column was NOT user-pinned before the drag, drop
   * the pin flag `previewColumnWidth` side-effected on — a cancelled
   * gesture must leave zero trace (no phantom permanent pin that would
   * freeze the column against flex/measure forever).
   */
  function cancelPreviewColumnWidth(
    columnId: string,
    startWidth: number,
    wasUserResized: boolean,
  ) {
    columnWidths[columnId] = Math.max(40, startWidth);
    if (!wasUserResized && userResizedIds.has(columnId)) {
      const next = new Set(userResizedIds);
      next.delete(columnId);
      userResizedIds = next;
    }
  }

  /**
   * Reset one column to auto width (the spreadsheet double-click idiom,
   * interactivity-UX arc P2): drop its user-resize pin + cached width and
   * re-run measurement so the column re-derives from content.
   */
  function resetColumnWidth(columnId: string) {
    const nextWidths = { ...columnWidths };
    delete nextWidths[columnId];
    columnWidths = nextWidths;
    if (userResizedIds.has(columnId)) {
      const next = new Set(userResizedIds);
      next.delete(columnId);
      userResizedIds = next;
    }
    measureAutoColumns();
    deps.markSource("column_widths");
  }

  /**
   * Drop cached auto-widths so measureAutoColumns can recompute them, but
   * keep user-resized entries intact. Without this, density/theme/font
   * edits would clear `columnWidths` for user-resized columns too — and
   * since measureAutoColumns explicitly skips those, the column ends up
   * with no recorded width and collapses.
   */
  function clearAutoWidthsKeepingUserResizes() {
    if (userResizedIds.size === 0) {
      columnWidths = {};
      return;
    }
    const next: Record<string, number> = {};
    for (const id of userResizedIds) {
      const w = columnWidths[id];
      if (typeof w === "number") next[id] = w;
    }
    columnWidths = next;
  }

  // ── Auto-width measurement ─────────────────────────────────────────────

  function measureAutoColumns() {
    const spec = deps.getSpec();
    if (!spec || typeof document === "undefined") return;

    const cssVars = getCssVars(spec.theme);
    const fontFamily = readBodyFamily(cssVars);
    let fontSize: string = readBodySize(cssVars);

    if (typeof fontSize === "string" && (fontSize.endsWith("rem") || fontSize.endsWith("em"))) {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const relValue = parseFloat(fontSize);
      fontSize = `${relValue * rootFontSize}px`;
    }

    const dataFontKey: FontKey = { family: fontFamily, weight: 400 };
    const headerFontKey: FontKey = { family: fontFamily, weight: 600 };

    doMeasurement(fontSize, dataFontKey, headerFontKey, columnWidths);

    if (document.fonts && document.fonts.ready) {
      // Re-measure once web fonts have loaded. The rank pass is arithmetic-
      // only so it can run synchronously here, and the top-K exact pass
      // uses ~30 ctx.measureText calls — small enough not to need
      // additional batching.
      document.fonts.ready.then(() => {
        doMeasurement(fontSize, dataFontKey, headerFontKey, columnWidths);
      });
      // fonts.ready can resolve BEFORE the theme's webfont <link> is even
      // injected (it settles the loading set at call time) — the hero
      // measured Georgia and rendered Lora (2026-06-12). loadingdone
      // fires per settle; re-measure then too. Self-removing listener so
      // repeated measureAutoColumns calls don't stack.
      const onLoadingDone = () => {
        doMeasurement(fontSize, dataFontKey, headerFontKey, columnWidths);
      };
      document.fonts.addEventListener("loadingdone", onLoadingDone);
      // Detach after the widget's realistic font-settle window.
      setTimeout(() => document.fonts.removeEventListener("loadingdone", onLoadingDone), 15000);
    }
  }

  function doMeasurement(
    fontSize: string,
    dataFontKey: FontKey,
    headerFontKey: FontKey,
    target: Record<string, number>,
  ) {
    const spec = deps.getSpec();
    if (!spec) return;

    const headerFontScale = 1.05;
    const baseFontSize = parseFloat(fontSize) || 14;
    const headerFontSizePx = baseFontSize * headerFontScale;

    const cssVars = getCssVars(spec.theme);
    const cellPadding = readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10) * 2;
    const groupPadding = readVarPx(cssVars, "--tv-spacing-column-group-padding", 8) * 2;
    // Live scalable transform (>0, ≤~1 when downscaled-to-fit); clamped so a
    // transient 0/huge value can't blow up the division. 1 ⇒ no compensation.
    const scaleComp = Math.min(1, Math.max(0.2, deps.getActualScale?.() ?? 1));
    // Cells render tabular-nums (figure-width digits) unless the theme opts out;
    // the proportional measure under-counts numeric content, so normalize digits
    // to the widest-advance digit before flat measurement (see tabularizeDigits).
    const numericTabular = readVar(cssVars, "--tv-text-numeric-figures", "tnum") !== "normal";
    const tab = (t: string) => (numericTabular ? tabularizeDigits(t) : t);

    // ── rank+top-K helpers ─────────────────────────────────────────────
    // Column auto-width = max over header + every cell. We don't need
    // every cell measured — we need the WIDEST. Use the cheap arithmetic
    // estimator to rank, then exact-measure the top-K with Canvas.
    // K is tuned for estimator mis-rank tolerance; see `width-measure.ts`.

    function exactMax(candidates: string[], font: FontKey, fontSizePx: number): number {
      if (candidates.length === 0) return 0;
      const winners = rankTopK(candidates, fontSizePx, font.weight, DEFAULT_TOP_K);
      let max = 0;
      for (const text of winners) {
        const w = measureExact(text, font, fontSizePx);
        // In browser: measureExact returns Canvas-exact width. In V8 (no
        // DOM): null — fall back to estimator. Either way, the top-K from
        // `rankTopK` is the canonical winner set.
        const px = w ?? estimateTextWidth(text, fontSizePx, font.weight);
        if (px > max) max = px;
      }
      return max;
    }

    // Resolved render-tree sizes in the DOM's OWN space: cells paint at body
    // size (root-aware rem→px — the SAME conversion `measureAutoColumns` does
    // for the rank font), muted/minor nodes at label size. This is what
    // RenderTree.svelte renders, so the tree measure lands at the real width
    // (measuring 14px while the DOM paints 16px silently under-sizes columns).
    const remToPx = (s: string | undefined): number => {
      const v = s ?? "";
      if (v.endsWith("rem") || v.endsWith("em")) {
        const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        return parseFloat(v) * root;
      }
      return parseFloat(v) || baseFontSize;
    };
    const measureSizes = { major: baseFontSize, base: baseFontSize, minor: remToPx(readLabelSize(cssVars)) };
    // Width-only resolver for composed cells. The injected per-text measure
    // reproduces how the DOM actually lays out a composed cell's spans, so the
    // sum lands on the real `offsetWidth`:
    //   · Canvas-exact (bold-aware) visual width, estimator fallback;
    //   · ÷ scaleComp → the grid's NATURAL (pre-transform) layout space;
    //   · + a per-span side-bearing then CEIL → each span is an independent
    //     inline box the browser rounds UP and can't kern across (a 7-span
    //     interval lost ~4px vs one continuous run). This is the structural
    //     replacement for the old fixed COMPOSED_TEXT_BUFFER.
    const composedResolver = (bold: boolean): StyleResolver => {
      const font = bold ? headerFontKey : dataFontKey;
      return makeMeasureResolver(
        measureSizes,
        (text, px) => {
          const visual = measureExact(text, font, px) ?? estimateTextWidth(text, px, font.weight);
          return Math.ceil(visual / scaleComp + TEXT_MEASUREMENT.COMPOSED_SPAN_BEARING);
        },
      );
    };

    function getLeafColumns(col: ColumnSpec | ColumnGroup): ColumnSpec[] {
      if (col.isGroup) {
        return col.columns.flatMap(getLeafColumns);
      }
      return [col];
    }

    function getEffectiveWidth(col: ColumnSpec): number {
      if (target[col.id] !== undefined) return target[col.id];
      if (typeof col.width === "number") return col.width;
      return AUTO_WIDTH.MIN;
    }

    function measureLeafColumn(col: ColumnSpec) {
      if (userResizedIds.has(col.id)) return;

      // Explicit numeric width is a hard pin (GH #6). The old behaviour
      // silently auto-grew the column past `col.width` when the header
      // wouldn't fit at that size, treating it as a floor rather than a
      // pin. That meant authors couldn't ship a deliberately-narrow
      // column with a long header (the header would expand the column
      // out from under them), AND the live widget would render at one
      // width while `save_plot()` rendered at another. Kept in lockstep
      // with `calculateSvgAutoWidths` in svg-generator.ts.
      //
      // Hard pin: DROP any stale auto-measured entry so `col.width` wins. The
      // render's width priority is measured-map > col.width, so a column
      // switched auto→explicit-width in the config editor would otherwise keep
      // showing its old auto width (the measured entry shadows the new pin).
      if (typeof col.width === "number") {
        delete target[col.id];
        return;
      }

      if (col.width != null && col.width !== "auto") {
        delete target[col.id];
        return;
      }

      // Header is exact-measured separately (different font key/size).
      let maxWidth = col.header
        ? exactMax([col.header], headerFontKey, headerFontSizePx)
        : 0;

      // Per-cell candidates: flat display text (the cheap rank key) + the
      // metadata + bold flag a tree measure needs. Skip header/spacer rows.
      const cells: ComposedCandidate[] = [];
      for (const row of spec!.data.rows) {
        if (!rowKindProps(resolveRowKind({ type: "data", row })).measuresWidth) continue;
        const text = getColumnDisplayText(row, col);
        if (text) cells.push({ text, metadata: row.metadata, bold: !!row.style?.bold });
      }

      // Composed cells (intervals, variant layouts, custom compositions) lay
      // out a node tree whose width ≠ the flat string (inter-node gaps,
      // per-node sizes, variant delimiters); measure the ACTUAL tree over the
      // top-K widest rows. Returns null for plain text/numeric columns, which
      // keep the proven flat path (bold rows measured at the bold key — the
      // hero-width-repro gate: at 400 the overall-summary intervals clipped
      // ~13px).
      const composedW = measureComposedColumnWidth(
        col, cells, baseFontSize, composedResolver,
        { theme: spec!.theme, nodeRules: spec!.theme?.nodeRules, target: "dom" },
      );
      if (composedW != null) {
        // composedW already lands in the grid's natural layout space — the
        // resolver's per-span measure folds in scaleComp + ceil (see above).
        maxWidth = Math.max(maxWidth, composedW);
      } else {
        const candidates = cells.filter((c) => !c.bold).map((c) => tab(c.text));
        const boldCandidates = cells.filter((c) => c.bold).map((c) => tab(c.text));
        maxWidth = Math.max(maxWidth, exactMax(candidates, dataFontKey, baseFontSize));
        if (boldCandidates.length > 0) {
          maxWidth = Math.max(maxWidth, exactMax(boldCandidates, headerFontKey, baseFontSize));
        }
      }

      maxWidth = Math.max(maxWidth, glyphNaturalWidth(col, spec!.data.rows));

      const typeMin = AUTO_WIDTH.VISUAL_MIN[col.type] ?? AUTO_WIDTH.MIN;
      const computedWidth = Math.min(
        AUTO_WIDTH.MAX,
        Math.max(typeMin, Math.ceil(maxWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER)),
      );
      target[col.id] = computedWidth;
    }

    function processColumn(col: ColumnSpec | ColumnGroup) {
      if (col.isGroup) {
        for (const child of col.columns) {
          processColumn(child);
        }

        if (col.header) {
          const groupHeaderWidth = exactMax([col.header], headerFontKey, headerFontSizePx)
            + groupPadding + TEXT_MEASUREMENT.RENDERING_BUFFER;

          const leafCols = getLeafColumns(col);
          const childrenTotalWidth = leafCols.reduce((sum, leaf) => sum + getEffectiveWidth(leaf), 0);

          const resizable = leafCols.filter((l) => !userResizedIds.has(l.id));
          if (groupHeaderWidth > childrenTotalWidth && resizable.length > 0) {
            const extraPerChild = Math.ceil((groupHeaderWidth - childrenTotalWidth) / resizable.length);
            for (const leaf of resizable) {
              target[leaf.id] = getEffectiveWidth(leaf) + extraPerChild;
            }
          }
        }
        return;
      }

      // Apply the user's runtime "configure column" override so a config edit
      // (header / type / options / variant / width) re-measures against the NEW
      // spec — matching what `effectiveColumnDefs` renders. Overrides are
      // leaf-only (applyColumnEdits skips groups), so resolving here covers
      // both top-level leaves and group children. The primary/label column is
      // measured separately above via `allColumns[0]` (already effective).
      measureLeafColumn(columnSpecOverrides[col.id] ?? col);
    }

    for (const colDef of spec.columns) {
      processColumn(colDef);
    }

    // Primary column extra chrome — indent, badges, group-header.
    const primaryCol = allColumns[0];
    if (primaryCol && !userResizedIds.has(primaryCol.id)) {
      let maxLabelWidth = 0;
      const rowGripBudget = 0;
      // Canonical indent token: the renderer indents by
      // theme.rowGroup.indentPerLevel (TabvizPlot:1723, svg-generator:1534),
      // NOT the legacy SPACING.INDENT_PER_LEVEL (12). Budget label width with
      // the same value so columns don't under-size at indent depth.
      const indentPx = readVarPx(getCssVars(spec.theme), "--tv-spacing-indent-per-level", SPACING.INDENT_PER_LEVEL);

      const groupDepths = new Map<string, number>();
      for (const group of spec.data.groups) {
        groupDepths.set(group.id, group.depth);
      }

      const getRowDepth = (groupId: string | null | undefined): number => {
        if (!groupId) return 0;
        const groupDepth = groupDepths.get(groupId) ?? 0;
        return groupDepth + 1;
      };

      if (primaryCol.header) {
        maxLabelWidth = Math.max(
          maxLabelWidth,
          exactMax([primaryCol.header], headerFontKey, headerFontSizePx),
        );
      }

      // Build a candidate set of synthetic "label-with-indent" strings,
      // ranked by estimated layout width — including badge / indent
      // contributions in the ranker so the winners are the rows that
      // actually push the column widest.
      //
      // Each candidate is the label text itself (we exact-measure the
      // label string); the per-row prefix (indent + badge) is added on
      // top of the exact measurement at the end.
      type RowMeasureCandidate = {
        labelText: string;
        prefixPx: number;       // indent + grip + badge contribution
        badgeText: string | null;
      };
      const rowCandidates: RowMeasureCandidate[] = [];
      const badgeFontSize = baseFontSize * BADGE.FONT_SCALE;
      for (const row of spec.data.rows) {
        if (!row.label) continue;
        const depth = getRowDepth(row.groupId);
        const rowIndent = row.style?.indent ?? 0;
        const totalIndent = depth + rowIndent;
        const indentWidth = totalIndent * indentPx;

        const prefixPx = indentWidth + rowGripBudget;
        let badgeText: string | null = null;
        if (row.style?.badge) {
          badgeText = String(row.style.badge);
        }
        rowCandidates.push({ labelText: row.label, prefixPx, badgeText });
      }

      // Rank by estimated TOTAL row width (label estimate + prefix + badge
      // estimate). The estimator is monotone enough that the top-K of the
      // total scores includes the actual widest row with very high
      // probability — and we exact-measure the K winners below.
      const totalScore = (c: RowMeasureCandidate): number => {
        let s = estimateTextWidth(c.labelText, baseFontSize, dataFontKey.weight) + c.prefixPx;
        if (c.badgeText) {
          s += BADGE.GAP
            + estimateTextWidth(c.badgeText, badgeFontSize, dataFontKey.weight)
            + BADGE.PADDING_X * 2;
        }
        return s;
      };
      // Partial-selection top-K.
      const topRows: RowMeasureCandidate[] = [];
      const K = DEFAULT_TOP_K;
      for (const c of rowCandidates) {
        const s = totalScore(c);
        if (topRows.length < K) {
          topRows.push(c);
          topRows.sort((a, b) => totalScore(a) - totalScore(b));
        } else if (s > totalScore(topRows[0])) {
          topRows[0] = c;
          topRows.sort((a, b) => totalScore(a) - totalScore(b));
        }
      }

      for (const c of topRows) {
        const labelExact = measureExact(c.labelText, dataFontKey, baseFontSize)
          ?? estimateTextWidth(c.labelText, baseFontSize, dataFontKey.weight);
        let rowWidth = labelExact + c.prefixPx;
        if (c.badgeText) {
          const badgeExact = measureExact(c.badgeText, dataFontKey, badgeFontSize)
            ?? estimateTextWidth(c.badgeText, badgeFontSize, dataFontKey.weight);
          rowWidth += BADGE.GAP + badgeExact + BADGE.PADDING_X * 2;
        }
        if (rowWidth > maxLabelWidth) maxLabelWidth = rowWidth;
      }

      function countAllDescendantRowsForGroup(groupId: string): number {
        let count = 0;
        for (const row of spec!.data.rows) {
          if (row.groupId === groupId) count++;
        }
        for (const g of spec!.data.groups) {
          if (g.parentId === groupId) {
            count += countAllDescendantRowsForGroup(g.id);
          }
        }
        return count;
      }

      // RESOLVED surface, never raw spec.interaction (sparse tier): a count
      // enabled via theme opinion / global tier must be width-budgeted here
      // exactly as the renderer + SVG export will draw it.
      const showGroupCounts = resolveInteraction(spec).showGroupCounts;
      const countFontSize = baseFontSize * 0.75;
      // Group-header labels are typically a handful per spec; rather than
      // rank+top-K, just exact-measure all of them. Cost is small in
      // absolute terms.
      for (const group of spec.data.groups) {
        if (group.label) {
          const indentWidth = group.depth * indentPx;
          const labelWidth = measureExact(group.label, headerFontKey, headerFontSizePx)
            ?? estimateTextWidth(group.label, headerFontSizePx, headerFontKey.weight);

          let countWidth = 0;
          if (showGroupCounts) {
            const rowCount = countAllDescendantRowsForGroup(group.id);
            const countText = `(${rowCount})`;
            // Count label rendered at regular weight (pre-existing
            // behavior: the historical ctx.font reassignment dropped the
            // weight prefix), so use dataFontKey here, not headerFontKey.
            const cw = measureExact(countText, dataFontKey, countFontSize)
              ?? estimateTextWidth(countText, countFontSize, dataFontKey.weight);
            countWidth = cw + GROUP_HEADER.GAP;
          }

          const totalWidth = indentWidth
            + rowGripBudget
            + GROUP_HEADER.CHEVRON_WIDTH
            + GROUP_HEADER.GAP
            + labelWidth
            + countWidth
            + GROUP_HEADER.SAFETY_MARGIN;

          maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        }
      }

      const computedLabelWidth = Math.min(
        AUTO_WIDTH.LABEL_MAX,
        Math.max(AUTO_WIDTH.MIN, Math.ceil(maxLabelWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER)),
      );
      target[primaryCol.id] = Math.max(target[primaryCol.id] ?? 0, computedLabelWidth);
    }

    // Wrap-line-count measurement (post-width). Writes into the cells slice.
    {
      const wrapEnabledCols = allColumns.filter((c) => {
        const w = c.wrap;
        return typeof w === "number" ? w > 0 : !!w;
      });
      const lineCaps = new Map<string, number>();
      for (const c of wrapEnabledCols) {
        const w = c.wrap as boolean | number;
        const cap = typeof w === "number" ? w + 1 : (w ? 2 : 1);
        lineCaps.set(c.id, cap);
      }

      const counts: Record<string, number> = {};
      if (wrapEnabledCols.length > 0) {
        // Wrap-line counting is intrinsically per-cell ("does THIS string
        // overflow THIS width?"), so the rank+top-K trick doesn't apply.
        // The estimator's precision is adequate for "1 vs 2 vs 3 lines"
        // ceil-division; we don't need Canvas exactness here.
        for (const row of spec.data.rows) {
          let maxLines = 1;
          for (const col of wrapEnabledCols) {
            const colWidth = target[col.id] ?? AUTO_WIDTH.MIN;
            const contentWidth = Math.max(1, colWidth - cellPadding);
            const raw = (row.metadata as Record<string, unknown>)[col.field];
            const text = raw == null ? "" : String(raw);
            if (text === "") continue;
            const segments = text.split(/\r?\n/);
            let cellLines = 0;
            for (const seg of segments) {
              if (seg.length === 0) {
                cellLines += 1;
                continue;
              }
              const w = estimateTextWidth(seg, baseFontSize, dataFontKey.weight);
              cellLines += Math.max(1, Math.ceil(w / contentWidth));
            }
            const cap = lineCaps.get(col.id) ?? 1;
            const capped = Math.min(cellLines, cap);
            if (capped > maxLines) maxLines = capped;
          }
          if (maxLines > 1) counts[row.id] = maxLines;
        }
      }

      const prev = deps.getWrapLineCounts();
      let changed = false;
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(counts);
      if (prevKeys.length !== nextKeys.length) changed = true;
      else {
        for (const k of nextKeys) if (prev[k] !== counts[k]) { changed = true; break; }
      }
      if (changed) deps.setWrapLineCounts(counts);
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  function hydrateForSpec() {
    // Spec swap → reconcile figure-layout state by column id instead of
    // wiping it (interactivity-UX arc P0; docs/dev/interactivity-ux-plan.md).
    // A Shiny `update_data` round-trip lands here, and the old full wipe
    // meant every server data refresh destroyed the user's column resizes,
    // hides, and reorder. Layout state survives for columns that still
    // exist in the incoming spec; entries anchored to disappeared ids drop.
    //
    // Column EDITS (configure overrides, runtime-inserted columns) still
    // reset: the incoming spec owns its column *definitions*, and a stale
    // spec override would silently mask server-sent column changes.
    const next = deps.getSpec();
    const validIds = new Set<string>(
      next ? flattenAllColumns(next.columns).map((c) => c.id) : [],
    );
    // The label (primary) column rides spec.labelColumn, NOT spec.columns —
    // it gets a resize handle like any other column, so its figure-layout
    // state must survive the reconcile too (review pass: it was silently
    // dropped, re-destroying label-column resizes on every data update).
    if (next?.labelColumn?.id) validIds.add(next.labelColumn.id);

    const keptResized = new Set<string>();
    const keptWidths: Record<string, number> = {};
    for (const id of userResizedIds) {
      const w = columnWidths[id];
      if (validIds.has(id) && w != null) {
        keptResized.add(id);
        keptWidths[id] = w;
      }
    }
    // Auto-measured widths are NOT carried over — the caller re-runs
    // measureAutoColumns() against the new spec's content.
    //
    // The incoming spec's figureLayout block (P1 wire tier) hydrates UNDER
    // surviving session state: a width the user just dragged wins over the
    // block's pin for the same column; block pins fill the rest. Block
    // widths count as user-resized — they're deliberate pins and must
    // survive re-measure/theme/density like any interactive resize.
    // The wire is UNTRUSTED: clamp magnitudes (a 1e9 pin is an immovable
    // explicitWidth in the flex distribution → degenerate SVG widths).
    const block = next?.figureLayout;
    if (block?.columnWidths) {
      for (const [id, px] of Object.entries(block.columnWidths)) {
        if (!validIds.has(id) || keptResized.has(id)) continue;
        if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) continue;
        keptWidths[id] = Math.min(10000, Math.max(40, Math.round(px)));
        keptResized.add(id);
      }
    }
    columnWidths = keptWidths;
    userResizedIds = keptResized;
    hiddenColumnIds = new Set([...hiddenColumnIds].filter((id) => validIds.has(id)));
    // Reorder overrides carry over wholesale: applyColumnOrder is tolerant
    // at apply time (unknown ids dropped, new columns appended in spec
    // order), so stale entries are inert rather than harmful. The block's
    // order applies only when the session has no reorder of its own.
    if (block?.columnOrder) {
      const noSessionOrder =
        columnOrderOverrides.topLevel == null &&
        Object.keys(columnOrderOverrides.byGroup).length === 0;
      if (noSessionOrder) {
        columnOrderOverrides = {
          topLevel: Array.isArray(block.columnOrder.topLevel)
            ? block.columnOrder.topLevel.filter((id) => typeof id === "string")
            : null,
          byGroup: Object.fromEntries(
            Object.entries(block.columnOrder.byGroup ?? {})
              .filter(([, v]) => Array.isArray(v))
              .map(([k, v]) => [k, (v as unknown[]).filter((id) => typeof id === "string")]),
          ),
        };
      }
    }
    userInsertedColumns = [];
    columnSpecOverrides = {};
  }

  function reset() {
    columnOrderOverrides = { topLevel: null, byGroup: {} };
    userInsertedColumns = [];
    hiddenColumnIds = new Set();
    columnSpecOverrides = {};
    columnWidths = {};
    userResizedIds = new Set();
  }

  return {
    get columnWidths() { return columnWidths; },
    get userResizedIds() { return userResizedIds; },
    get userInsertedColumns() { return userInsertedColumns; },
    get hiddenColumnIds() { return hiddenColumnIds; },
    get columnSpecOverrides() { return columnSpecOverrides; },
    get columnOrderOverrides() { return columnOrderOverrides; },

    get effectiveColumnDefs() { return effectiveColumnDefs; },
    get allColumns() { return allColumns; },
    get allColumnDefs() { return allColumnDefs; },
    get primaryColumnId() { return primaryColumnId; },
    get forestColumns() { return forestColumns; },
    get hasExplicitForestColumns() { return hasExplicitForestColumns; },
    get vizColumns() { return vizColumns; },
    get hasVizColumns() { return hasVizColumns; },
    get hasColumnEdits() { return hasColumnEdits; },

    mintUniqueColumnId,
    insertColumn,
    hideColumn,
    updateColumn,
    updateColumnPatch,
    clearColumnEdits,
    setColumnWidth,
    previewColumnWidth,
    cancelPreviewColumnWidth,
    resetColumnWidth,

    findColumnScope,
    siblingsForColumnScope,
    moveColumnItem,
    clearColumnReorder,

    measureAutoColumns,
    clearAutoWidthsKeepingUserResizes,

    hydrateForSpec,
    reset,
  };
}

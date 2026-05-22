// Cell + label edit slice.
//
// Owns the session-only "user typed something" state for individual
// cells (`cellEdits`), the primary plot labels (`labelEdits`), the
// per-row wrapped-line counts produced by `measureAutoColumns`
// (`wrapLineCounts`), and the transient "which cell is currently
// being edited" pointer (`editingTarget`). All four are read by the
// export pipeline and by the layout derivation; their lifetimes are
// the widget session.
//
// Dependencies (injected at construction):
//   - `getAllColumns()`     — for primary-field resolution in
//                             setRowLabel / getLabel
//   - `getSpec()`           — for forest-column options + label
//                             fallback in getPlotLabel
//   - `appendOp(record)`    — push an OpRecord onto the history log
//                             (history slice will own this later)
//   - `markSource(field)`   — source-tag the mutation so Shiny
//                             observers learn whether the change is
//                             user- or proxy-originated
//
// Extracted from tabvizStore.svelte.ts in Phase 0c-C1 PR1 (first
// slice after the source-tagging spike). See
// docs/dev/store-decomposition-idiom.md for the slice idiom.
//
// One open seam: `clearAllEdits()` (in the main factory) still
// resets semantics-owned state (`styleEdits`, `paintTool`) inline.
// When the semantics slice ships, that function becomes
// `cells.reset(); semantics.reset();`.

import type {
  CellEdits, EditTarget, EditValue, Row, ColumnSpec, WebSpec,
} from "$types";
import { ops, type OpRecord } from "$lib/op-recorder";

export interface CellsSliceDeps {
  /** Read `allColumns` reactively (resolves primary-column field). */
  getAllColumns: () => readonly ColumnSpec[];
  /** Read `spec` reactively (resolves forest options + label fallback). */
  getSpec: () => WebSpec | null;
  /** Push an OpRecord onto the op log. */
  appendOp: (record: OpRecord) => void;
  /** Source-tag an outbound Shiny field. */
  markSource: (field: string) => void;
}

type LabelField = "title" | "subtitle" | "caption" | "footnote";
type LabelEdits = Partial<Record<LabelField, string | null>>;

export interface CellsSlice {
  readonly cellEdits: CellEdits;
  readonly labelEdits: LabelEdits;
  readonly wrapLineCounts: Record<string, number>;
  readonly editingTarget: EditTarget | null;

  /** Setter for the wrap-line-counts map; written by `measureAutoColumns`
   *  in the (future) columns slice once auto-widths settle. */
  setWrapLineCounts: (counts: Record<string, number>) => void;

  startEdit: (target: EditTarget) => void;
  endEdit: () => void;
  setCellValue: (rowId: string, field: string, value: EditValue) => void;
  clearCellEdit: (rowId: string, field: string) => void;
  setRowLabel: (rowId: string, label: string) => void;
  setGroupHeader: (groupId: string, text: string) => void;
  setForestCellValues: (
    rowId: string,
    forestColId: string,
    est: EditValue,
    lo: EditValue,
    hi: EditValue,
  ) => void;

  getDisplayValue: (row: Row, field: string) => unknown;
  getLabel: (row: Row) => string;

  setLabel: (field: LabelField, value: string | null) => void;
  previewLabel: (field: LabelField, value: string | null) => void;
  getPlotLabel: (field: LabelField) => string | null;

  /** Clear all cell- and label-edit state. Called from the main
   *  factory's `clearAllEdits()` and `resetState()` / `setSpec()`
   *  paths. `editingTarget` and `wrapLineCounts` are reset too —
   *  the renderer recomputes wrap counts as soon as a new spec
   *  loads. */
  reset: () => void;
}

export function createCellsSlice(deps: CellsSliceDeps): CellsSlice {
  let cellEdits = $state<CellEdits>({ cells: {}, groups: {} });
  let labelEdits = $state<LabelEdits>({});
  let wrapLineCounts = $state<Record<string, number>>({});
  let editingTarget = $state<EditTarget | null>(null);

  function startEdit(target: EditTarget): void {
    editingTarget = target;
  }
  function endEdit(): void {
    editingTarget = null;
  }

  function setCellValue(rowId: string, field: string, value: EditValue): void {
    const current = cellEdits.cells[rowId] ?? {};
    cellEdits = {
      ...cellEdits,
      cells: { ...cellEdits.cells, [rowId]: { ...current, [field]: value } },
    };
    deps.appendOp(ops.setCell(rowId, field, value));
    deps.markSource("cell_edits");
  }

  function clearCellEdit(rowId: string, field: string): void {
    const current = cellEdits.cells[rowId];
    if (!current) return;
    const { [field]: _omit, ...rest } = current;
    const cells = Object.keys(rest).length
      ? { ...cellEdits.cells, [rowId]: rest }
      : (() => { const { [rowId]: _r, ...rm } = cellEdits.cells; return rm; })();
    cellEdits = { ...cellEdits, cells };
  }

  function setRowLabel(rowId: string, label: string): void {
    // The "row label" is the primary column's cell — resolving at call time
    // means reordering columns doesn't migrate prior label edits.
    const field = deps.getAllColumns()[0]?.field;
    if (!field) return;
    // Inline the cellEdits update so we can emit a `set_row_label()` record
    // (more semantic than the `set_cell()` that setCellValue would push).
    const current = cellEdits.cells[rowId] ?? {};
    cellEdits = {
      ...cellEdits,
      cells: { ...cellEdits.cells, [rowId]: { ...current, [field]: label } },
    };
    deps.appendOp(ops.setRowLabel(rowId, label));
    deps.markSource("cell_edits");
  }

  function setGroupHeader(groupId: string, text: string): void {
    cellEdits = { ...cellEdits, groups: { ...cellEdits.groups, [groupId]: text } };
  }

  function setForestCellValues(
    rowId: string,
    forestColId: string,
    est: EditValue,
    lo: EditValue,
    hi: EditValue,
  ): void {
    const spec = deps.getSpec();
    if (!spec) return;
    const col = deps.getAllColumns().find((c) => c.id === forestColId);
    const forestOpts = col?.options?.forest;
    // Primary field names come from the column's forest options when set,
    // otherwise fall back to conventional metadata keys ("est","lo","hi").
    const pointField = forestOpts?.point ?? "est";
    const lowerField = forestOpts?.lower ?? "lo";
    const upperField = forestOpts?.upper ?? "hi";
    const current = cellEdits.cells[rowId] ?? {};
    cellEdits = {
      ...cellEdits,
      cells: {
        ...cellEdits.cells,
        [rowId]: { ...current, [pointField]: est, [lowerField]: lo, [upperField]: hi },
      },
    };
  }

  function getDisplayValue(row: Row, field: string): unknown {
    const edited = cellEdits.cells[row.id]?.[field];
    return edited !== undefined ? edited : row.metadata[field];
  }

  function getLabel(row: Row): string {
    const field = deps.getAllColumns()[0]?.field;
    const edited = field ? cellEdits.cells[row.id]?.[field] : undefined;
    return edited !== undefined && edited !== null ? String(edited) : row.label;
  }

  // Plot-level labels (title / subtitle / caption / footnote). Live session
  // state sits in `labelEdits`; the exporter merges into `spec.labels` so
  // "View source" reproduces the edit.
  function setLabel(field: LabelField, value: string | null): void {
    const next = value == null || value === "" ? null : value;
    labelEdits = { ...labelEdits, [field]: next };
    deps.appendOp(ops.setLabelSlot(field, next));
    deps.markSource("label_edits");
  }

  function previewLabel(field: LabelField, value: string | null): void {
    const next = value == null || value === "" ? null : value;
    labelEdits = { ...labelEdits, [field]: next };
  }

  function getPlotLabel(field: LabelField): string | null {
    if (field in labelEdits) {
      const v = labelEdits[field];
      return v == null ? null : v;
    }
    return deps.getSpec()?.labels?.[field] ?? null;
  }

  function reset(): void {
    cellEdits = { cells: {}, groups: {} };
    labelEdits = {};
    wrapLineCounts = {};
    editingTarget = null;
  }

  return {
    get cellEdits() { return cellEdits; },
    get labelEdits() { return labelEdits; },
    get wrapLineCounts() { return wrapLineCounts; },
    get editingTarget() { return editingTarget; },
    setWrapLineCounts: (counts) => { wrapLineCounts = counts; },
    startEdit, endEdit, setCellValue, clearCellEdit, setRowLabel,
    setGroupHeader, setForestCellValues,
    getDisplayValue, getLabel,
    setLabel, previewLabel, getPlotLabel,
    reset,
  };
}

// Semantics slice — paint-tool state + per-row / per-cell semantic
// token overrides (`styleEdits`) + the action methods that mutate
// them. The slice handles the painter-as-selection model: the active
// token's painted-row set IS the "selected rows" set.
//
// Owns:
//   - styleEdits           rows/cells → SemanticToken → boolean override
//   - paintTool            { token, scope } — never null
//   - paintHoverCellField  cell-scope hover marker ("rowId:field" pointer)
//
// Cross-slice deps (forward closures):
//   - getSpec              for spec.data.rows baseline + row.cellStyles
//   - appendOp + markSource
//
// Selection-as-paint contract: the active token's painted-row IDs ARE
// the selected rows. `selectedRowIds` reads styleEdits + paintTool.token
// — the $derived inlining the same logic.
//
// Phase 0c-C1 PR6.

import type { Row, SemanticToken } from "$types";
import { ops, type OpRecord } from "$lib/op-recorder";

export type SemanticFlags = Partial<Record<SemanticToken, boolean>>;

export type StyleEdits = {
  rows: Record<string, SemanticFlags>;
  cells: Record<string, Record<string, SemanticFlags>>;
};

export type PaintTool = {
  token: SemanticToken;
  scope: "row" | "cell";
};

const ALL_SEMANTIC_TOKENS: ReadonlyArray<SemanticToken> = [
  "bold", "emphasis", "muted", "accent", "fill",
];

export interface SemanticsSliceDeps {
  getSpec: () => { data: { rows: readonly Row[] } } | null;
  appendOp: (record: OpRecord) => void;
  markSource: (field: string) => void;
}

export interface SemanticsSlice {
  readonly styleEdits: StyleEdits;
  readonly paintTool: PaintTool;
  readonly paintHoverCellField: string | null;
  readonly selectedRowIds: Set<string>;

  setPaintTool: (tool: PaintTool) => void;
  setPaintHoverCellField: (value: string | null) => void;

  /** Click handler core: paint with replace-if-different /
   *  toggle-if-same. Public-API name kept distinct from the lower-
   *  level `setRowSemantic` for grep-ability. */
  paintRowWithActiveToken: (rowId: string) => void;
  paintCellWithActiveToken: (rowId: string, field: string) => void;

  setSelectedRows: (ids: string[]) => void;

  setRowSemantic: (rowId: string, token: SemanticToken, on: boolean) => void;
  setCellSemantic: (rowId: string, field: string, token: SemanticToken, on: boolean) => void;

  /** Clear every semantic token on `rowId` (fan-out over the token set). */
  clearSemantic: (rowId: string) => void;
  clearCellSemantic: (rowId: string, field: string) => void;

  /** Resolved row/cell flags (spec baseline + paint overrides). */
  getRowSemantic: (row: Row, token: SemanticToken) => boolean;
  getCellSemantic: (row: Row, field: string, token: SemanticToken) => boolean;

  /** Wipe styleEdits + reset paintTool to its default. The
   *  `clearAllEdits()` orchestrator in the main factory uses this
   *  alongside `cells.reset()`. */
  clearAllPaint: () => void;
  hasPaintEdits: () => boolean;

  /** Slice-level reset (alias for clearAllPaint + paintHoverCellField
   *  null). Used by resetState. */
  reset: () => void;
}

export function createSemanticsSlice(deps: SemanticsSliceDeps): SemanticsSlice {
  let styleEdits = $state<StyleEdits>({ rows: {}, cells: {} });
  let paintTool = $state<PaintTool>({ token: "accent", scope: "row" });
  let paintHoverCellField = $state<string | null>(null);

  const selectedRowIds = $derived.by((): Set<string> => {
    const active = paintTool.token;
    const ids = new Set<string>();
    for (const rowId of Object.keys(styleEdits.rows)) {
      if (styleEdits.rows[rowId]?.[active]) ids.add(rowId);
    }
    return ids;
  });

  function setPaintTool(tool: PaintTool): void {
    paintTool = tool;
    paintHoverCellField = null;
    deps.markSource("paint_tool");
  }

  function setPaintHoverCellField(value: string | null): void {
    paintHoverCellField = value;
  }

  function setRowSemantic(rowId: string, token: SemanticToken, on: boolean): void {
    const current = styleEdits.rows[rowId] ?? {};
    const next: SemanticFlags = { ...current, [token]: on };
    // Collapse back to "inherit" when the flag matches the spec baseline
    // (keeps exportSpec free of no-op noise).
    const specRow = deps.getSpec()?.data.rows.find((r) => r.id === rowId);
    const baseline = !!specRow?.style?.[token];
    if (on === baseline) delete next[token];
    const rows = Object.keys(next).length
      ? { ...styleEdits.rows, [rowId]: next }
      : (() => { const { [rowId]: _r, ...rest } = styleEdits.rows; return rest; })();
    styleEdits = { ...styleEdits, rows };
    deps.appendOp(ops.paintRow(rowId, on ? token : null));
    deps.markSource("row_styles");
    if (token === paintTool.token) deps.markSource("selected");
  }

  function setCellSemantic(
    rowId: string,
    field: string,
    token: SemanticToken,
    on: boolean,
  ): void {
    const rowMap = styleEdits.cells[rowId] ?? {};
    const currentCell = rowMap[field] ?? {};
    const nextCell: SemanticFlags = { ...currentCell, [token]: on };
    const specCell = deps.getSpec()?.data.rows.find((r) => r.id === rowId)?.cellStyles?.[field];
    const baseline = !!specCell?.[token];
    if (on === baseline) delete nextCell[token];
    const nextRowMap = Object.keys(nextCell).length
      ? { ...rowMap, [field]: nextCell }
      : (() => { const { [field]: _f, ...rest } = rowMap; return rest; })();
    const cells = Object.keys(nextRowMap).length
      ? { ...styleEdits.cells, [rowId]: nextRowMap }
      : (() => { const { [rowId]: _r, ...rest } = styleEdits.cells; return rest; })();
    styleEdits = { ...styleEdits, cells };
    deps.appendOp(ops.paintCell(rowId, field, on ? token : null));
    deps.markSource("cell_styles");
  }

  function paintRowWithActiveToken(rowId: string): void {
    const active = paintTool.token;
    const flags = styleEdits.rows[rowId] ?? {};
    if (flags[active]) {
      setRowSemantic(rowId, active, false);
      return;
    }
    for (const t of ALL_SEMANTIC_TOKENS) {
      if (t !== active && flags[t]) setRowSemantic(rowId, t, false);
    }
    setRowSemantic(rowId, active, true);
  }

  function paintCellWithActiveToken(rowId: string, field: string): void {
    const active = paintTool.token;
    const flags = styleEdits.cells[rowId]?.[field] ?? {};
    if (flags[active]) {
      setCellSemantic(rowId, field, active, false);
      return;
    }
    for (const t of ALL_SEMANTIC_TOKENS) {
      if (t !== active && flags[t]) setCellSemantic(rowId, field, t, false);
    }
    setCellSemantic(rowId, field, active, true);
  }

  function setSelectedRows(ids: string[]): void {
    const active = paintTool.token;
    const target = new Set(ids);
    // Clear active token from rows not in `ids`
    for (const rowId of Object.keys(styleEdits.rows)) {
      const flags = styleEdits.rows[rowId];
      if (flags?.[active] && !target.has(rowId)) {
        setRowSemantic(rowId, active, false);
      }
    }
    // Paint active token onto rows in `ids` that aren't yet painted.
    for (const rowId of ids) {
      if (!styleEdits.rows[rowId]?.[active]) {
        setRowSemantic(rowId, active, true);
      }
    }
  }

  function clearSemantic(rowId: string): void {
    for (const token of ALL_SEMANTIC_TOKENS) setRowSemantic(rowId, token, false);
  }

  function clearCellSemantic(rowId: string, field: string): void {
    for (const token of ALL_SEMANTIC_TOKENS) setCellSemantic(rowId, field, token, false);
  }

  function getRowSemantic(row: Row, token: SemanticToken): boolean {
    const override = styleEdits.rows[row.id]?.[token];
    if (override !== undefined) return override;
    return !!row.style?.[token];
  }

  function getCellSemantic(row: Row, field: string, token: SemanticToken): boolean {
    const override = styleEdits.cells[row.id]?.[field]?.[token];
    if (override !== undefined) return override;
    return !!row.cellStyles?.[field]?.[token];
  }

  function clearAllPaint(): void {
    styleEdits = { rows: {}, cells: {} };
    paintTool = { token: "accent", scope: "row" };
  }

  function hasPaintEdits(): boolean {
    return (
      Object.keys(styleEdits.rows).length > 0 ||
      Object.keys(styleEdits.cells).length > 0
    );
  }

  function reset(): void {
    clearAllPaint();
    paintHoverCellField = null;
  }

  return {
    get styleEdits() { return styleEdits; },
    get paintTool() { return paintTool; },
    get paintHoverCellField() { return paintHoverCellField; },
    get selectedRowIds() { return selectedRowIds; },

    setPaintTool, setPaintHoverCellField,
    paintRowWithActiveToken, paintCellWithActiveToken,
    setSelectedRows,
    setRowSemantic, setCellSemantic,
    clearSemantic, clearCellSemantic,
    getRowSemantic, getCellSemantic,
    clearAllPaint, hasPaintEdits,
    reset,
  };
}

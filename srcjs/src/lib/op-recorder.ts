/**
 * Op recorder — incremental, append-only log of user-visible structural
 * operations rendered as fluent R API calls.
 *
 * Paired with `tabvizStore.opLog` and surfaced in the "View source" panel.
 * Theme-side edits are NOT logged here — they're rendered as a live
 * snapshot via `generateThemeSource()` in `theme-source.ts`.
 *
 * Recording contract (see the comment block atop `tabvizStore.svelte.ts`):
 *   every store mutation that changes user-visible non-theme state must
 *   push exactly one record via `recordOp()`. Do not collapse or
 *   deduplicate — backtracking is part of the log.
 */

export interface OpRecord {
  /** The one-call fluent R string, e.g. `resize_column("drug", 160)`. */
  rCall: string;
  /**
   * Equivalent JS statement against a `TabvizInstance`, e.g.
   * `instance.sortBy({ column: "estimate", direction: "asc" })`. Used by
   * the "View source" JS tab. Some ops aren't exposed on TabvizInstance
   * yet and emit a `instance.store.<method>(...)` escape hatch instead —
   * documented in `jsCallForOp` below.
   */
  jsCall: string;
  /** Identifier for the category of op — useful for filtering + tests. */
  kind:
    | "resize_column"
    | "move_column"
    | "add_column"
    | "remove_column"
    | "update_column"
    | "move_row"
    | "set_cell"
    | "set_row_label"
    | "set_title"
    | "set_subtitle"
    | "set_caption"
    | "set_footnote"
    | "set_watermark"
    | "paint_row"
    | "paint_cell"
    | "set_theme"
    | "set_aspect_ratio"
    | "set_shared_column_widths"
    | "sort_rows"
    | "filter_rows"
    | "clear_filters";
  /** Monotonic timestamp (ms since epoch) — purely for debugging + ordering stability. */
  ts: number;
}

// ------------------------------------------------------------------
// JS-literal formatters — render arg values as JS source for the
// "View source" JS tab.
// ------------------------------------------------------------------

/** Render any JS value as a JS source literal. */
export function jsLiteral(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return v > 0 ? "Infinity" : v < 0 ? "-Infinity" : "NaN";
    return String(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  // Objects / arrays: JSON-stringify. Good enough for cell values; the
  // user can hand-edit if they need a richer literal.
  return JSON.stringify(v);
}

/** Render a JS object literal from { key: value, ... }, dropping undefined. */
export function jsObject(entries: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined) continue;
    parts.push(`${k}: ${jsLiteral(v)}`);
  }
  return `{ ${parts.join(", ")} }`;
}

// ------------------------------------------------------------------
// R-literal formatters
// ------------------------------------------------------------------

/** Quote a string as an R literal. Handles backslash + double-quote + newline. */
export function rString(s: string): string {
  return (
    '"' +
    s
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t") +
    '"'
  );
}

/** Render any JS value as an R literal. Used for cell values in `set_cell()`. */
export function rLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return v > 0 ? "Inf" : v < 0 ? "-Inf" : "NaN";
    return String(v);
  }
  if (typeof v === "string") return rString(v);
  // Fallback: JSON stringify then quote. Users rarely hit this; serves as
  // a readable approximation that they can hand-edit.
  return rString(JSON.stringify(v));
}

/** Render a positional argument. */
export function rPositional(v: unknown): string {
  return rLiteral(v);
}

/** Render a named argument, e.g. `to = 2`. */
export function rNamed(name: string, v: unknown): string {
  return `${name} = ${rLiteral(v)}`;
}

/** Compose an R call from a function name and pre-rendered arg strings. */
export function rCall(fn: string, args: (string | null | undefined)[]): string {
  const parts = args.filter((a): a is string => a != null && a.length > 0);
  return `${fn}(${parts.join(", ")})`;
}

// ------------------------------------------------------------------
// Record constructors — one helper per kind
//
// Each returns an OpRecord; push via `opLog.push(record)` in the store.
// Having them here means a single grep finds every emission site.
// ------------------------------------------------------------------

const now = () => Date.now();

export const ops = {
  resizeColumn: (id: string, w: number): OpRecord => ({
    kind: "resize_column",
    rCall: rCall("resize_column", [rPositional(id), rPositional(Math.round(w))]),
    // TabvizInstance doesn't expose setColumnWidth yet; use the store
    // escape hatch documented on TabvizInstance.store.
    jsCall: `instance.store.setColumnWidth(${jsLiteral(id)}, ${Math.round(w)});`,
    ts: now(),
  }),

  moveColumn: (id: string, to: number | string): OpRecord => ({
    kind: "move_column",
    rCall: rCall("move_column", [rPositional(id), rNamed("to", to)]),
    jsCall: typeof to === "number"
      ? `instance.store.moveColumnItem(${jsLiteral(id)}, ${to});`
      : `instance.store.moveColumnItem(${jsLiteral(id)}, /* before: */ ${jsLiteral(to)});`,
    ts: now(),
  }),

  addColumn: (colBuilder: string, after?: string | null): OpRecord => ({
    kind: "add_column",
    rCall: rCall(
      "add_column",
      [colBuilder, after ? rNamed("after", after) : null],
    ),
    // colBuilder is an R-call string; we emit a comment placeholder
    // for the JS side since reconstructing a ColumnSpec literal would
    // require parsing the R call. The user typically follows up with
    // an update_column / col_* in their own code.
    jsCall: `// add_column: ${colBuilder}${after ? ` (after ${after})` : ""}`,
    ts: now(),
  }),

  removeColumn: (id: string): OpRecord => ({
    kind: "remove_column",
    rCall: rCall("remove_column", [rPositional(id)]),
    jsCall: `instance.store.hideColumn(${jsLiteral(id)});`,
    ts: now(),
  }),

  updateColumn: (id: string, patch: Record<string, unknown>): OpRecord => {
    const namedArgs = Object.entries(patch).map(([k, v]) => rNamed(k, v));
    return {
      kind: "update_column",
      rCall: rCall("update_column", [rPositional(id), ...namedArgs]),
      jsCall: `instance.store.updateColumnPatch(${jsLiteral(id)}, ${jsObject(patch)});`,
      ts: now(),
    };
  },

  moveRow: (id: string, to: number): OpRecord => ({
    kind: "move_row",
    rCall: rCall("move_row", [rPositional(id), rNamed("to", to)]),
    jsCall: `instance.store.moveRowItem(${jsLiteral(id)}, ${to});`,
    ts: now(),
  }),

  setCell: (rowId: string, field: string, value: unknown): OpRecord => ({
    kind: "set_cell",
    rCall: rCall("set_cell", [rPositional(rowId), rPositional(field), rPositional(value)]),
    jsCall: `instance.store.setCellValue(${jsLiteral(rowId)}, ${jsLiteral(field)}, ${jsLiteral(value)});`,
    ts: now(),
  }),

  setRowLabel: (rowId: string, label: string): OpRecord => ({
    kind: "set_row_label",
    rCall: rCall("set_row_label", [rPositional(rowId), rPositional(label)]),
    jsCall: `instance.store.setRowLabel(${jsLiteral(rowId)}, ${jsLiteral(label)});`,
    ts: now(),
  }),

  setLabelSlot: (
    slot: "title" | "subtitle" | "caption" | "footnote",
    text: string | null,
  ): OpRecord => ({
    kind: `set_${slot}` as OpRecord["kind"],
    rCall: rCall(`set_${slot}`, [text == null ? "NULL" : rPositional(text)]),
    // No instance API; the labels live on spec.labels. Update via the
    // store's labelEdits state.
    jsCall: `instance.store.setLabelEdit(${jsLiteral(slot)}, ${text == null ? "null" : jsLiteral(text)});`,
    ts: now(),
  }),

  setWatermark: (text: string | null): OpRecord => ({
    kind: "set_watermark",
    rCall: rCall("set_watermark", [text == null ? "NULL" : rPositional(text)]),
    jsCall: `instance.store.setWatermark(${text == null ? "null" : jsLiteral(text)});`,
    ts: now(),
  }),

  paintRow: (rowId: string, token: string | null): OpRecord => ({
    kind: "paint_row",
    rCall: rCall("paint_row", [rPositional(rowId), token == null ? "NULL" : rPositional(token)]),
    jsCall: `instance.setSemantic(${jsObject({ rowId, token })});`,
    ts: now(),
  }),

  paintCell: (rowId: string, field: string, token: string | null): OpRecord => ({
    kind: "paint_cell",
    rCall: rCall("paint_cell", [
      rPositional(rowId),
      rPositional(field),
      token == null ? "NULL" : rPositional(token),
    ]),
    jsCall: `instance.setCellSemantic(${jsObject({ rowId, field, token })});`,
    ts: now(),
  }),

  setTheme: (name: string): OpRecord => ({
    kind: "set_theme",
    rCall: rCall("set_theme", [rPositional(name)]),
    jsCall: `instance.setTheme(${jsLiteral(name)});`,
    ts: now(),
  }),

  /**
   * Aspect-ratio target. `NULL` clears (renders at natural). Any positive
   * number pins the spec to that aspect; `save_plot()` reads it as the
   * default `ratio`, and the in-widget aspect slider drives it live.
   * `anchor` mirrors the R-side arg; "width" is the default and is omitted
   * from the emitted call to keep it terse.
   */
  setAspectRatio: (ratio: number | null,
                   anchor?: "width" | "height" | "auto"): OpRecord => {
    const r = ratio == null ? null : Math.round(ratio * 1000) / 1000;
    return {
      kind: "set_aspect_ratio",
      rCall: rCall("set_aspect_ratio", [
        r == null ? "NULL" : rPositional(r),
        anchor && anchor !== "width" ? rNamed("anchor", anchor) : null,
      ]),
      jsCall: `instance.setAspectRatio(${jsObject({ ratio: r, anchor: anchor === "width" ? undefined : anchor })});`,
      ts: now(),
    };
  },

  setSharedColumnWidths: (enabled: boolean): OpRecord => ({
    kind: "set_shared_column_widths",
    rCall: rCall("set_shared_column_widths", [enabled ? "TRUE" : "FALSE"]),
    // SplitTabvizInstance API; createTabviz's single-pane variant
    // doesn't expose it but the underlying split-store does.
    jsCall: `// set_shared_column_widths(${enabled}) — split-widget only`,
    ts: now(),
  }),

  /**
   * Positional arg is the data field (the R verb calls it `by`). We emit
   * it positionally so the reader can copy-paste directly.
   */
  sortRows: (field: string, direction: "asc" | "desc"): OpRecord => ({
    kind: "sort_rows",
    rCall: rCall("sort_rows", [rPositional(field), rNamed("direction", direction)]),
    jsCall: `instance.sortBy(${jsObject({ column: field, direction })});`,
    ts: now(),
  }),

  /**
   * Filter a single field by operator + value. Mirrors the R verb's
   * signature (`filter_rows(x, field, operator, value)`) — operator is
   * one of `"eq"`, `"neq"`, `"gt"`, `"lt"`, `"contains"`.
   */
  setFilter: (field: string, operator: string, value: unknown): OpRecord => ({
    kind: "filter_rows",
    rCall: rCall("filter_rows", [
      rPositional(field),
      rNamed("operator", operator),
      rNamed("value", value),
    ]),
    jsCall: `instance.applyFilter({ field: ${jsLiteral(field)}, filter: ${jsObject({ operator, value })} });`,
    ts: now(),
  }),

  clearFilters: (): OpRecord => ({
    kind: "clear_filters",
    rCall: "clear_filters()",
    jsCall: "instance.clearFilter();",
    ts: now(),
  }),
};

// ------------------------------------------------------------------
// Column builder rendering (for add_column)
// ------------------------------------------------------------------

/**
 * Render a ColumnSpec as a `col_*()` / `viz_*()` call. Good enough for
 * the common cases — we surface the column type, the field, and the
 * header if set. Advanced options are not re-emitted; the user can
 * follow up with `update_column()` if they care.
 */
export function renderColumnBuilder(col: {
  type?: string;
  field?: string;
  header?: string;
}): string {
  const type = col.type ?? "col_text";
  const fn = type.startsWith("viz_") ? type : type; // col_*  or  viz_*
  const args: string[] = [];
  if (col.field) args.push(rPositional(col.field));
  if (col.header) args.push(rNamed("header", col.header));
  return `${fn}(${args.join(", ")})`;
}

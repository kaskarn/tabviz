/**
 * Op recorder — incremental, append-only log of user-visible structural
 * operations rendered as fluent R API calls.
 *
 * Paired with `forestStore.opLog` and surfaced in the "View source" panel.
 * Theme-side edits are NOT logged here — they're rendered as a live
 * snapshot via `generateThemeSource()` in `theme-source.ts`.
 *
 * Recording contract (see the comment block atop `forestStore.svelte.ts`):
 *   every store mutation that changes user-visible non-theme state must
 *   push exactly one record via `recordOp()`. Do not collapse or
 *   deduplicate — backtracking is part of the log.
 */

export interface OpRecord {
  /** The one-call fluent string, e.g. `resize_column("drug", 160)`. */
  rCall: string;
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
    | "set_shared_column_widths";
  /** Monotonic timestamp (ms since epoch) — purely for debugging + ordering stability. */
  ts: number;
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
    ts: now(),
  }),

  moveColumn: (id: string, to: number | string): OpRecord => ({
    kind: "move_column",
    rCall: rCall("move_column", [rPositional(id), rNamed("to", to)]),
    ts: now(),
  }),

  addColumn: (colBuilder: string, after?: string | null): OpRecord => ({
    kind: "add_column",
    // colBuilder is a pre-rendered col_*() / viz_*() call (see below).
    rCall: rCall(
      "add_column",
      [colBuilder, after ? rNamed("after", after) : null],
    ),
    ts: now(),
  }),

  removeColumn: (id: string): OpRecord => ({
    kind: "remove_column",
    rCall: rCall("remove_column", [rPositional(id)]),
    ts: now(),
  }),

  updateColumn: (id: string, patch: Record<string, unknown>): OpRecord => {
    const namedArgs = Object.entries(patch).map(([k, v]) => rNamed(k, v));
    return {
      kind: "update_column",
      rCall: rCall("update_column", [rPositional(id), ...namedArgs]),
      ts: now(),
    };
  },

  moveRow: (id: string, to: number): OpRecord => ({
    kind: "move_row",
    rCall: rCall("move_row", [rPositional(id), rNamed("to", to)]),
    ts: now(),
  }),

  setCell: (rowId: string, field: string, value: unknown): OpRecord => ({
    kind: "set_cell",
    rCall: rCall("set_cell", [rPositional(rowId), rPositional(field), rPositional(value)]),
    ts: now(),
  }),

  setRowLabel: (rowId: string, label: string): OpRecord => ({
    kind: "set_row_label",
    rCall: rCall("set_row_label", [rPositional(rowId), rPositional(label)]),
    ts: now(),
  }),

  setLabelSlot: (
    slot: "title" | "subtitle" | "caption" | "footnote",
    text: string | null,
  ): OpRecord => ({
    kind: `set_${slot}` as OpRecord["kind"],
    rCall: rCall(`set_${slot}`, [text == null ? "NULL" : rPositional(text)]),
    ts: now(),
  }),

  setWatermark: (text: string | null): OpRecord => ({
    kind: "set_watermark",
    rCall: rCall("set_watermark", [text == null ? "NULL" : rPositional(text)]),
    ts: now(),
  }),

  paintRow: (rowId: string, token: string | null): OpRecord => ({
    kind: "paint_row",
    rCall: rCall("paint_row", [rPositional(rowId), token == null ? "NULL" : rPositional(token)]),
    ts: now(),
  }),

  paintCell: (rowId: string, field: string, token: string | null): OpRecord => ({
    kind: "paint_cell",
    rCall: rCall("paint_cell", [
      rPositional(rowId),
      rPositional(field),
      token == null ? "NULL" : rPositional(token),
    ]),
    ts: now(),
  }),

  setTheme: (name: string): OpRecord => ({
    kind: "set_theme",
    rCall: rCall("set_theme", [rPositional(name)]),
    ts: now(),
  }),

  setSharedColumnWidths: (enabled: boolean): OpRecord => ({
    kind: "set_shared_column_widths",
    rCall: rCall("set_shared_column_widths", [enabled ? "TRUE" : "FALSE"]),
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

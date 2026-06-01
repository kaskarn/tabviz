/**
 * debug-shapes — the *visual* half of the sizing-verification harness.
 *
 * Renders a spec's box-model geometry as an SVG of labeled boxes instead of
 * real cell content: every cell shows its allocated box, its horizontal
 * padding region, the text-anchor inset, and the row-kind. Strips content so
 * the box model itself is visible — the errors `computeLayoutMetrics` snapshots
 * numerically become eyeball-obvious here, and (rendered for both backends
 * later) this is the DOM↔SVG parity view.
 *
 * Pure function of `computeLayoutMetrics(spec)` — it draws nothing the metrics
 * don't already assert, so the visual and numeric gates agree by construction.
 *
 * See docs/dev/sizing-model.md §6b.
 */

import { computeLayoutMetrics, type LayoutMetrics, type RowMetric, type ExportOptions } from "./svg-generator";
import type { WebSpec } from "$types";

// Row-kind palette — distinct, legible fills for the box-model view (these are
// debug chrome, deliberately NOT theme colors).
const KIND_FILL: Record<RowMetric["kind"], string> = {
  data: "#eef2ff", // indigo-50
  group_header: "#fef9c3", // yellow-100
  spacer: "#f1f5f9", // slate-100
  summary: "#dcfce7", // green-100
  header: "#e0f2fe", // sky-100 (authored section header, distinct from group)
};
const KIND_STROKE: Record<RowMetric["kind"], string> = {
  data: "#6366f1",
  group_header: "#ca8a04",
  spacer: "#94a3b8",
  summary: "#16a34a",
  header: "#0284c7",
};

const BOX_STROKE = "#334155"; // cell allocated-box outline
const PAD_FILL = "rgba(244,114,182,0.25)"; // padding region (pink wash)
const ANCHOR = "#dc2626"; // text-anchor marker
const MARKER_LINE = "#2563eb"; // row marker-center guide
const LABEL_FG = "#0f172a";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function txt(x: number, y: number, s: string, size: number, anchor = "start", fill = LABEL_FG): string {
  return `<text x="${round(x)}" y="${round(y)}" font-family="monospace" font-size="${size}" ` +
    `text-anchor="${anchor}" fill="${fill}">${esc(s)}</text>`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Render the box-model debug view for a spec.
 * `options` passes through to computeLayoutMetrics (e.g. precomputed widths).
 */
export function renderDebugShapes(spec: WebSpec, options: ExportOptions = {}): string {
  const m = computeLayoutMetrics(spec, options);
  return renderDebugShapesFromMetrics(m);
}

/** Render directly from already-computed metrics (used by parity tooling that
 *  wants to draw the same metrics for both backends). */
export function renderDebugShapesFromMetrics(m: LayoutMetrics): string {
  const parts: string[] = [];
  const W = round(m.totalWidth);
  const H = round(m.totalHeight);
  const padX = m.spacing.cellPaddingX;
  const rowsTop = m.mainY + m.headerHeight;

  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  // ── Header band ───────────────────────────────────────────────────────
  parts.push(
    `<rect x="${round(m.spacing.padding)}" y="${round(m.mainY)}" ` +
      `width="${round(W - m.spacing.padding * 2)}" height="${round(m.headerHeight)}" ` +
      `fill="#e2e8f0" stroke="#475569" stroke-width="1"/>`,
  );
  parts.push(txt(m.spacing.padding + 4, m.mainY + 12, `header h=${round(m.headerHeight)}`, 10));

  // ── Per-column vertical guides + width labels (in header band) ────────
  for (const c of m.columns) {
    parts.push(
      `<line x1="${round(c.x)}" y1="${round(m.mainY)}" x2="${round(c.x)}" y2="${round(rowsTop + m.rowsHeight)}" ` +
        `stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="2 2"/>`,
    );
    parts.push(txt(c.x + 3, m.mainY + 26, `${c.type} w=${round(c.width)}`, 8, "start", "#475569"));
  }

  // ── Per-row, per-cell boxes ───────────────────────────────────────────
  const indentPx = m.spacing.indentPerLevel;
  for (const r of m.rows) {
    const yTop = rowsTop + r.top;
    const yMarker = rowsTop + r.markerCenter;
    // Total label indent = (group depth + authored indent) × indentPerLevel,
    // matching renderUnifiedTableRow. Drawn as an amber inset in the label
    // column so per-row indent is visible (not just folded into labelWidth).
    const totalIndent = (r.depth + r.indent) * indentPx;
    for (const c of m.columns) {
      // Allocated cell box.
      parts.push(
        `<rect x="${round(c.x)}" y="${round(yTop)}" width="${round(c.width)}" height="${round(r.height)}" ` +
          `fill="${KIND_FILL[r.kind]}" stroke="${KIND_STROKE[r.kind]}" stroke-width="0.75"/>`,
      );
      // Horizontal padding regions (left + right insets).
      if (padX > 0 && c.width > padX * 2) {
        parts.push(
          `<rect x="${round(c.x)}" y="${round(yTop)}" width="${round(padX)}" height="${round(r.height)}" fill="${PAD_FILL}"/>`,
        );
        parts.push(
          `<rect x="${round(c.x + c.width - padX)}" y="${round(yTop)}" width="${round(padX)}" height="${round(r.height)}" fill="${PAD_FILL}"/>`,
        );
      }
      // Text-anchor dot at the left inset, vertically at marker center.
      parts.push(
        `<circle cx="${round(c.x + padX)}" cy="${round(yMarker)}" r="1.5" fill="${ANCHOR}"/>`,
      );
    }
    // Row marker-center guide line across the table.
    parts.push(
      `<line x1="${round(m.spacing.padding)}" y1="${round(yMarker)}" x2="${round(W - m.spacing.padding)}" y2="${round(yMarker)}" ` +
        `stroke="${MARKER_LINE}" stroke-width="0.4" stroke-dasharray="4 3" opacity="0.7"/>`,
    );
    // Indent inset + per-row annotation live in the label (first) column.
    // Skip both when there are no columns (degenerate spec) — guards the
    // m.columns[0] access.
    const labelCol = m.columns[0];
    if (labelCol) {
      if (totalIndent > 0) {
        parts.push(
          `<rect x="${round(labelCol.x + padX)}" y="${round(yTop)}" width="${round(totalIndent)}" height="${round(r.height)}" ` +
            `fill="rgba(251,191,36,0.35)"/>`,
        );
      }
      parts.push(
        txt(
          labelCol.x + padX + totalIndent + 4,
          yTop + 10,
          `#${r.index} ${r.kind} h=${round(r.height)} d=${r.depth} i=${r.indent}`,
          8,
        ),
      );
    }
  }

  // ── Legend ────────────────────────────────────────────────────────────
  const legendY = rowsTop + m.rowsHeight + 14;
  parts.push(
    txt(
      m.spacing.padding,
      legendY,
      `padX=${padX}  rowH=${m.spacing.rowHeight}  indent/lvl=${m.spacing.indentPerLevel}  ` +
        `rowGroupPad=${m.spacing.rowGroupPadding}  cellPadY=${m.spacing.cellPaddingY}`,
      9,
      "start",
      "#475569",
    ),
  );
  parts.push(
    txt(
      m.spacing.padding,
      legendY + 12,
      `pink=padding region  red dot=text anchor  blue dash=marker center  fill=row kind`,
      8,
      "start",
      "#94a3b8",
    ),
  );

  parts.push(`</svg>`);
  return parts.join("\n");
}

/**
 * Layout debug instrumentation.
 *
 * Activated when the URL contains `?tabviz-debug-layout=1` (or the same
 * key in the document's data attributes). Compares the layout engine's
 * predicted row heights / Y positions against what the DOM actually
 * rendered, and logs any discrepancy > 1px. A second flag,
 * `?tabviz-debug-layout-overlay=1`, draws translucent red guide lines
 * on every predicted row boundary so misalignment is visible at a
 * glance.
 *
 * Designed to be a no-op in production (the flag check returns early)
 * and additive to the live widget (no behavioral changes — it only
 * reads the DOM and logs).
 */

import type { ComputedLayout, DisplayRow } from "$types";

export function isLayoutDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URLSearchParams(window.location.search);
    if (url.get("tabviz-debug-layout") === "1") return true;
  } catch {
    /* SSR / sandboxed iframe — fall through */
  }
  return false;
}

export function isLayoutOverlayEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URLSearchParams(window.location.search);
    if (url.get("tabviz-debug-layout-overlay") === "1") return true;
  } catch {
    /* same fallback */
  }
  return false;
}

interface RowReport {
  index: number;
  kind: "header" | "data" | "group_header" | "spacer";
  predictedHeight: number;
  actualHeight: number;
  delta: number;
  predictedTop: number;
  actualTop: number;
  topDelta: number;
}

export interface LayoutDebugInput {
  containerEl: HTMLElement;
  layout: ComputedLayout;
  displayRows: DisplayRow[];
  themeSpacing: {
    rowHeight: number;
    cellPaddingY: number;
    rowGroupPadding: number;
    rowBorderWidth?: number;
    headerHeight: number;
  };
}

/**
 * Measure the rendered grid and log a row-by-row comparison against
 * the layout engine's prediction. Tolerance: 1 pixel.
 */
export function reportLayoutMeasurements(input: LayoutDebugInput): void {
  const { containerEl, layout, displayRows, themeSpacing } = input;

  // Find every primary cell — they're tagged with `data-display-index`.
  // Using the primary column is simplest; every row has one.
  const cells = Array.from(
    containerEl.querySelectorAll<HTMLElement>("[data-display-index]"),
  );
  // Filter to first cell per row (primary column).
  const seen = new Set<string>();
  const primaryCells: HTMLElement[] = [];
  for (const cell of cells) {
    const idx = cell.dataset.displayIndex;
    if (idx == null) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    primaryCells.push(cell);
  }
  // Sort by data-display-index so we read in row order.
  primaryCells.sort((a, b) => Number(a.dataset.displayIndex) - Number(b.dataset.displayIndex));

  const containerRect = containerEl.getBoundingClientRect();
  const reports: RowReport[] = [];
  for (let i = 0; i < primaryCells.length; i++) {
    const cell = primaryCells[i];
    const r = cell.getBoundingClientRect();
    const dr = displayRows[i];
    const kind: RowReport["kind"] =
      dr?.type === "group_header"
        ? "group_header"
        : dr?.type === "data" && dr.row.style?.type === "spacer"
          ? "spacer"
          : "data";
    const predictedHeight = layout.rowHeights[i] ?? layout.rowHeight;
    const predictedTop = layout.rowPositions[i] ?? 0;
    const actualHeight = r.height;
    const actualTop = r.top - containerRect.top;
    reports.push({
      index: i,
      kind,
      predictedHeight,
      actualHeight,
      delta: actualHeight - predictedHeight,
      predictedTop,
      actualTop,
      topDelta: actualTop - predictedTop,
    });
  }

  // Header strip — measure the column-header row(s).
  const headerCells = Array.from(
    containerEl.querySelectorAll<HTMLElement>("[data-header-id]"),
  );
  const headerHeight = headerCells.length > 0
    ? headerCells.reduce((max, el) => Math.max(max, el.getBoundingClientRect().bottom), 0) -
      headerCells.reduce((min, el) => Math.min(min, el.getBoundingClientRect().top), Infinity)
    : 0;

  // Group + report
  /* eslint-disable no-console */
  console.groupCollapsed(
    "%c[tabviz layout] row report",
    "color: #2563eb; font-weight: 600",
  );
  console.log("theme.spacing", themeSpacing);
  console.log("layout.rowHeight (scalar)", layout.rowHeight);
  console.log("layout.headerHeight (predicted)", layout.headerHeight, "/ actual", headerHeight, "→ Δ", headerHeight - layout.headerHeight);
  const offenders = reports.filter(r => Math.abs(r.delta) > 1 || Math.abs(r.topDelta) > 1);
  if (offenders.length === 0) {
    console.log(`%c✓ ${reports.length} rows aligned within 1px`, "color: #16a34a");
  } else {
    console.log(`%c✗ ${offenders.length}/${reports.length} rows misaligned`, "color: #dc2626");
    console.table(reports.map(r => ({
      "#": r.index,
      kind: r.kind,
      "h pred": r.predictedHeight,
      "h actual": Math.round(r.actualHeight * 10) / 10,
      "Δh": Math.round(r.delta * 10) / 10,
      "y pred": r.predictedTop,
      "y actual": Math.round(r.actualTop * 10) / 10,
      "Δy": Math.round(r.topDelta * 10) / 10,
    })));
  }
  console.groupEnd();
  /* eslint-enable no-console */
}

/**
 * Inject a translucent overlay drawing a red horizontal line at every
 * predicted row top. Intended to be visually compared against the DOM
 * row borders — any misalignment shows as the red line crossing /
 * not-aligning-with the row border. Returns a cleanup function.
 */
export function paintLayoutOverlay(
  containerEl: HTMLElement,
  layout: ComputedLayout,
  rowsAreaTop: number,
): () => void {
  const overlay = document.createElement("div");
  overlay.dataset.tabvizDebugOverlay = "1";
  overlay.style.cssText = [
    "position: absolute",
    "left: 0",
    "right: 0",
    `top: ${rowsAreaTop}px`,
    "bottom: 0",
    "pointer-events: none",
    "z-index: 9999",
  ].join("; ");
  for (let i = 0; i <= layout.rowPositions.length; i++) {
    const y = i < layout.rowPositions.length
      ? layout.rowPositions[i]
      : (layout.rowPositions[layout.rowPositions.length - 1] ?? 0) +
        (layout.rowHeights[layout.rowHeights.length - 1] ?? layout.rowHeight);
    const line = document.createElement("div");
    line.style.cssText = [
      "position: absolute",
      "left: 0",
      "right: 0",
      `top: ${y}px`,
      "height: 1px",
      "background: rgba(220, 38, 38, 0.6)",
    ].join("; ");
    overlay.appendChild(line);
  }
  containerEl.appendChild(overlay);
  return () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };
}

/**
 * RowKind — the single source of truth for "what kind of row is this".
 *
 * Row classification was scattered across ~50 sites in 3+ predicate styles
 * (`dr.type === "group_header"`, `row.style?.type === "spacer"`,
 * `t === "header" || t === "summary" || …`). Same kind, different predicates →
 * drift risk (e.g. auto-width skips header+spacer while banding skips
 * header+summary+spacer — those are *different properties*, not the same check
 * written two ways). This module makes the classification one function and the
 * per-kind behavior a declared property table, so a kind's traits live in one
 * place instead of being re-derived at each call site.
 *
 * **Behavior-preserving foundation (Phase 1).** `resolveRowKind` is the
 * canonical form of the pre-existing `rowKindOf` in svg-generator; the property
 * flags below encode exactly today's scattered predicates. This is the seam the
 * larger row-kind work (registry → traits/scope → details/faceting, see
 * docs/dev/row-types.md) grows from — additive, not a rewrite.
 *
 * NOTE the `overall` summary diamond is NOT a row (it's `spec.data.overall`,
 * rendered as a singleton after the rows) so it is deliberately absent from
 * this union — classification here is strictly per-display-row.
 */

/** The kinds a display row can resolve to. `panel` is a full-width
 *  details/disclosure region owned by a data row (free content, not column
 *  cells). */
export type RowKind = "data" | "group_header" | "spacer" | "summary" | "header" | "panel";

/**
 * Minimal structural shape needed to classify a row. Compatible with both
 * `DisplayRow` (types/index.ts) and `BandingDisplayRow` (lib/banding.ts) so a
 * single resolver serves every call site without importing the heavy types.
 */
export type ClassifiableRow =
  | { type: "group_header"; depth?: number }
  | { type: "panel"; depth?: number }
  | { type: "data"; row: { style?: { type?: string } | null } };

/**
 * Resolve a display row to its single kind. Canonical form of the
 * pre-existing `rowKindOf`: structural split (group_header) first, then the
 * authored `row.style.type` (spacer / summary / header), default `data`.
 */
export function resolveRowKind(dr: ClassifiableRow): RowKind {
  if (dr.type === "group_header") return "group_header";
  if (dr.type === "panel") return "panel";
  const st = dr.row.style?.type;
  if (st === "spacer") return "spacer";
  if (st === "summary") return "summary";
  if (st === "header") return "header";
  return "data";
}

/**
 * Per-kind behavior flags — each captures a property the renderer currently
 * re-derives inline. Encodes TODAY's behavior verbatim (see the predicate each
 * replaces); changing layout/theming behavior is later, deliberate work.
 */
export interface RowKindProps {
  /** Contributes to alternating-row banding. Today only plain `data` does;
   *  header/summary/spacer are skipped (lib/banding.ts `isStyled`). */
  readonly banded: boolean;
  /** Included in column auto-width measurement. Today header & spacer are
   *  skipped (svg-generator:348, columns.svelte.ts:597, width-utils.ts:225). */
  readonly measuresWidth: boolean;
  /** Renders normal column-cell content. False for group_header (renders a
   *  full-span label) and spacer (renders nothing). */
  readonly rendersCells: boolean;
  /** The forest marker is a summary diamond rather than a point+interval
   *  (RowInterval.svelte:116, svg-generator:1756). */
  readonly summaryMarker: boolean;
}

const PROPS: Record<RowKind, RowKindProps> = {
  data:         { banded: true,  measuresWidth: true,  rendersCells: true,  summaryMarker: false },
  header:       { banded: false, measuresWidth: false, rendersCells: true,  summaryMarker: false },
  summary:      { banded: false, measuresWidth: true,  rendersCells: true,  summaryMarker: true },
  spacer:       { banded: false, measuresWidth: false, rendersCells: false, summaryMarker: false },
  // group_header.measuresWidth is moot — group headers never enter the per-
  // data-row width loop (they're measured via a separate group-label path).
  // Marked false to match intent (they don't measure as a data cell).
  group_header: { banded: false, measuresWidth: false, rendersCells: false, summaryMarker: false },
  // panel = full-width free-content disclosure region: not banded, not a width
  // contributor, renders free content (not column cells), no summary marker.
  panel:        { banded: false, measuresWidth: false, rendersCells: false, summaryMarker: false },
};

/** Behavior flags for a kind. */
export function rowKindProps(kind: RowKind): RowKindProps {
  return PROPS[kind];
}

/** Convenience: classify then read a single property. */
export function isBanded(dr: ClassifiableRow): boolean {
  return PROPS[resolveRowKind(dr)].banded;
}

/**
 * Row-kind height cascade (v4 substrate, Phase 5).
 *
 * Per Stage 1 §33–34. The cascade has 5 layers; this module ships
 * layers 1–4. Layer 5 (interactive pin, absolute px) was shipped in main
 * by the row-kind agent's handoff (`computeRowLayout` consumes a
 * `rowKindHeights` map on its input).
 *
 *   Layer 1: intrinsic kind ratios — built-in defaults per kind.
 *   Layer 2: inheritance graph     — fixed parent map (summary → data).
 *   Layer 3: theme-level default   — `inputs.row_kinds.<kind>.heightRatio`.
 *   Layer 4: constructor override  — per-spec `row_heights` map.
 *   Layer 5: interactive pin (px)  — already in main.
 *
 * Resolution formula (per Stage 1 §33a):
 *
 *   resolvedHeight(kind) =
 *     pin[kind]
 *     ?? (rowHeight × resolveRatio(kind))
 *
 *   resolveRatio(kind) =
 *     constructor.row_heights[kind]
 *     ?? theme.row_kinds[kind].heightRatio
 *     ?? resolveRatio(parent(kind))         // walks inheritance
 *     ?? INTRINSIC_KIND_RATIO[kind]
 *
 * Snake_case kinds today match the existing `RowKind` enum. Q9 closure
 * locks in the kebab rename at substrate-landing time; until then this
 * module mirrors the in-tree enum spelling.
 */

import type { RowKind } from "./row-kind";

// ============================================================================
// LAYER 1 — INTRINSIC KIND RATIOS (constants)
// ============================================================================

/** Per-kind intrinsic ratio of the density `rowHeight`. Per Stage 1 §33b:
 *  spacer is half the data row height; everything else equals data.
 *  These are ratios so they scale with density + density factor for free. */
export const INTRINSIC_KIND_RATIOS: Readonly<Record<RowKind, number>> = {
  data:         1.0,
  group_header: 1.0,
  summary:      1.0,
  spacer:       0.5,
  header:       1.0,
  panel:        1.0,
};

// ============================================================================
// LAYER 2 — INHERITANCE GRAPH (constants)
// ============================================================================

/** Shallow, fixed parent map. A kind with no value at layers 3-4 looks
 *  to its parent before falling back to the intrinsic ratio (layer 1).
 *  Per Stage 1 §33c + Q-P5.1 closure (hard-coded; not user-configurable). */
export const KIND_INHERITANCE: Partial<Record<RowKind, RowKind>> = {
  summary: "data",
  // section_header → group_header would be added when section_header
  // joins the RowKind enum; today it's not in the type union.
};

// ============================================================================
// LAYER 3 — THEME-LEVEL DEFAULT (input shape)
// ============================================================================

/** Per-kind theme inputs. Currently only `heightRatio`; Stage 2 paint
 *  fields (bg, fg, border, weight) will extend this shape per Q10
 *  closure. Lives in ThemeInputs.row_kinds. */
export interface RowKindInputs {
  /** Theme-default ratio (relative to density rowHeight). Optional;
   *  when absent, falls through to layer 2 inheritance / layer 1
   *  intrinsic. */
  readonly heightRatio?: number;
  // Future Stage 2 paint fields land here:
  //   bg?: ColorRef; fg?: ColorRef; border?: ColorRef; weight?: number;
}

/** Theme-level row-kinds inputs map. Per Q10 closure (structured shape). */
export type RowKindsInputs = Partial<Record<RowKind, RowKindInputs>>;

// ============================================================================
// LAYER 4 — CONSTRUCTOR OVERRIDE
// ============================================================================

/** Per-spec constructor override (`row_heights` field on forest_plot()).
 *  Values are ratios, not absolute px. Per Q-P5.2 closure. */
export type RowHeightsOverride = Partial<Record<RowKind, number>>;

// ============================================================================
// RESOLUTION
// ============================================================================

/** The full inputs to the height cascade resolution. */
export interface ResolveContext {
  /** Layer 3 — from `inputs.row_kinds`. */
  readonly themeKinds?: RowKindsInputs;
  /** Layer 4 — from the spec constructor's `row_heights` param. */
  readonly constructorOverride?: RowHeightsOverride;
}

/** Resolve the per-kind ratio via the layered cascade (layers 1-4).
 *
 *  Walks the inheritance graph as needed:
 *
 *    1. Constructor override
 *    2. Theme default (`inputs.row_kinds.<kind>.heightRatio`)
 *    3. Recurse into parent kind (per KIND_INHERITANCE)
 *    4. Intrinsic ratio (INTRINSIC_KIND_RATIOS)
 *
 *  Step 3 prevents infinite loops by checking each kind only once during
 *  a single resolve call; if the inheritance graph contains a cycle (it
 *  doesn't, by design) we fall through to the intrinsic ratio. */
export function resolveRowKindRatio(
  kind: RowKind,
  ctx: ResolveContext = {},
  _visited: Set<RowKind> = new Set(),
): number {
  if (_visited.has(kind)) {
    // Cycle guard (shouldn't trigger with the design's shallow graph).
    return INTRINSIC_KIND_RATIOS[kind];
  }
  _visited.add(kind);

  // A ratio is only honored if FINITE and POSITIVE — a garbage constructor/
  // theme value (negative, NaN, ±Inf, 0) would otherwise produce a negative or
  // NaN base row height. Invalid → fall through to the next layer (matching the
  // layer-5 `sanitizeRowKindPins` finite+positive discipline). No upper cap —
  // a large ratio is a legitimate (if odd) choice; only non-finite/≤0 is wrong.
  const isValidRatio = (r: number | undefined): r is number =>
    r !== undefined && Number.isFinite(r) && r > 0;

  // Layer 4 — constructor override
  const ctor = ctx.constructorOverride?.[kind];
  if (isValidRatio(ctor)) return ctor;

  // Layer 3 — theme-level default
  const themeRatio = ctx.themeKinds?.[kind]?.heightRatio;
  if (isValidRatio(themeRatio)) return themeRatio;

  // Layer 2 — inheritance walk
  const parent = KIND_INHERITANCE[kind];
  if (parent) {
    return resolveRowKindRatio(parent, ctx, _visited);
  }

  // Layer 1 — intrinsic
  return INTRINSIC_KIND_RATIOS[kind];
}

/**
 * Sanitize an UNTRUSTED `figureLayout.rowKindHeights` wire block down to
 * valid layer-5 pins: keys gated against the real RowKind vocabulary
 * (`panel` excluded — content-driven), values finite positive numbers
 * clamped to [8, 2000]. Shared by the store hydration AND the SVG export
 * path so both runtimes accept exactly the same pins (interactivity
 * review pass). Returns undefined when nothing survives.
 */
export function sanitizeRowKindPins(
  block: unknown,
): Partial<Record<RowKind, number>> | undefined {
  if (block == null || typeof block !== "object" || Array.isArray(block)) return undefined;
  let out: Partial<Record<RowKind, number>> | undefined;
  for (const [kind, px] of Object.entries(block as Record<string, unknown>)) {
    if (!(kind in INTRINSIC_KIND_RATIOS) || kind === "panel") continue;
    if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) continue;
    out ??= {};
    out[kind as RowKind] = Math.min(2000, Math.max(8, Math.round(px)));
  }
  return out;
}

/** Compute the resolved per-kind base height in px.
 *
 *  Returns the layer-5 pin if set; otherwise computes
 *  `rowHeight × resolveRatio(kind, ctx)`.
 *
 *  Used by `computeRowLayout` to set each row's base height (content
 *  growth above this floor is applied separately). */
export function resolveRowKindHeight(
  kind: RowKind,
  rowHeight: number,
  pinPx: number | undefined,
  ctx: ResolveContext = {},
): number {
  if (pinPx !== undefined) return pinPx;
  const ratio = resolveRowKindRatio(kind, ctx);
  return rowHeight * ratio;
}

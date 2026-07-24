/**
 * Spacing-token roster + ingress guard (D42 — the per-token Spacing tab).
 *
 * SINGLE SOURCE for the set of spacing tokens a `spacing_overrides` authoring
 * input may carry. The roster mirrors the 15 `DENSITY_PX` keys (camelCased —
 * the resolved `SpacingTokens` shape) and is R↔TS sync-gated
 * (`test-spacing-roster-sync.R`): R `SpacingTokens` props ↔ these keys ↔
 * `DENSITY_PX`.
 *
 * Overrides are ABSOLUTE px, sparse (only set tokens present), and applied by
 * the resolver AFTER `density × density_factor` (see theme-adapter's spacing
 * assembly + resolve-theme's `tokenDensityPx`). They ride the theme artifact's
 * `inputs` envelope, so they travel with the theme and survive re-resolution.
 *
 * UNTRUSTED INGRESS: spacing reaches SVG coords/sizes, so every wire ingress
 * must gate values through `clampSpacing` (finite guard — rejects NaN/±Inf, the
 * poison class — + per-token bounds) and drop unknown keys via `isSpacingToken`.
 */

/** The 15 overridable spacing tokens (camelCase — the resolved cluster shape).
 *  Frozen; order matches `DENSITY_PX`. */
export const SPACING_TOKEN_KEYS = [
  "rowHeight",
  "headerHeight",
  "padding",
  "containerPadding",
  "axisGap",
  "columnGroupPadding",
  "rowGroupPadding",
  "cellPaddingX",
  "cellPaddingY",
  "groupPadding",
  "footerGap",
  "titleSubtitleGap",
  "headerGap",
  "bottomMargin",
  "indentPerLevel",
] as const;

export type SpacingToken = (typeof SPACING_TOKEN_KEYS)[number];

const SPACING_TOKEN_SET: ReadonlySet<string> = new Set(SPACING_TOKEN_KEYS);

/** Per-token clamp bounds `[min, max]` (px). Values outside are clamped, not
 *  dropped; non-finite is rejected (see `clampSpacing`). Bounds are generous —
 *  they exist to stop pathological geometry, not to police taste. */
export const SPACING_TOKEN_BOUNDS: Readonly<Record<SpacingToken, readonly [number, number]>> = {
  rowHeight:          [8, 120],
  headerHeight:       [16, 120],
  padding:            [0, 80],
  containerPadding:   [0, 80],
  axisGap:            [0, 60],
  columnGroupPadding: [0, 40],
  // The next three carry the ranges the arrange-tool canvas seams already
  // offered before D42 redirected them here (60 / 80 / 60) — narrowing a
  // bound would have silently shortened an existing drag.
  rowGroupPadding:    [0, 60],
  cellPaddingX:       [0, 40],
  cellPaddingY:       [0, 30],
  groupPadding:       [0, 60],
  footerGap:          [0, 80],
  titleSubtitleGap:   [0, 60],
  headerGap:          [0, 60],
  bottomMargin:       [0, 80],
  indentPerLevel:     [0, 48],
};

/** Ingress type-guard: is `key` a known spacing token? */
export function isSpacingToken(key: string): key is SpacingToken {
  return SPACING_TOKEN_SET.has(key);
}

/**
 * Clamp a spacing override value to its token's bounds. Returns `null` for
 * non-finite input (NaN / ±Infinity) so the caller can drop the key and let the
 * token inherit its density-derived base — spacing feeds geometry, so a poison
 * value must never reach a coordinate.
 */
export function clampSpacing(token: SpacingToken, value: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const [min, max] = SPACING_TOKEN_BOUNDS[token];
  return Math.min(max, Math.max(min, value));
}

/**
 * Sanitize a raw `spacing_overrides` record at ingress: drop unknown keys and
 * non-finite / out-of-range-coerced values. Returns `undefined` when nothing
 * survives (sparse — absent means "no overrides", inherit the cascade).
 */
export function sanitizeSpacingOverrides(
  raw: unknown,
): Partial<Record<SpacingToken, number>> | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const out: Partial<Record<SpacingToken, number>> = {};
  let any = false;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSpacingToken(key)) continue;
    const clamped = clampSpacing(key, val as number);
    if (clamped == null) continue;
    out[key] = clamped;
    any = true;
  }
  return any ? out : undefined;
}

/**
 * Apply overrides onto a resolved spacing cluster (absolute-px replace).
 * Pure; the caller owns whether `overrides` is trusted (resolver) or must be
 * pre-sanitized (ingress). Unknown keys are ignored defensively.
 */
export function applySpacingOverrides<T extends Record<SpacingToken, number>>(
  base: T,
  overrides: Partial<Record<SpacingToken, number>> | undefined,
): T {
  if (!overrides) return base;
  const out = { ...base };
  for (const token of SPACING_TOKEN_KEYS) {
    const v = overrides[token];
    if (v != null && Number.isFinite(v)) out[token as keyof T] = v as T[keyof T];
  }
  return out;
}

/**
 * Per-anchor lightness ENVELOPES for the identity color editor.
 *
 * The LCH editor's L slider spanned the full `[0, 1]` for every anchor,
 * which is honest OKLCH but a poor instrument: `paper` is the figure's
 * background sheet, and every usable value lives in the top sliver of
 * that domain (all nine shipped presets sit at L 0.987). Ninety percent
 * of the track was therefore "unreadable figure" and the useful range
 * was a few pixels wide. Narrowing the envelope spends the whole track
 * where the choices actually are.
 *
 * The table is authored in **light-polarity (authoring) space** — the
 * same space `inputs.anchors` is stored in. The settings panel displays
 * anchors polarity-REFLECTED (dark themes show the reflected L, see
 * `polarity.ts`), so `anchorLRange` reflects the envelope with them.
 * `reflectL` is order-reversing, hence the min/max swap.
 *
 * Anchors with no entry keep the full `[0, 1]` domain (ink, brand,
 * accent, and every status color) — only `paper` has an envelope this
 * narrow and this uncontroversial.
 */

import { reflectL } from "./polarity";

/** An inclusive slider domain. */
export interface LRange {
  min: number;
  max: number;
}

/** Full OKLCH lightness domain — the default for un-tabled anchors. */
export const FULL_L_RANGE: Readonly<LRange> = Object.freeze({ min: 0, max: 1 });

/**
 * Authoring-space L envelopes, keyed by anchor name. Sparse on purpose:
 * an anchor is listed only when its usable range is a strict subset of
 * `[0, 1]`.
 */
export const ANCHOR_L_RANGE: Readonly<Record<string, Readonly<LRange>>> = Object.freeze({
  /** It's paper. Below ~0.9 it stops reading as a sheet and starts
   *  reading as a mid-tone fill that no ink grade contrasts against. */
  paper: Object.freeze({ min: 0.9, max: 1 }),
});

/**
 * Resolve the L slider domain for one anchor.
 *
 * @param key      Anchor name (`paper` / `ink` / `brand` / `accent` / …).
 * @param dark     True when the editor displays polarity-reflected values.
 * @param currentL The anchor's CURRENT display L. A value outside the
 *                 envelope widens it: an imported theme or a hex typed
 *                 into the field must never be shown pinned at an end
 *                 that misreports it. The envelope guides; it never lies.
 */
export function anchorLRange(
  key: string,
  { dark = false, currentL }: { dark?: boolean; currentL?: number } = {},
): LRange {
  const base = ANCHOR_L_RANGE[key];
  if (!base) return { ...FULL_L_RANGE };

  let min = dark ? reflectL(base.max) : base.min;
  let max = dark ? reflectL(base.min) : base.max;

  if (currentL !== undefined && Number.isFinite(currentL)) {
    min = Math.min(min, currentL);
    max = Math.max(max, currentL);
  }
  return { min, max };
}

/**
 * Slider step for an L domain. A narrowed envelope needs a finer step or
 * the 0.005 default quantizes a 0.1-wide track into 20 stops.
 */
export function anchorLStep(range: LRange): number {
  return range.max - range.min <= 0.25 ? 0.002 : 0.005;
}

/**
 * Highest hue the H slider may emit.
 *
 * Hue is CIRCULAR and its canonical domain is the HALF-OPEN `[0, 360)` —
 * `validateThemeInputs` rejects exactly 360, because 360° ≡ 0° and a closed
 * domain would admit two spellings of one hue. The track therefore tops out
 * at 359; nothing is lost, since 359 and 0 are adjacent on the wheel.
 *
 * Regression (2026-07-28): the control ran to 360 while the validator
 * rejected it, so dragging any anchor's hue to the end of the track emitted
 * an out-of-contract theme. The resolver threw from inside the widget's
 * paint path, mid-Svelte-effect-flush, and killed the reactive graph —
 * figure and settings panel both frozen until reload.
 *
 * Gate: `anchor-ranges.test.ts` pins this against the validator's contract.
 */
export const HUE_MAX = 359;

/** Slider step for the H axis (whole degrees). */
export const HUE_STEP = 1;

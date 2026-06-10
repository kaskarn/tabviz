/**
 * CSS-scale compensation for drag gestures (interactivity review pass).
 *
 * Every interactive seam/handle lives INSIDE `.tabviz-scalable`, which
 * carries `transform: scale(--tv-actual-scale | --tv-zoom)`. Pointer
 * deltas arrive in CLIENT px (scaled); the values they mutate (row
 * heights, column widths, spacing gaps, axis pixel ranges) are LAYOUT px.
 * Without dividing by the live scale, a drag at 50% auto-fit moves the
 * target half as far as the cursor (2:1 lag) and at 200% zoom it outruns
 * the cursor — auto-fit shrink is the DEFAULT state for wide tables, so
 * this is the common case, not an edge case.
 *
 * The factor is measured from the element itself (rendered rect ÷ layout
 * size), so it composes with any host-page transforms too. Falls back to
 * 1 when layout size is unavailable (jsdom, zero-size, SVG without
 * usable layout box).
 */
export function elementScale(el: Element): number {
  const rect = el.getBoundingClientRect();
  // HTMLElement: offsetWidth is the unscaled layout width.
  const layoutW = (el as HTMLElement).offsetWidth;
  if (typeof layoutW === "number" && layoutW > 0 && rect.width > 0) {
    return rect.width / layoutW;
  }
  // SVG hosts (no offsetWidth): the width attribute is the layout width.
  const attrW = Number((el as SVGElement).getAttribute?.("width"));
  if (Number.isFinite(attrW) && attrW > 0 && rect.width > 0) {
    return rect.width / attrW;
  }
  return 1;
}

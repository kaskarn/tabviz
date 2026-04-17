// Utilities shared by column and row drag-and-drop.

export interface GapHit {
  index: number;        // insertion index (0..siblings.length)
  x: number;            // gap x-coordinate in viewport space (for column DnD)
  y: number;            // gap y-coordinate in viewport space (for row DnD)
}

/**
 * For a list of sibling header cells (by stable id), find the insertion gap nearest
 * to the pointer's clientX. Returns null if the pointer is entirely outside the
 * combined bounding box of the siblings (scope violation).
 */
export function hitTestColumnGaps(
  clientX: number,
  clientY: number,
  siblingIds: string[],
  getEl: (id: string) => HTMLElement | null,
): GapHit | null {
  if (siblingIds.length === 0) return null;

  const rects: { id: string; rect: DOMRect }[] = [];
  for (const id of siblingIds) {
    const el = getEl(id);
    if (el) rects.push({ id, rect: el.getBoundingClientRect() });
  }
  if (rects.length === 0) return null;

  // Scope: vertical band is the union of rects' vertical extents.
  const top = Math.min(...rects.map((r) => r.rect.top));
  const bottom = Math.max(...rects.map((r) => r.rect.bottom));
  const left = Math.min(...rects.map((r) => r.rect.left));
  const right = Math.max(...rects.map((r) => r.rect.right));

  // Scope check: allow some vertical slack (24px above/below the band) so the user
  // can drag downward into the data area without losing the drop target.
  const SLACK_Y = 48;
  if (clientY < top - SLACK_Y || clientY > bottom + SLACK_Y) return null;
  if (clientX < left - 8 || clientX > right + 8) return null;

  // Find nearest gap: before each rect or after the last one.
  // Gaps are at positions: [rect[0].left, rect[0].right, rect[1].right, ..., rect[N-1].right]
  const gaps: number[] = [rects[0].rect.left];
  for (const { rect } of rects) gaps.push(rect.right);

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < gaps.length; i++) {
    const d = Math.abs(clientX - gaps[i]);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return { index: bestIdx, x: gaps[bestIdx], y: (top + bottom) / 2 };
}

/**
 * For a list of row elements (by displayRow index) find the insertion gap nearest
 * the pointer's clientY. Returns null if the pointer is outside the allowed scope.
 * `allowedIndices` is the set of displayRow indices that are valid drop-neighbors
 * (those belonging to the drag's scope).
 */
export function hitTestRowGaps(
  clientX: number,
  clientY: number,
  allowedIndices: number[],
  getRowEl: (displayIndex: number) => HTMLElement | null,
): GapHit | null {
  if (allowedIndices.length === 0) return null;
  const rects: { idx: number; rect: DOMRect }[] = [];
  for (const idx of allowedIndices) {
    const el = getRowEl(idx);
    if (el) rects.push({ idx, rect: el.getBoundingClientRect() });
  }
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((r) => r.rect.left));
  const right = Math.max(...rects.map((r) => r.rect.right));
  const top = Math.min(...rects.map((r) => r.rect.top));
  const bottom = Math.max(...rects.map((r) => r.rect.bottom));

  const SLACK_X = 80;
  if (clientX < left - SLACK_X || clientX > right + SLACK_X) return null;
  if (clientY < top - 12 || clientY > bottom + 12) return null;

  // Gap positions: top of first, then bottom of each.
  const gapYs: number[] = [rects[0].rect.top];
  for (const { rect } of rects) gapYs.push(rect.bottom);

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < gapYs.length; i++) {
    const d = Math.abs(clientY - gapYs[i]);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return { index: bestIdx, x: (left + right) / 2, y: gapYs[bestIdx] };
}

// Weighted column-width distribution — the reversible core of multi-flex.
//
// Distributes the difference between a target total width and the sum of natural
// (content) widths across columns *proportional to a per-column flex weight*,
// respecting per-column [min, max] bounds with constrained redistribution
// (CSS flex-grow/shrink "water-filling"). See docs/dev/multi-flex-columns.md.
//
// PURE + REVERSIBLE: the result is a function of (naturals, weights, bounds,
// target) only — no stored state. natural → T → natural returns identically, and
// T → T' is independent of history. This is what replaces the stateful single
// `forestWidth` scalar. Policy-free: the type→weight table lives elsewhere
// (flex-weights.ts); this engine just consumes weights.
//
// V8-safe, bun-testable: no DOM, no runes.

export interface FlexItem {
  id: string;
  /** Natural (content) width. */
  natural: number;
  /** Flex weight ≥ 0. 0 = immovable (pinned); higher = absorbs more delta. */
  weight: number;
  /** Lower bound (content floor). Default 0. */
  min?: number;
  /** Upper bound. Default Infinity. */
  max?: number;
}

export interface FlexDistribution {
  /** Resolved width per column id. */
  widths: Record<string, number>;
  /** Achieved total (Σ widths). */
  total: number;
  /** Unabsorbed delta (target − achieved); non-zero when every flexible column
   *  hit a bound. */
  residual: number;
}

const EPS = 1e-6;

/**
 * Distribute `targetTotal` across `items` by flex weight, clamped to per-column
 * [min, max] with redistribution of any clamped overflow to the still-flexible
 * columns. Weight-0 columns stay at their (clamped) natural width.
 */
export function distributeFlexWidths(
  items: FlexItem[],
  targetTotal: number,
): FlexDistribution {
  const widths: Record<string, number> = {};
  const lo: Record<string, number> = {};
  const hi: Record<string, number> = {};
  let naturalSum = 0;
  for (const it of items) {
    lo[it.id] = it.min ?? 0;
    hi[it.id] = it.max ?? Number.POSITIVE_INFINITY;
    // Start every column at its (bounded) natural width.
    widths[it.id] = Math.min(hi[it.id], Math.max(lo[it.id], it.natural));
    naturalSum += it.natural;
  }

  // Delta is measured against raw naturals (so a column whose natural already
  // violated a bound doesn't silently eat budget here — its clamp shows up as
  // residual, surfacing the inconsistency rather than hiding it).
  let remaining = targetTotal - naturalSum;

  // Active = flexible (weight > 0) and not yet frozen at a bound.
  let active = items.filter((it) => it.weight > 0).map((it) => it.id);

  // Water-fill: each round hands the current `remaining` to the active set by
  // weight; columns that hit a bound freeze, their unabsorbed share stays in
  // `remaining` for the next round. Terminates when nothing clamps (remaining
  // fully absorbed) or no flexible column is left.
  while (active.length > 0 && Math.abs(remaining) > EPS) {
    let sumW = 0;
    for (const id of active) sumW += weightOf(items, id);
    if (sumW <= 0) break;

    const stillActive: string[] = [];
    let applied = 0;
    let clampedAny = false;
    for (const id of active) {
      const w = weightOf(items, id);
      const give = remaining * (w / sumW);
      const before = widths[id];
      const tentative = before + give;
      if (tentative < lo[id] - EPS) {
        widths[id] = lo[id];
        clampedAny = true;
      } else if (tentative > hi[id] + EPS) {
        widths[id] = hi[id];
        clampedAny = true;
      } else {
        widths[id] = tentative;
        stillActive.push(id); // unclamped → can absorb redistribution next round
      }
      applied += widths[id] - before;
    }
    remaining -= applied;
    active = stillActive;
    // No clamping → `applied` consumed all of `remaining` (shares sum to it);
    // the loop guard will exit. Clamping → loop again to redistribute.
    if (!clampedAny) break;
  }

  let total = 0;
  for (const id of Object.keys(widths)) total += widths[id];
  return { widths, total, residual: targetTotal - total };
}

function weightOf(items: FlexItem[], id: string): number {
  for (const it of items) if (it.id === id) return it.weight;
  return 0;
}

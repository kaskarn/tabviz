import type { BandingSpec, Group, Row } from "$types";

/**
 * Minimal display-row shape the banding util needs. Both the Svelte store's
 * `DisplayRow` (group: Group) and the SVG generator's flatter shape
 * (groupId: string) are accepted — whichever field is present is used to
 * resolve the group.
 */
export type BandingDisplayRow =
  | { type: "group_header"; group?: Group; groupId?: string; depth: number }
  | { type: "data"; row: Row; depth: number };

/**
 * Parse a user-facing banding string (matching the R grammar) into a
 * normalized BandingSpec. Throws on invalid input — callers that receive
 * untrusted strings (e.g. the settings panel UI) should sanitize first.
 */
export function parseBandingString(s: string): BandingSpec {
  if (s === "none" || s === "row" || s === "group") {
    return { mode: s, level: null };
  }
  const m = /^group-(\d+)$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= 1) {
      return { mode: "group", level: n };
    }
  }
  throw new Error(`Invalid banding value: ${s}`);
}

/**
 * Serialize a BandingSpec back to the user-facing string form — used to
 * round-trip through a single "current value" in the settings UI.
 */
export function bandingSpecToString(spec: BandingSpec): string {
  if (spec.mode === "none" || spec.mode === "row") return spec.mode;
  if (spec.level == null) return "group";
  return `group-${spec.level}`;
}

/**
 * Compute the maximum group depth present in a spec (1-based; matches the
 * `group-n` grammar). Returns 0 if there are no groups.
 */
export function maxGroupDepth(groups: readonly Group[] | undefined): number {
  if (!groups || groups.length === 0) return 0;
  let max = 0;
  for (const g of groups) {
    if (g.depth + 1 > max) max = g.depth + 1;
  }
  return max;
}

/**
 * For a data row in `groupId`, walk ancestors to find the group at
 * `targetDepth` (0-based). Returns its id, or `null` if the row is
 * above/outside the banding level.
 */
function ancestorGroupIdAtDepth(
  groupId: string | null | undefined,
  targetDepth: number,
  groupMap: Map<string, Group>
): string | null {
  if (!groupId) return null;
  let g = groupMap.get(groupId);
  while (g) {
    if (g.depth === targetDepth) return g.id;
    if (g.depth < targetDepth) return null;
    if (!g.parentId) return null;
    g = groupMap.get(g.parentId);
  }
  return null;
}

/**
 * Compute a band index (0 | 1 | null) for every display row. `null` means
 * the row should not carry any banding class (e.g. styled header/summary
 * rows, or group-level banding with no containing group at the target
 * depth).
 *
 * For `mode: "row"` the counter increments per data row (skipping styled
 * rows and group headers), preserving the historical behavior. For
 * `mode: "group"` the counter flips each time the ancestor group at the
 * chosen depth changes; every member row (data + group headers at or
 * below that depth) inherits the same index so the whole group reads as
 * a single band.
 */
export function computeBandIndexes(
  displayRows: readonly BandingDisplayRow[],
  banding: BandingSpec,
  groups: readonly Group[] | undefined,
  /**
   * When true, the first banded row/group receives the "odd" band (index 1),
   * producing a BABA pattern. When false, starts with index 0 (ABAB). Defaults
   * to true for group-mode (so the first group sits on a band and reads as
   * distinct from an un-banded section header above it) and false for row-mode
   * (matches the historical behavior).
   */
  startWithBand?: boolean,
): (0 | 1 | null)[] {
  const result: (0 | 1 | null)[] = new Array(displayRows.length).fill(null);
  if (banding.mode === "none" || displayRows.length === 0) return result;

  // Resolve default: BABA for group, ABAB for row.
  const withBand = startWithBand ?? banding.mode === "group";
  const offset = withBand ? 1 : 0;

  const isStyled = (dr: BandingDisplayRow): boolean => {
    if (dr.type !== "data") return false;
    const t = dr.row.style?.type;
    return t === "header" || t === "summary" || t === "spacer";
  };

  if (banding.mode === "row") {
    let counter = 0;
    for (let i = 0; i < displayRows.length; i++) {
      const dr = displayRows[i];
      if (dr.type !== "data" || isStyled(dr)) continue;
      result[i] = ((counter + offset) % 2) as 0 | 1;
      counter++;
    }
    return result;
  }

  // mode === "group"
  const depthCount = maxGroupDepth(groups);
  if (depthCount === 0) {
    // No groups: fall back to row-level banding for "group". Preserve the
    // caller's startWithBand choice so the fallback respects the toggle.
    return computeBandIndexes(
      displayRows,
      { mode: "row", level: null },
      groups,
      withBand,
    );
  }
  // Clamp the requested level into [1, depthCount]. `null` → deepest.
  const requested = banding.level ?? depthCount;
  const clamped = Math.min(Math.max(requested, 1), depthCount);
  const targetDepth = clamped - 1; // 0-based

  const groupMap = new Map<string, Group>();
  if (groups) for (const g of groups) groupMap.set(g.id, g);

  let counter = -1;
  let currentAncestor: string | null | undefined = undefined;

  for (let i = 0; i < displayRows.length; i++) {
    const dr = displayRows[i];
    let ancestorId: string | null = null;

    if (dr.type === "group_header") {
      // Resolve the Group from whichever field the caller's display row
      // carries (store uses `group`; svg-generator uses `groupId`).
      const g = dr.group ?? (dr.groupId ? groupMap.get(dr.groupId) : undefined);
      if (!g) {
        ancestorId = null;
      } else if (g.depth === targetDepth) {
        ancestorId = g.id;
      } else if (g.depth > targetDepth) {
        ancestorId = ancestorGroupIdAtDepth(g.parentId, targetDepth, groupMap);
      } else {
        // Header shallower than banding level — don't band it (new band will
        // start when we descend into a child at target depth).
        ancestorId = null;
      }
    } else {
      if (isStyled(dr)) {
        // Styled rows skip banding entirely (match row-mode behavior)
        result[i] = null;
        continue;
      }
      ancestorId = ancestorGroupIdAtDepth(dr.row.groupId, targetDepth, groupMap);
    }

    if (ancestorId === null) {
      result[i] = null;
      continue;
    }
    if (ancestorId !== currentAncestor) {
      counter++;
      currentAncestor = ancestorId;
    }
    result[i] = ((counter + offset) % 2) as 0 | 1;
  }

  return result;
}

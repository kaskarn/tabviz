// Axis slice — per-forest-column pan/zoom domain overrides + the per-context
// forest axis resolver (scale + limits + ticks, one per forest column).
//
// `forestAxes` is the per-context scale resolver: each forest column gets its
// own axis computed from its OWN data, options, width, and pan/zoom override.
// Previously a single global `axisComputation` + `xScale` (the first forest
// column's) was shared across every forest column — a DOM↔export divergence
// (export already resolves per-column) that this fixes. The `ForestScaleContext`
// the scales are built from carries a `groupId` seam: faceting (per-group
// domains/scale-types) extends this resolver without changing its consumers.
// See docs/dev/region-tree.md §5 + docs/dev/row-types.md §6.
//
// This reads `forestColumns` (columns slice / main) and the per-column flex
// widths (layout-zoom slice / main) via injected getters — a cross-slice
// `$derived` chain (see docs/dev/store-decomposition-idiom.md).
//
// Owns:
//   - axisZooms          per-column { domain: [lo, hi] } overrides
//   - forestAxes         $derived Map<colId, ResolvedForestAxis> (the resolver)
//   - primaryForestAxis  $derived first forest column's axis (single-value
//                        consumers: plot annotations, export clip bounds)
//
// Dependencies (injected):
//   - getSpec            for spec.theme.axis / spec.theme.plot / spec.data.rows
//   - getForestColumns   the forest columns to resolve (id + options)
//   - getFlexWidths      per-column resolved widths (layout.flexWidths)
//   - markSource         source-tags axis_zooms mutations

import type { WebSpec, ColumnSpec } from "$types";
import { computeAxis } from "$lib/axis-utils";
import {
  buildForestScale,
  type ForestScale,
  type ForestScaleType,
} from "$lib/layout/forest-scale";

/** Matches the shape produced by tabvizStore's `forestColumns` $derived
 *  — flat leaf-column entries with the original tree index. */
type ForestColumnEntry = {
  index: number;
  column: ColumnSpec;
};

/** A forest column's fully-resolved x-axis: the d3 scale plus the axis metadata
 *  it was built from. Produced per-column by the `forestAxes` resolver. */
export interface ResolvedForestAxis {
  /** d3 x-scale: data value → pixel x within the column's plot area. */
  scale: ForestScale;
  /** Axis line extent / clip bounds. */
  axisLimits: [number, number];
  /** Plot region (axisLimits + marker margin). */
  plotRegion: [number, number];
  /** Tick values within axisLimits. */
  ticks: number[];
}

export interface AxisSliceDeps {
  getSpec: () => WebSpec | null;
  getForestColumns: () => readonly ForestColumnEntry[];
  getFlexWidths: () => Record<string, number>;
  markSource: (field: string) => void;
}

export interface AxisSlice {
  readonly axisZooms: Record<string, { domain: [number, number] }>;
  /** Per-column resolved forest axis, keyed by column id. The per-context
   *  resolver — faceting extends each context with a non-null group later. */
  readonly forestAxes: ReadonlyMap<string, ResolvedForestAxis>;
  /** The primary (first) forest column's resolved axis. Back-stop for the
   *  single-value consumers — plot annotations + export clip bounds. */
  readonly primaryForestAxis: ResolvedForestAxis;

  setAxisZoom: (columnId: string, domain: [number, number]) => void;
  resetAxisZoom: (columnId: string) => void;
  getAxisZoom: (columnId: string) => { domain: [number, number] } | null;
  getEffectiveDomain: (columnId: string, defaultDomain: [number, number]) => [number, number];
  /** Wipe every per-column axis zoom. Called from setSpec / resetState. */
  reset: () => void;
}

/** Width used for a forest column before the layout has produced a flex width
 *  (first paint). Mirrors the renderers' forest fallback. */
const DEFAULT_FOREST_WIDTH = 200;

/** Resolved axis for the "no forest columns" case — never used for positioning
 *  (no forest ⇒ no marks/annotations), only as a non-null back-stop. */
const EMPTY_FOREST_AXIS: ResolvedForestAxis = {
  scale: buildForestScale({
    columnId: "",
    groupId: null,
    scaleType: "linear",
    domain: [0, 1],
    width: DEFAULT_FOREST_WIDTH,
  }),
  axisLimits: [0, 1],
  plotRegion: [0, 1],
  ticks: [0, 0.5, 1],
};

export function createAxisSlice(deps: AxisSliceDeps): AxisSlice {
  let axisZooms = $state<Record<string, { domain: [number, number] }>>({});

  // ── Per-context forest axis resolver ─────────────────────────────────────
  // One resolved axis per forest column, each from its OWN data / options /
  // width / pan-zoom override. Cross-slice $derived: reads forestColumns
  // (columns slice) and flex widths (layout-zoom slice) via injected getters.
  const forestAxes = $derived.by((): Map<string, ResolvedForestAxis> => {
    const map = new Map<string, ResolvedForestAxis>();
    const spec = deps.getSpec();
    if (!spec) return map;

    const flexWidths = deps.getFlexWidths();

    for (const { column } of deps.getForestColumns()) {
      const fo = column.options?.forest;
      const scaleType: ForestScaleType =
        (fo?.scale ?? "linear") === "log" ? "log" : "linear";
      const nullValue = fo?.nullValue ?? (scaleType === "log" ? 1 : 0);
      const width = flexWidths[column.id] ?? DEFAULT_FOREST_WIDTH;

      // Merge this column's axisRange / axisTicks overrides into the theme axis.
      const config = { ...spec.theme.axis };
      if (fo?.axisRange && Array.isArray(fo.axisRange) && fo.axisRange.length === 2) {
        config.rangeMin = fo.axisRange[0];
        config.rangeMax = fo.axisRange[1];
      }
      if (fo?.axisTicks && Array.isArray(fo.axisTicks)) {
        config.tickValues = fo.axisTicks;
      }

      const { axisLimits, plotRegion, ticks } = computeAxis({
        rows: spec.data.rows,
        config,
        scale: scaleType,
        nullValue,
        forestWidth: width,
        pointSize: spec.theme.plot.pointSize,
        effects: fo?.effects ?? [],
        pointCol: fo?.point ?? null,
        lowerCol: fo?.lower ?? null,
        upperCol: fo?.upper ?? null,
        domainOverride: axisZooms[column.id]?.domain ?? null,
      });

      // Mark scale domain = plotRegion (axisLimits + marker margin) — the
      // documented render domain, matching the V8/SVG export so the live widget
      // and the downloaded SVG agree pixel-for-pixel (WYSIWYG). A pan/zoom
      // override replaces it verbatim (no margin) so zoom feels continuous —
      // mirroring the export-from-DOM loop's `override ?? plotRegion`.
      const scale = buildForestScale({
        columnId: column.id,
        groupId: null,
        scaleType,
        domain: axisZooms[column.id]?.domain ?? plotRegion,
        width,
      });

      map.set(column.id, { scale, axisLimits, plotRegion, ticks });
    }

    return map;
  });

  const primaryForestAxis = $derived.by((): ResolvedForestAxis => {
    const firstId = deps.getForestColumns()[0]?.column.id;
    return (firstId !== undefined && forestAxes.get(firstId)) || EMPTY_FOREST_AXIS;
  });

  function setAxisZoom(columnId: string, domain: [number, number]): void {
    if (!Number.isFinite(domain[0]) || !Number.isFinite(domain[1])) return;
    if (domain[0] >= domain[1]) return;
    axisZooms = { ...axisZooms, [columnId]: { domain: [domain[0], domain[1]] } };
    deps.markSource("axis_zooms");
  }

  function resetAxisZoom(columnId: string): void {
    if (!(columnId in axisZooms)) return;
    const next = { ...axisZooms };
    delete next[columnId];
    axisZooms = next;
    deps.markSource("axis_zooms");
  }

  function getAxisZoom(columnId: string): { domain: [number, number] } | null {
    return axisZooms[columnId] ?? null;
  }

  function getEffectiveDomain(columnId: string, defaultDomain: [number, number]): [number, number] {
    return axisZooms[columnId]?.domain ?? defaultDomain;
  }

  function reset(): void {
    axisZooms = {};
  }

  return {
    get axisZooms() { return axisZooms; },
    get forestAxes() { return forestAxes; },
    get primaryForestAxis() { return primaryForestAxis; },
    setAxisZoom, resetAxisZoom, getAxisZoom, getEffectiveDomain,
    reset,
  };
}

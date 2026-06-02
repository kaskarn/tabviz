// Axis slice — per-forest-column pan/zoom domain overrides + the global
// axis computation + xScale.
//
// This is the cross-slice `$derived`-chain spike target per the C1 plan:
// `axisComputation` and `xScale` are `$derived` here, but they read the
// forest column's resolved plot width (`layout.flexWidths[forestId]`, a
// `$derived` owned by the layout-zoom slice) and `forestColumns` (a
// `$derived` owned by the columns slice) via injected getters. Reactivity
// propagation through forward-closure getters across slice boundaries is
// the open question from the source-tagging spike (see
// docs/dev/store-decomposition-idiom.md §"Risks remaining" line 167).
// If Svelte 5 tracks the read inside `deps.getForestPlotWidth()` correctly,
// the pattern composes for every remaining slice; if it doesn't, the
// idiom needs an amendment before tackling the long pole.
//
// The validation: change the forest column's flex width (e.g. via aspect
// slider) and observe that axisComputation.plotRegion updates. Already
// exercised by the visual battery (45 examples touch the aspect ladder);
// the spike here is moving the read site across a slice boundary without
// breaking that propagation.
//
// Owns:
//   - axisZooms          per-column { domain: [lo, hi] } overrides
//   - axisComputation    $derived global axis (limits + plotRegion + ticks)
//   - xScale             $derived d3 scale built from plotRegion + forestWidth
//
// Dependencies (injected):
//   - getSpec            for spec.theme.axis / spec.theme.plot / spec.data.rows
//   - getForestColumns   for the first forest column's options + id
//   - getForestPlotWidth   for the aspect-ladder Stage-1 width
//   - markSource         source-tags axis_zooms mutations

import type { WebSpec, ColumnSpec } from "$types";
import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from "d3-scale";
import { computeAxis, type AxisComputation, VIZ_MARGIN } from "$lib/axis-utils";

/** Matches the shape produced by tabvizStore's `forestColumns` $derived
 *  — flat leaf-column entries with the original tree index. */
type ForestColumnEntry = {
  index: number;
  column: ColumnSpec;
};

export interface AxisSliceDeps {
  getSpec: () => WebSpec | null;
  getForestColumns: () => readonly ForestColumnEntry[];
  getForestPlotWidth: () => number;
  markSource: (field: string) => void;
}

export interface AxisSlice {
  readonly axisZooms: Record<string, { domain: [number, number] }>;
  readonly axisComputation: AxisComputation;
  readonly xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;

  setAxisZoom: (columnId: string, domain: [number, number]) => void;
  resetAxisZoom: (columnId: string) => void;
  getAxisZoom: (columnId: string) => { domain: [number, number] } | null;
  getEffectiveDomain: (columnId: string, defaultDomain: [number, number]) => [number, number];
  /** Wipe every per-column axis zoom. Called from setSpec / resetState. */
  reset: () => void;
}

export function createAxisSlice(deps: AxisSliceDeps): AxisSlice {
  let axisZooms = $state<Record<string, { domain: [number, number] }>>({});

  // CROSS-SLICE $DERIVED — reads forestColumns (columns slice / main) and
  // the forest column's resolved flex width (layout-zoom slice / main) via
  // injected getters.
  const axisComputation = $derived.by((): AxisComputation => {
    const spec = deps.getSpec();
    if (!spec) {
      return { axisLimits: [0, 1], plotRegion: [0, 1], ticks: [0, 0.5, 1] };
    }

    const forestColumns = deps.getForestColumns();
    const firstForest = forestColumns[0]?.column;
    const hasForest = forestColumns.length > 0;

    // Read the forest column's resolved plot width from the layout so the
    // aspect-ladder flex-absorption result propagates here. Routes through
    // deps.getForestPlotWidth() (= layout.flexWidths[forestId]).
    // Reactivity tracking is the spike — the dep-call site has to
    // establish the same $derived edge as a direct read.
    const forestWidth = hasForest ? deps.getForestPlotWidth() : 0;

    const forestOptions = firstForest?.options?.forest;
    const scale = forestOptions?.scale ?? "linear";
    const nullValue = forestOptions?.nullValue ?? (scale === "log" ? 1 : 0);
    const effects = forestOptions?.effects ?? [];
    const pointCol = forestOptions?.point ?? null;
    const lowerCol = forestOptions?.lower ?? null;
    const upperCol = forestOptions?.upper ?? null;

    // Merge forest column axis overrides into theme config
    const axisConfig = { ...spec.theme.axis };
    if (forestOptions?.axisRange && Array.isArray(forestOptions.axisRange) && forestOptions.axisRange.length === 2) {
      axisConfig.rangeMin = forestOptions.axisRange[0];
      axisConfig.rangeMax = forestOptions.axisRange[1];
    }
    if (forestOptions?.axisTicks && Array.isArray(forestOptions.axisTicks)) {
      axisConfig.tickValues = forestOptions.axisTicks;
    }

    // Honor first forest column's pan/zoom override for the global scale.
    // Per-column viz components consult axisZooms directly for their own axes.
    const firstForestId = firstForest?.id;
    const domainOverride = firstForestId ? axisZooms[firstForestId]?.domain ?? null : null;

    return computeAxis({
      rows: spec.data.rows,
      config: axisConfig,
      scale,
      nullValue,
      forestWidth,
      pointSize: spec.theme.plot.pointSize,
      effects,
      pointCol,
      lowerCol,
      upperCol,
      domainOverride,
    });
  });

  const xScale = $derived.by(() => {
    const spec = deps.getSpec();
    if (!spec) return scaleLinear().domain([0, 1]).range([0, 100]);

    const forestColumns = deps.getForestColumns();
    const firstForest = forestColumns[0]?.column;
    const forestOptions = firstForest?.options?.forest;
    const isLog = (forestOptions?.scale ?? "linear") === "log";
    const { plotRegion } = axisComputation;

    const hasForest = forestColumns.length > 0;
    const forestWidth = hasForest ? deps.getForestPlotWidth() : 0;

    const rangeStart = VIZ_MARGIN;
    const rangeEnd = Math.max(forestWidth - VIZ_MARGIN, rangeStart + 50);

    if (isLog) {
      const safeDomain: [number, number] = [
        Math.max(plotRegion[0], 0.01),
        Math.max(plotRegion[1], 0.02),
      ];
      return scaleLog().domain(safeDomain).range([rangeStart, rangeEnd]);
    }

    return scaleLinear().domain(plotRegion).range([rangeStart, rangeEnd]);
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
    get axisComputation() { return axisComputation; },
    get xScale() { return xScale; },
    setAxisZoom, resetAxisZoom, getAxisZoom, getEffectiveDomain,
    reset,
  };
}

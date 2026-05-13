// Forest-column option state, extracted from ColumnEditorPopover.svelte
// as the first piece of Phase 0c-C3 (idiom (c) per Q8 spike).
//
// Each per-column-type option block gets its own slice:
//   - forest-options.svelte.ts   (this file)
//   - viz-options.svelte.ts      (viz_bar / viz_boxplot / viz_violin)
//   - bar-options.svelte.ts      (col_bar inline-bar)
//   - sparkline-options.svelte.ts
//   - ...and ~10 more for the smaller types
//
// Each slice returns a typed interface so the parent component reads
// state via `slice.<name>` and writes via `slice.<name> = ...` (the
// getters/setters preserve $state reactivity through the slice
// boundary).

import type { ColumnSpec } from "$types";

export type ForestScale = "linear" | "log";

export interface ForestOptionsSlice {
  scale: ForestScale;
  nullValue: string;
  axisLabel: string;
  showAxis: boolean;
  axisGridlines: boolean;
  axisRangeMin: string;
  axisRangeMax: string;
  axisTicks: string; // comma-separated
  /** Reset all forest-option state to its initial values. */
  reset(): void;
  /** Hydrate from an existing ColumnSpec.options.forest bundle. */
  hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
  /**
   * Build the `options.forest` field for a ColumnSpec. Caller supplies
   * the slot values (point/lower/upper), which live on the parent form.
   */
  buildOptions(args: {
    point: string;
    lower: string;
    upper: string;
  }): NonNullable<NonNullable<ColumnSpec["options"]>["forest"]>;
}

export function createForestOptionsSlice(): ForestOptionsSlice {
  let scale = $state<ForestScale>("linear");
  let nullValue = $state<string>("");
  let axisLabel = $state<string>("");
  let showAxis = $state<boolean>(true);
  let axisGridlines = $state<boolean>(false);
  let axisRangeMin = $state<string>("");
  let axisRangeMax = $state<string>("");
  let axisTicks = $state<string>("");

  function reset(): void {
    scale = "linear";
    nullValue = "";
    axisLabel = "";
    showAxis = true;
    axisGridlines = false;
    axisRangeMin = "";
    axisRangeMax = "";
    axisTicks = "";
  }

  function hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void {
    if (o.forest?.scale) scale = o.forest.scale;
    if (o.forest?.nullValue != null) nullValue = String(o.forest.nullValue);
    if (o.forest?.axisLabel != null) axisLabel = o.forest.axisLabel;
    if (o.forest?.showAxis != null) showAxis = !!o.forest.showAxis;
    if (o.forest?.axisGridlines != null) axisGridlines = !!o.forest.axisGridlines;
    if (o.forest?.axisRange && Array.isArray(o.forest.axisRange) && o.forest.axisRange.length === 2) {
      axisRangeMin = String(o.forest.axisRange[0]);
      axisRangeMax = String(o.forest.axisRange[1]);
    }
    if (o.forest?.axisTicks && Array.isArray(o.forest.axisTicks)) {
      axisTicks = o.forest.axisTicks.join(", ");
    }
  }

  function buildOptions(args: {
    point: string;
    lower: string;
    upper: string;
  }): NonNullable<NonNullable<ColumnSpec["options"]>["forest"]> {
    const forest: NonNullable<NonNullable<ColumnSpec["options"]>["forest"]> = {
      point: args.point,
      lower: args.lower,
      upper: args.upper,
      scale,
      nullValue: nullValue !== "" ? Number(nullValue) : (scale === "log" ? 1 : 0),
      axisLabel,
      showAxis,
    };
    if (axisGridlines) forest.axisGridlines = true;
    const rMin = axisRangeMin !== "" ? Number(axisRangeMin) : null;
    const rMax = axisRangeMax !== "" ? Number(axisRangeMax) : null;
    if (rMin != null && rMax != null && Number.isFinite(rMin) && Number.isFinite(rMax)) {
      forest.axisRange = [rMin, rMax];
    }
    if (axisTicks.trim() !== "") {
      const ticks = axisTicks
        .split(/[,\s]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
      if (ticks.length > 0) forest.axisTicks = ticks;
    }
    return forest;
  }

  return {
    get scale() { return scale; },
    set scale(v) { scale = v; },
    get nullValue() { return nullValue; },
    set nullValue(v) { nullValue = v; },
    get axisLabel() { return axisLabel; },
    set axisLabel(v) { axisLabel = v; },
    get showAxis() { return showAxis; },
    set showAxis(v) { showAxis = v; },
    get axisGridlines() { return axisGridlines; },
    set axisGridlines(v) { axisGridlines = v; },
    get axisRangeMin() { return axisRangeMin; },
    set axisRangeMin(v) { axisRangeMin = v; },
    get axisRangeMax() { return axisRangeMax; },
    set axisRangeMax(v) { axisRangeMax = v; },
    get axisTicks() { return axisTicks; },
    set axisTicks(v) { axisTicks = v; },
    reset,
    hydrateFromSpec,
    buildOptions,
  };
}

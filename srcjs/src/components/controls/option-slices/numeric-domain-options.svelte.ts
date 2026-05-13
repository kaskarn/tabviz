// Shared state for column types whose options reduce to "max value plus
// scale": bar, progress, heatmap. Extracted from ColumnEditorPopover as
// part of Phase 0c-C3.

import type { ColumnSpec } from "$types";

export type NumericDomainScale = "linear" | "log" | "sqrt";
export type NumericDomainColumnType = "bar" | "progress" | "heatmap";

export interface NumericDomainOptionsSlice {
  maxValue: string;
  scale: NumericDomainScale;
  reset(): void;
  /**
   * Hydrate state from an existing spec's options. The caller passes the
   * column type so the slice reads the right options sub-bundle
   * (options.bar / options.progress / options.heatmap).
   */
  hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>, type: NumericDomainColumnType): void;
  /**
   * Build the appropriate options sub-bundle. Caller specifies which
   * type; the slice writes maxValue (if set) and scale (if non-default).
   */
  buildOptions(type: NumericDomainColumnType):
    | NonNullable<NonNullable<ColumnSpec["options"]>["bar"]>
    | NonNullable<NonNullable<ColumnSpec["options"]>["progress"]>
    | NonNullable<NonNullable<ColumnSpec["options"]>["heatmap"]>;
}

export function createNumericDomainOptionsSlice(): NumericDomainOptionsSlice {
  let maxValue = $state<string>("");
  let scale = $state<NumericDomainScale>("linear");

  function reset(): void {
    maxValue = "";
    scale = "linear";
  }

  function hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>, type: NumericDomainColumnType): void {
    if (type === "bar") {
      if (o.bar?.maxValue != null) maxValue = String(o.bar.maxValue);
      if (o.bar?.scale) scale = o.bar.scale as NumericDomainScale;
    } else if (type === "progress") {
      if (o.progress?.maxValue != null) maxValue = String(o.progress.maxValue);
      if (o.progress?.scale) scale = o.progress.scale as NumericDomainScale;
    } else if (type === "heatmap") {
      // heatmap doesn't have a maxValue field in the spec; only scale.
      if (o.heatmap?.scale) scale = o.heatmap.scale as NumericDomainScale;
    }
  }

  function buildOptions(type: NumericDomainColumnType) {
    const bundle: Record<string, unknown> = {};
    if (type !== "heatmap" && maxValue !== "") bundle.maxValue = Number(maxValue);
    if (scale !== "linear") bundle.scale = scale;
    return bundle as ReturnType<NumericDomainOptionsSlice["buildOptions"]>;
  }

  return {
    get maxValue() { return maxValue; },
    set maxValue(v) { maxValue = v; },
    get scale() { return scale; },
    set scale(v) { scale = v; },
    reset,
    hydrateFromSpec,
    buildOptions,
  };
}

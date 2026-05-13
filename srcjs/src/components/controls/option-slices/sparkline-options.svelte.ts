// Sparkline-column option state, extracted from ColumnEditorPopover.svelte
// as part of Phase 0c-C3.

import type { ColumnSpec } from "$types";

export type SparklineChartType = "line" | "bar" | "area";

export interface SparklineOptionsSlice {
  chartType: SparklineChartType;
  reset(): void;
  hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
  buildOptions(): { type: SparklineChartType };
}

export function createSparklineOptionsSlice(): SparklineOptionsSlice {
  let chartType = $state<SparklineChartType>("line");

  return {
    get chartType() { return chartType; },
    set chartType(v) { chartType = v; },
    reset(): void {
      chartType = "line";
    },
    hydrateFromSpec(o): void {
      if (o.sparkline?.type) chartType = o.sparkline.type;
    },
    buildOptions(): { type: SparklineChartType } {
      return { type: chartType };
    },
  };
}

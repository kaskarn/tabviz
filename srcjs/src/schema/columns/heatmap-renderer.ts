// Heatmap cell renderer (schema-sprint Phase 4c.2) — DOM half.
//
// Mounts CellHeatmap.svelte (browser only). The SVG half lives in
// heatmap-svg-renderer.ts (V8-safe — boot-split note there).

import type { ColumnOptions } from "../../types";
import type { RenderComponent, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";
import CellHeatmap from "../../components/table/CellHeatmap.svelte";
import { heatmapSvgRenderer, __svgTesting } from "./heatmap-svg-renderer";

interface HeatmapOptions {
  palette?: string[];
  decimals?: number;
  showValue?: boolean;
  scale?: "linear" | "log" | "sqrt";
  minValue?: number;
  maxValue?: number;
}

const heatmapDomRenderer: CellFormatter = (value, options, ctx): RenderComponent => {
  const opts = (options as ColumnOptions | undefined)?.heatmap as HeatmapOptions | undefined;
  const minValue = opts?.minValue ?? ctx?.columnSummary?.min ?? 0;
  const maxValue = opts?.maxValue ?? ctx?.columnSummary?.max ?? 1;
  return {
    kind: "component",
    name: "CellHeatmap",
    props: {
      value: value as number,
      options: opts,
      minValue,
      maxValue,
      naText: ctx?.naText ?? undefined,
      theme: ctx?.theme,
    },
  };
};

/** Idempotent re-register helper. */
export function registerHeatmapRenderer(): void {
  registerCellComponent("CellHeatmap", CellHeatmap as never);
  registerRenderers("heatmap", { dom: heatmapDomRenderer, svg: heatmapSvgRenderer });
}

registerHeatmapRenderer();

export const __testing = { parseHex: __svgTesting.parseHex, defaultPalette: __svgTesting.defaultPalette, interpolatePalette: __svgTesting.interpolatePalette };

// Bar cell renderer (schema-sprint Phase 4c.1) — DOM half.
//
// Mounts CellBar.svelte (browser only). The SVG half lives in
// bar-svg-renderer.ts (V8-safe — see the boot-split note there); this
// module re-registers it so the browser boot keeps one entry point.

import type { ColumnOptions } from "../../types";
import type { RenderComponent, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";
import CellBar from "../../components/table/CellBar.svelte";
import { barSvgRenderer, __svgTesting } from "./bar-svg-renderer";

interface BarOptions {
  maxValue?: number;
  color?: string;
  showLabel?: boolean;
  scale?: "linear" | "log" | "sqrt";
}

const barDomRenderer: CellFormatter = (value, options, ctx): RenderComponent => {
  const opts = (options as ColumnOptions | undefined)?.bar as BarOptions | undefined;
  // Resolve maxValue: explicit pin > ctx.columnSummary.max > legacy 100 fallback.
  const maxValue = opts?.maxValue ?? ctx?.columnSummary?.max ?? 100;
  return {
    kind: "component",
    name: "CellBar",
    props: {
      value: value as number,
      maxValue,
      options: opts,
      naText: ctx?.naText ?? undefined,
      colorOverride: ctx?.colorOverride ?? null,
    },
  };
};

/** Idempotent re-register helper. */
export function registerBarRenderer(): void {
  registerCellComponent("CellBar", CellBar as never);
  registerRenderers("bar", { dom: barDomRenderer, svg: barSvgRenderer });
}

registerBarRenderer();

export const __testing = { resolveBarColor: __svgTesting.resolveBarColor, formatBarValue: __svgTesting.formatBarValue };

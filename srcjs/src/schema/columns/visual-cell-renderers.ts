// Visual-cell renderers — schemas whose browser path mounts an
// existing Svelte cell component (CellPvalue, CellBadge, CellIcon,
// CellStars, CellSparkline, CellRing, CellImg, CellProgress,
// CellReference, CellRange).
//
// Each renderer returns a `RenderComponent` node pointing at the
// already-built component; the browser mounter looks it up in the
// cell-component registry and instantiates it with its existing
// prop surface. Zero rewrite of any component.
//
// `svg` renderers are registered per cell as schema-sprint Phase 4
// closes the SVG coverage gap. Phase 4a covers cells whose entire
// SVG output is text (pvalue, reference, range, img) — they emit
// RenderText trees identical to what svg-generator's `getCellValue`
// produces. Once Phase 4b lands the visual cells (badge, icon, stars,
// ring, pictogram, progress, sparkline) and Phase 4c handles
// bar/heatmap aggregate context, the legacy per-type drawing
// branches in svg-generator.ts can be deleted.
//
// `bar` and `heatmap` are deliberately omitted — they need a
// per-column aggregate (max value across visible rows) that doesn't
// fit the per-cell ctx shape. They stay on the legacy TabvizPlot
// branches until Phase 4c lands the aggregate behavior + bank entry.

import type { RenderComponent, RenderText, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";
import { formatPvalue, truncateString } from "../../lib/formatters";
import type { ColumnOptions } from "../../types";

import CellPvalue    from "../../components/table/CellPvalue.svelte";
import CellBadge     from "../../components/table/CellBadge.svelte";
import CellIcon      from "../../components/table/CellIcon.svelte";
import CellStars     from "../../components/table/CellStars.svelte";
import CellSparkline from "../../components/table/CellSparkline.svelte";
import CellRing      from "../../components/table/CellRing.svelte";
import CellImg       from "../../components/table/CellImg.svelte";
import CellProgress  from "../../components/table/CellProgress.svelte";
import CellReference from "../../components/table/CellReference.svelte";
import CellRange     from "../../components/table/CellRange.svelte";

type AnyOpts = Record<string, unknown> | undefined;

// Helper: build a RenderComponent with the props every cell shares.
function component(
  name: string,
  props: Record<string, unknown>,
): RenderComponent {
  return { kind: "component", name, props };
}

// Helper: bare RenderText for the SVG-side text-only renderers.
function text(value: string): RenderText {
  return { kind: "text", value };
}

// ────────────────────────────────────────────────────────────────────
// Renderers
// ────────────────────────────────────────────────────────────────────

const pvalueRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellPvalue", {
    value: value as number | null | undefined,
    options: opts?.pvalue,
    naText: ctx?.naText ?? undefined,
    cellStyle: ctx?.cellStyle,
  });
};

const badgeRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellBadge", {
    value,
    options: opts?.badge,
    naText: ctx?.naText ?? undefined,
    cellStyle: ctx?.cellStyle,
    colorOverride: ctx?.colorOverride ?? null,
  });
};

const iconRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellIcon", {
    value,
    options: opts?.icon,
    naText: ctx?.naText ?? undefined,
  });
};

const starsRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellStars", {
    value: value as number,
    options: opts?.stars,
    naText: ctx?.naText ?? undefined,
  });
};

const sparklineRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellSparkline", {
    data: value as number[],
    options: opts?.sparkline,
    naText: ctx?.naText ?? undefined,
    colorOverride: ctx?.colorOverride ?? null,
  });
};

const ringRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellRing", {
    value: value as number,
    options: opts?.ring,
    naText: ctx?.naText ?? undefined,
    cellStyle: ctx?.cellStyle,
    colorOverride: ctx?.colorOverride ?? null,
  });
};

const imgRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellImg", {
    value: value as string,
    options: opts?.img,
    naText: ctx?.naText ?? undefined,
  });
};

const progressRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellProgress", {
    value: value as number,
    options: opts?.progress,
    naText: ctx?.naText ?? undefined,
    colorOverride: ctx?.colorOverride ?? null,
  });
};

const referenceRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellReference", {
    value: value as string,
    metadata: (ctx?.row ?? {}) as Record<string, unknown>,
    options: opts?.reference,
    naText: ctx?.naText ?? undefined,
  });
};

const rangeRenderer: CellFormatter = (value, options, ctx) => {
  const opts = options as AnyOpts;
  return component("CellRange", {
    value,
    metadata: (ctx?.row ?? {}) as Record<string, unknown>,
    options: opts?.range,
    naText: ctx?.naText ?? undefined,
  });
};

// ────────────────────────────────────────────────────────────────────
// SVG-side renderers (Phase 4a)
// ────────────────────────────────────────────────────────────────────
//
// These produce RenderText trees mirroring `svg-generator.ts::getCellValue`
// for the cells whose SVG output IS just text. The dispatch in
// svg-generator's render loop catches these and `continue`s past the
// legacy per-type fallback branches. Phase 4b/c/d migrates the rest.

const pvalueSvgRenderer: CellFormatter = (value, options, ctx) => {
  const v = value as number | null | undefined;
  if (typeof v !== "number") return text(ctx?.naText ?? "");
  return text(formatPvalue(v, options as ColumnOptions));
};

const referenceSvgRenderer: CellFormatter = (value, options, ctx) => {
  if (value === undefined || value === null) return text("");
  const opts = options as AnyOpts;
  const refOpts = opts?.reference as { maxChars?: number } | undefined;
  const maxChars = refOpts?.maxChars ?? 30;
  const str = String(value);
  return text(truncateString(str, maxChars));
  void ctx;
};

const rangeSvgRenderer: CellFormatter = (_value, options, ctx) => {
  const opts = options as AnyOpts;
  const rangeOpts = opts?.range as
    | { minField: string; maxField: string; separator?: string; decimals?: number | null }
    | undefined;
  if (!rangeOpts) return text("");
  const meta = (ctx?.row ?? {}) as Record<string, unknown>;
  const minVal = meta[rangeOpts.minField];
  const maxVal = meta[rangeOpts.maxField];
  const sep = rangeOpts.separator ?? " – ";
  const decimals = rangeOpts.decimals;
  const fmt = (v: unknown): string => {
    if (typeof v !== "number") return "";
    if (decimals === null || decimals === undefined) {
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
    }
    return v.toFixed(decimals);
  };
  if (minVal === null && maxVal === null) return text("");
  if (minVal === null) return text(fmt(maxVal));
  if (maxVal === null) return text(fmt(minVal));
  return text(`${fmt(minVal)}${sep}${fmt(maxVal)}`);
};

const imgSvgRenderer: CellFormatter = (_value, options, _ctx) => {
  // Images cannot embed in static SVG export — emit the fallback
  // placeholder text the legacy path produces.
  const opts = options as AnyOpts;
  const imgOpts = opts?.img as { fallback?: string } | undefined;
  return text(imgOpts?.fallback ?? "[IMG]");
};

/** Idempotent re-register helper for tests after registry reset. */
export function registerVisualCellRenderers(): void {
  // Register components in the mounter's registry.
  registerCellComponent("CellPvalue",    CellPvalue    as never);
  registerCellComponent("CellBadge",     CellBadge     as never);
  registerCellComponent("CellIcon",      CellIcon      as never);
  registerCellComponent("CellStars",     CellStars     as never);
  registerCellComponent("CellSparkline", CellSparkline as never);
  registerCellComponent("CellRing",      CellRing      as never);
  registerCellComponent("CellImg",       CellImg       as never);
  registerCellComponent("CellProgress",  CellProgress  as never);
  registerCellComponent("CellReference", CellReference as never);
  registerCellComponent("CellRange",     CellRange     as never);

  // Dispatch wiring. DOM renderers mount Svelte components; SVG
  // renderers emit RenderText for the text-only cells (Phase 4a).
  // Phase 4b/c/d add SVG renderers for the visual + aggregate +
  // viz-subtype cells.
  registerRenderers("pvalue",    { dom: pvalueRenderer,    svg: pvalueSvgRenderer });
  registerRenderers("badge",     { dom: badgeRenderer });
  registerRenderers("icon",      { dom: iconRenderer });
  registerRenderers("stars",     { dom: starsRenderer });
  registerRenderers("sparkline", { dom: sparklineRenderer });
  registerRenderers("ring",      { dom: ringRenderer });
  registerRenderers("img",       { dom: imgRenderer,       svg: imgSvgRenderer });
  registerRenderers("progress",  { dom: progressRenderer });
  registerRenderers("reference", { dom: referenceRenderer, svg: referenceSvgRenderer });
  registerRenderers("range",     { dom: rangeRenderer,     svg: rangeSvgRenderer });
}

// Side-effect: register on first import.
registerVisualCellRenderers();

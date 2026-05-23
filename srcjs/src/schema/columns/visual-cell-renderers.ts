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
// `svg` slot is NOT registered for any of these — svg-generator
// still owns SVG export. Phase 7e.4b will wire the svg slot for
// schemas where it makes sense (or fold an extracted markup
// generator into a future commit per schema).
//
// `bar` and `heatmap` are deliberately omitted — they need a
// per-column aggregate (max value across visible rows) that doesn't
// fit the per-cell ctx shape. They stay on the legacy TabvizPlot
// branches until a column-level lifecycle hook lands.

import type { RenderComponent, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";

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

  // Dispatch wiring.
  registerRenderers("pvalue",    { dom: pvalueRenderer });
  registerRenderers("badge",     { dom: badgeRenderer });
  registerRenderers("icon",      { dom: iconRenderer });
  registerRenderers("stars",     { dom: starsRenderer });
  registerRenderers("sparkline", { dom: sparklineRenderer });
  registerRenderers("ring",      { dom: ringRenderer });
  registerRenderers("img",       { dom: imgRenderer });
  registerRenderers("progress",  { dom: progressRenderer });
  registerRenderers("reference", { dom: referenceRenderer });
  registerRenderers("range",     { dom: rangeRenderer });
}

// Side-effect: register on first import.
registerVisualCellRenderers();

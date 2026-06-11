// SVG-side renderers for the text-only visual cells (pvalue / reference /
// range / img). Extracted from visual-cell-renderers.ts (area C,
// 2026-06-11): that module imports the Svelte DOM components, so the V8
// export boot (`schema/init.ts::bootBuiltinBehaviors`) could not load it —
// and these four types silently fell to the legacy text branch in EVERY
// headless export. The visible casualty: `col_pvalue(stars = TRUE)`
// rendered stars in the DOM but never in save_plot output (found when the
// nejm house style made pvalue stars a preset default).
//
// This module is PURE (no DOM, no Svelte) and is registered from BOTH
// boots: init.ts (V8/export) and init-dom.ts via visual-cell-renderers
// (browser — registerRenderers merges per-target, so double registration
// of the svg half is idempotent).

import type { RenderText, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { formatPvalue, truncateString } from "../../lib/formatters";
import type { ColumnOptions } from "../../types";

type AnyOpts = Record<string, unknown> | undefined;

function text(value: string): RenderText {
  return { kind: "text", value };
}

export const pvalueSvgRenderer: CellFormatter = (value, options, ctx) => {
  const v = value as number | null | undefined;
  if (typeof v !== "number") return text(ctx?.naText ?? "");
  return text(formatPvalue(v, options as ColumnOptions));
};

export const referenceSvgRenderer: CellFormatter = (value, options, ctx) => {
  if (value === undefined || value === null) return text("");
  const opts = options as AnyOpts;
  const refOpts = opts?.reference as { maxChars?: number } | undefined;
  const maxChars = refOpts?.maxChars ?? 30;
  const str = String(value);
  return text(truncateString(str, maxChars));
  void ctx;
};

export const rangeSvgRenderer: CellFormatter = (_value, options, ctx) => {
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

export const imgSvgRenderer: CellFormatter = (_value, options, _ctx) => {
  // Images cannot embed in static SVG export — emit the fallback
  // placeholder text the legacy path produces.
  const opts = options as AnyOpts;
  const imgOpts = opts?.img as { fallback?: string } | undefined;
  return text(imgOpts?.fallback ?? "[IMG]");
};

/** Register the SVG halves. Safe under every runtime; idempotent. */
export function registerVisualSvgRenderers(): void {
  registerRenderers("pvalue",    { svg: pvalueSvgRenderer });
  registerRenderers("reference", { svg: referenceSvgRenderer });
  registerRenderers("range",     { svg: rangeSvgRenderer });
  registerRenderers("img",       { svg: imgSvgRenderer });
}

// Side-effect: register on first import.
registerVisualSvgRenderers();

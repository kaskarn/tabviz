// theme-cascade.ts — pure cascade logic extracted from ThemeControl.svelte.
//
// Each `apply*` function takes a `CascadeCtx` (the bound store
// accessors + a snapshot of theme/inputs read state) and a hex value,
// and writes the input + every derived field one cascade step. Mirrors
// R-side `resolve_*` rules in R/utils-theme-resolve.R. Keeping these
// pure (no Svelte runes, no DOM) makes them unit-testable and lets the
// component shrink to a pure UI dispatcher.
//
// Rationalization gain: ~180 LOC of cascade work moves out of the
// component so the Svelte file can focus on layout + wiring.

import type { WebTheme, ResolvedInputs as ThemeInputs } from "$types";
import { oklchDarken, oklchMix, oklchChroma } from "$lib/oklch";

export type ThemePath = (string | number)[];

/** Bound store accessors + a snapshot of the read state. The component
 *  rebuilds this on every render so the cascade functions always read
 *  the latest values. */
export interface CascadeCtx {
  setPath: (path: ThemePath, value: unknown) => void;
  setDerived: (path: ThemePath, value: unknown) => void;
  clearOver: (path: ThemePath) => void;
  isOver: (path: ThemePath) => boolean;
  theme: WebTheme | undefined;
  inputs: ThemeInputs | undefined;
}

// ── Read helpers ─────────────────────────────────────────────────────

const D_PRIMARY      = "#0891B2";
const D_NEUTRAL3     = "#cbd5e1";
const D_SURFACE_BASE = "#ffffff";
const D_INVERSE      = "#ffffff";

export function currentPrimary(ctx: CascadeCtx): string {
  return (ctx.inputs?.primary as string | undefined) ?? D_PRIMARY;
}
export function currentPrimaryDeep(ctx: CascadeCtx): string {
  return (ctx.inputs?.primaryDeep as string | undefined)
    ?? oklchDarken(currentPrimary(ctx), 0.15);
}
export function currentSecondary(ctx: CascadeCtx): string {
  return (ctx.inputs?.secondary as string | undefined) ?? currentPrimary(ctx);
}
export function currentSecondaryDeep(ctx: CascadeCtx): string {
  return (ctx.inputs?.secondaryDeep as string | undefined)
    ?? (ctx.isOver(["inputs", "secondary"])
      ? oklchDarken(currentSecondary(ctx), 0.15)
      : currentPrimaryDeep(ctx));
}

function neutralBaseline(ctx: CascadeCtx): string {
  const n = ctx.inputs?.neutral as string[] | undefined;
  return n?.[2] ?? D_NEUTRAL3;
}
function surfaceBaseline(ctx: CascadeCtx): string {
  return ctx.theme?.surface?.base ?? D_SURFACE_BASE;
}
function contentInverseBaseline(ctx: CascadeCtx): string {
  return ctx.theme?.content?.inverse ?? D_INVERSE;
}
function lightestNeutral(ctx: CascadeCtx): string {
  return (ctx.theme?.surface as { raised?: string } | undefined)?.raised ?? D_SURFACE_BASE;
}

// ── Secondary-tinted chrome surfaces ─────────────────────────────────
// Chrome (surface.muted, dividers, alt-row banding) lives on secondary
// post-2026-04-29.
function chromeTintedSubtleDivider(ctx: CascadeCtx, seed: string): string {
  return oklchMix(neutralBaseline(ctx), seed, 0.10);
}
function chromeTintedSurfaceMuted(ctx: CascadeCtx, seed: string): string {
  return oklchMix(neutralBaseline(ctx), seed, 0.04);
}
function chromeTintedAltSurface(ctx: CascadeCtx, seed: string): string {
  return oklchMix(surfaceBaseline(ctx), chromeTintedSurfaceMuted(ctx, seed), 0.5);
}
function chromeTintedStrongDivider(ctx: CascadeCtx, seed: string): string {
  return oklchMix(neutralBaseline(ctx), seed, 0.05);
}
function l1MixStrength(ctx: CascadeCtx): number {
  return ctx.theme?.variants?.headerStyle === "light" ? 0.16 : 0.24;
}
function secondaryTintedL1Bg(ctx: CascadeCtx, seed: string): string {
  return oklchMix(surfaceBaseline(ctx), seed, l1MixStrength(ctx));
}
function boldBandRule(ctx: CascadeCtx, bg: string): string {
  return oklchMix(contentInverseBaseline(ctx), bg, 0.40);
}

// ── Engagement (accent) helpers ──────────────────────────────────────
function accentMutedHex(ctx: CascadeCtx, accent: string): string {
  return oklchMix(accent, surfaceBaseline(ctx), 0.88);
}
function semanticFilledTintHex(ctx: CascadeCtx, accent: string): string {
  return oklchMix(accent, lightestNeutral(ctx), 0.80);
}
function accentTintSubtleHex(ctx: CascadeCtx, accent: string): string {
  return oklchMix(accent, surfaceBaseline(ctx), 0.90);
}
function accentTintMediumHex(ctx: CascadeCtx, accent: string): string {
  return oklchMix(accent, surfaceBaseline(ctx), 0.75);
}

// ── Per-anchor SlotRole derivation ─────────────────────────────────
function currentSlotStyle(ctx: CascadeCtx): "fill_with_darker_stroke" | "flat_fill" | "outlined" {
  return ctx.inputs?.slotStyle ?? "fill_with_darker_stroke";
}
function deriveSlotRole(ctx: CascadeCtx, anchor: string) {
  const surface = surfaceBaseline(ctx);
  const fillDim = oklchMix(anchor, surface, 0.65);
  const style = currentSlotStyle(ctx);
  if (style === "flat_fill") {
    const hot = oklchChroma(oklchDarken(anchor, 0.05), 0.04);
    return {
      fill: anchor, stroke: anchor, fillDim, strokeDim: fillDim,
      fillHot: hot, strokeHot: hot,
    };
  }
  if (style === "outlined") {
    return {
      fill: oklchMix(anchor, surface, 0.15),
      stroke: anchor,
      fillDim: oklchMix(anchor, surface, 0.08),
      strokeDim: oklchDarken(fillDim, 0.10),
      fillHot: oklchMix(anchor, surface, 0.30),
      strokeHot: oklchDarken(anchor, 0.20),
    };
  }
  return {
    fill: anchor, stroke: oklchDarken(anchor, 0.10),
    fillDim, strokeDim: oklchDarken(fillDim, 0.10),
    fillHot: oklchChroma(oklchDarken(anchor, 0.05), 0.04),
    strokeHot: oklchDarken(anchor, 0.20),
  };
}

// ── Primary cascade ──────────────────────────────────────────────────
export function applyPrimary(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["inputs", "primary"], hex);
  const primaryDeep = ctx.isOver(["inputs", "primaryDeep"])
    ? ((ctx.inputs?.primaryDeep as string | undefined) ?? oklchDarken(hex, 0.15))
    : oklchDarken(hex, 0.15);
  ctx.setDerived(["inputs", "primaryDeep"], primaryDeep);
  cascadePrimary(ctx, hex);
  cascadePrimaryDeep(ctx, primaryDeep);
  if (!ctx.isOver(["inputs", "secondary"])) {
    ctx.setDerived(["inputs", "secondary"], hex);
    const secondaryDeep = ctx.isOver(["inputs", "secondaryDeep"])
      ? ((ctx.inputs?.secondaryDeep as string | undefined) ?? primaryDeep)
      : primaryDeep;
    ctx.setDerived(["inputs", "secondaryDeep"], secondaryDeep);
    cascadeSecondaryDeep(ctx, secondaryDeep);
  }
}
export function applyPrimaryDeep(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["inputs", "primaryDeep"], hex);
  cascadePrimaryDeep(ctx, hex);
  if (!ctx.isOver(["inputs", "secondaryDeep"]) && !ctx.isOver(["inputs", "secondary"])) {
    ctx.setDerived(["inputs", "secondaryDeep"], hex);
    cascadeSecondaryDeep(ctx, hex);
  }
}
function cascadePrimary(ctx: CascadeCtx, primary: string): void {
  const role = deriveSlotRole(ctx, primary);
  ctx.setDerived(["series", 0, "fill"],       role.fill);
  ctx.setDerived(["series", 0, "stroke"],     role.stroke);
  ctx.setDerived(["series", 0, "fillDim"],    role.fillDim);
  ctx.setDerived(["series", 0, "strokeDim"],  role.strokeDim);
  ctx.setDerived(["series", 0, "fillHot"],    role.fillHot);
  ctx.setDerived(["series", 0, "strokeHot"],  role.strokeHot);
  const anchors = (ctx.inputs?.seriesAnchors as string[] | undefined)?.slice() ?? [];
  if (anchors.length > 0 && anchors[0] !== primary) {
    anchors[0] = primary;
    ctx.setDerived(["inputs", "seriesAnchors"], anchors);
  }
}
function cascadePrimaryDeep(ctx: CascadeCtx, primaryDeep: string): void {
  ctx.setDerived(["text", "title", "fg"], primaryDeep);
  ctx.setDerived(["header", "bold", "bg"], primaryDeep);
  ctx.setDerived(["header", "bold", "rule"], boldBandRule(ctx, primaryDeep));
  ctx.setDerived(["header", "tint", "bg"], oklchMix(surfaceBaseline(ctx), primaryDeep, 0.12));
}

// ── Secondary cascade ────────────────────────────────────────────────
export function applySecondary(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["inputs", "secondary"], hex);
  const secondaryDeep = ctx.isOver(["inputs", "secondaryDeep"])
    ? ((ctx.inputs?.secondaryDeep as string | undefined) ?? oklchDarken(hex, 0.15))
    : oklchDarken(hex, 0.15);
  ctx.setDerived(["inputs", "secondaryDeep"], secondaryDeep);
  cascadeSecondaryDeep(ctx, secondaryDeep);
}
export function applySecondaryDeep(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["inputs", "secondaryDeep"], hex);
  cascadeSecondaryDeep(ctx, hex);
}
function cascadeSecondaryDeep(ctx: CascadeCtx, secondaryDeep: string): void {
  // Structural groupings.
  ctx.setDerived(["columnGroup", "bold", "bg"], secondaryDeep);
  ctx.setDerived(["columnGroup", "bold", "rule"], boldBandRule(ctx, secondaryDeep));
  ctx.setDerived(["columnGroup", "tint", "bg"], oklchMix(surfaceBaseline(ctx), secondaryDeep, 0.12));
  const l1Bg = secondaryTintedL1Bg(ctx, secondaryDeep);
  ctx.setDerived(["rowGroup", "L1", "bg"], l1Bg);
  ctx.setDerived(["rowGroup", "L2", "bg"], l1Bg);
  ctx.setDerived(["rowGroup", "L3", "bg"], l1Bg);
  // Chrome texture.
  const subtle = chromeTintedSubtleDivider(ctx, secondaryDeep);
  const strong = chromeTintedStrongDivider(ctx, secondaryDeep);
  const muted  = chromeTintedSurfaceMuted(ctx, secondaryDeep);
  const alt    = chromeTintedAltSurface(ctx, secondaryDeep);
  ctx.setDerived(["divider", "subtle"], subtle);
  ctx.setDerived(["divider", "strong"], strong);
  ctx.setDerived(["cell", "border"], subtle);
  ctx.setDerived(["surface", "muted"], muted);
  ctx.setDerived(["firstColumn", "bold", "bg"], muted);
  ctx.setDerived(["row", "alt", "bg"], alt);
}

// ── Accent cascade (engagement, orthogonal to identity) ─────────────
export function applyAccent(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["inputs", "accent"], hex);
  const accentDeep = ctx.isOver(["inputs", "accentDeep"])
    ? ((ctx.inputs?.accentDeep as string | undefined) ?? oklchDarken(hex, 0.15))
    : oklchDarken(hex, 0.15);
  ctx.setDerived(["inputs", "accentDeep"], accentDeep);
  cascadeAccent(ctx, hex);
}
function cascadeAccent(ctx: CascadeCtx, accent: string): void {
  const muted      = accentMutedHex(ctx, accent);
  const tintSubtle = accentTintSubtleHex(ctx, accent);
  const tintMedium = accentTintMediumHex(ctx, accent);
  const filledTint = semanticFilledTintHex(ctx, accent);
  ctx.setDerived(["accent", "default"],     accent);
  ctx.setDerived(["accent", "muted"],       muted);
  ctx.setDerived(["accent", "tintSubtle"],  tintSubtle);
  ctx.setDerived(["accent", "tintMedium"],  tintMedium);
  ctx.setDerived(["row", "accent", "fg"],         accent);
  ctx.setDerived(["row", "accent", "markerFill"], accent);
  ctx.setDerived(["row", "hover", "bg"],     muted);
  ctx.setDerived(["row", "selected", "bg"],  muted);
  if (!ctx.inputs?.statusInfo) {
    ctx.setDerived(["status", "info"], accent);
  }
  ctx.setDerived(["semantic", "fill"],     filledTint);
  ctx.setDerived(["row", "fill", "bg"],    filledTint);
}

// ── Reset helpers ────────────────────────────────────────────────────
export function resetPrimaryDeep(ctx: CascadeCtx): void {
  ctx.clearOver(["inputs", "primaryDeep"]);
  applyPrimaryDeep(ctx, oklchDarken(currentPrimary(ctx), 0.15));
}
export function resetSecondary(ctx: CascadeCtx): void {
  ctx.clearOver(["inputs", "secondary"]);
  ctx.clearOver(["inputs", "secondaryDeep"]);
  applyPrimary(ctx, currentPrimary(ctx));
}
export function resetSecondaryDeep(ctx: CascadeCtx): void {
  ctx.clearOver(["inputs", "secondaryDeep"]);
  applySecondaryDeep(ctx, oklchDarken(currentSecondary(ctx), 0.15));
}
export function resetSeriesPrimary(ctx: CascadeCtx): void {
  ctx.clearOver(["series", 0, "fill"]);
  cascadePrimary(ctx, currentPrimary(ctx));
}
export function resetTitleFg(ctx: CascadeCtx): void {
  ctx.clearOver(["text", "title", "fg"]);
  ctx.setDerived(["text", "title", "fg"], currentPrimaryDeep(ctx));
}
export function resetHeaderBoldBg(ctx: CascadeCtx): void {
  ctx.clearOver(["header", "bold", "bg"]);
  ctx.setDerived(["header", "bold", "bg"], currentPrimaryDeep(ctx));
}
export function resetSubtleDivider(ctx: CascadeCtx): void {
  ctx.clearOver(["divider", "subtle"]);
  ctx.clearOver(["cell", "border"]);
  const tinted = chromeTintedSubtleDivider(ctx, currentSecondaryDeep(ctx));
  ctx.setDerived(["divider", "subtle"], tinted);
  ctx.setDerived(["cell", "border"], tinted);
}
export function resetL1Bg(ctx: CascadeCtx): void {
  ctx.clearOver(["rowGroup", "L1", "bg"]);
  ctx.setDerived(["rowGroup", "L1", "bg"], secondaryTintedL1Bg(ctx, currentSecondaryDeep(ctx)));
}

// ── Inverse content + strong-divider + surface multi-writes ─────────
export function setInverseContent(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["content", "inverse"], hex);
  ctx.setDerived(["header", "bold", "fg"], hex);
  ctx.setDerived(["columnGroup", "bold", "fg"], hex);
  ctx.setDerived(["header", "bold", "rule"], oklchMix(hex, currentPrimaryDeep(ctx), 0.40));
  ctx.setDerived(["columnGroup", "bold", "rule"], oklchMix(hex, currentSecondaryDeep(ctx), 0.40));
}
export function setStrongDivider(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["divider", "strong"], hex);
  ctx.setDerived(["header", "light", "rule"], hex);
  ctx.setDerived(["columnGroup", "light", "rule"], hex);
  ctx.setDerived(["rowGroup", "L1", "rule"], hex);
  ctx.setDerived(["plot", "axisLine"], hex);
  ctx.setDerived(["plot", "tickMark"], hex);
  ctx.setDerived(["plot", "reference"], hex);
}
export function setBackground(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["surface", "base"], hex);
  ctx.setPath(["row", "base", "bg"], hex);
}
export function setBandingPartner(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["row", "alt", "bg"], hex);
}
export function setForeground(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["content", "primary"], hex);
  ctx.setPath(["cell", "fg"], hex);
  ctx.setPath(["row", "base", "fg"], hex);
  ctx.setPath(["row", "alt",  "fg"], hex);
  ctx.setDerived(["header", "light", "fg"], hex);
  ctx.setDerived(["columnGroup", "light", "fg"], hex);
  ctx.setDerived(["firstColumn", "bold", "fg"], hex);
  ctx.setDerived(["rowGroup", "L1", "fg"], hex);
}

// ── Header (variant-aware) ───────────────────────────────────────────
export function activeHeaderVariant(ctx: CascadeCtx): "light" | "tint" | "bold" {
  const v = ctx.theme?.variants?.headerStyle;
  if (v === "bold" || v === "tint") return v;
  return "light";
}
export function setHeaderBg(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["header", activeHeaderVariant(ctx), "bg"], hex);
}
export function setHeaderFg(ctx: CascadeCtx, hex: string): void {
  ctx.setPath(["header", activeHeaderVariant(ctx), "fg"], hex);
}

// ── Series (compact list) ────────────────────────────────────────────
export function setSeriesFill(ctx: CascadeCtx, idx: number, hex: string): void {
  ctx.setPath(["series", idx, "fill"], hex);
  if (ctx.inputs?.seriesAnchors) {
    const next = (ctx.inputs.seriesAnchors as string[]).slice();
    next[idx] = hex;
    ctx.setPath(["inputs", "seriesAnchors"], next);
  }
}
export function addSeries(ctx: CascadeCtx): void {
  const anchors = (ctx.inputs?.seriesAnchors as string[] | undefined) ?? [];
  const next = anchors.slice();
  next.push(ctx.theme?.accent?.default ?? "#888888");
  ctx.setPath(["inputs", "seriesAnchors"], next);
  const series = (ctx.theme?.series ?? []) as unknown as Array<Record<string, string>>;
  ctx.setPath(["series", series.length, "fill"], next[next.length - 1]);
  ctx.setPath(["series", series.length, "stroke"], next[next.length - 1]);
}
export function removeSeries(ctx: CascadeCtx, idx: number): void {
  const anchors = (ctx.inputs?.seriesAnchors as string[] | undefined) ?? [];
  if (anchors.length <= 1) return;
  const next = anchors.slice();
  next.splice(idx, 1);
  ctx.setPath(["inputs", "seriesAnchors"], next);
  const series = (ctx.theme?.series ?? []) as unknown[];
  const trimmed = series.slice();
  trimmed.splice(idx, 1);
  ctx.setPath(["series"], trimmed);
}

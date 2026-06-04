/**
 * `@tabviz/core` authoring API barrel.
 *
 * Function builders for constructing WebSpec payloads programmatically in
 * TypeScript — mirrors R's `tabviz()`, `col_*()`, `viz_*()`, `web_theme*()`
 * helpers. See `docs/dev/r-ts-parity-notes.md` for per-helper parity status.
 */

// Top-level constructor
export { tabviz } from "./tabviz";
export type { TabvizArgs } from "./tabviz";

// Column builders
export {
  colText, colLabel, colDate,
  colNumeric, colN, colCurrency, colPercent,
  colInterval, colPvalue, colRange, colEvents,
  colBar, colSparkline, colHeatmap, colProgress,
  colBadge, colIcon, colStars, colPictogram, colRing,
  colImg, colReference,
  colGroup,
} from "./columns";
export type {
  CommonColumnArgs,
  ColTextArgs, ColDateArgs, ColNumericArgs, ColNArgs, ColCurrencyArgs,
  ColIntervalArgs, ColPvalueArgs, ColRangeArgs, ColEventsArgs,
  ColBarArgs, ColSparklineArgs, ColHeatmapArgs, ColProgressArgs,
  ColBadgeArgs, ColIconArgs, ColStarsArgs, ColPictogramArgs, ColRingArgs,
  ColImgArgs, ColReferenceArgs, ColPercentArgs,
  ColGroupArgs,
} from "./columns";

// Viz + effects + reference lines
export {
  vizForest, vizBar, vizBoxplot, vizViolin,
  effectForest, effectBar, effectBoxplot, effectViolin,
  refline,
} from "./viz";
export type {
  VizForestArgs, VizBarArgs, VizBoxplotArgs, VizViolinArgs,
  EffectForestArgs, EffectBarArgs, EffectBoxplotArgs, EffectViolinArgs,
  ReflineArgs,
} from "./viz";

// Spec modifiers
export {
  setTitle, setSubtitle, setCaption, setFootnote,
  setTheme, setZoom,
  addColumn, removeColumn, updateColumn,
} from "./modifiers";
export type { SetZoomArgs } from "./modifiers";

// Theme API (re-exported from lib/ for convenience — same surface, one import path)
export {
  themeCochrane, themeLancet, themeJama, themeDark,
  themeNejm, themeNature, themeBmj,
  themeBauhaus, themeSwiss, themeTufte, themeNewsprint,
  themeSolarized, themeSolarizedDark, themeTonal, themeTonalDark,
  themeDwarven, themeElvish, themeHobbit,
  themeSynthwave, themeBrutalist, themeAtelier, themeExecutive,
  webTheme, resolveThemeRef,
} from "../lib/theme/theme-api";

// Resolved theme → portable CSS custom properties. Useful for inspecting,
// exporting, or matching surrounding chrome to the tabviz palette.
export { getThemeCSS, buildThemeCSS, buildWidgetCSS } from "../lib/theme/theme-css";
export type { WidgetCSSContext } from "../lib/theme/theme-css";

// Theme authoring: inputs flow through the adapter to produce the
// resolved theme blob that the renderer consumes.
export { buildTheme } from "../lib/theme/theme-adapter";

// V4 substrate inspection helpers. R wraps these via `ts_call(...)` to
// expose `list_component_tokens()` / `inspect_token()` / `theme_css_vars()`
// at the R user surface (Stage 1 §40 step 9).
export { inspectToken, listComponentTokens, formatTrace } from "../lib/theme/inspect";
export type { TokenInspection, TokenSummary, TraceStep } from "../lib/theme/inspect";

// Bridge: build the v4 cssVars map for a given resolved WebTheme. R wraps
// this as `theme_css_vars(theme)` for at-a-glance inspection of the wire.
export { getCssVars } from "../lib/theme/consumer-bridge";

// V4 resolver + wire — exposed for R wrappers that need to build a
// `ResolvedTheme` from `ThemeInputs` in one call (the R inspection
// helpers route via these so they can pass a real ResolvedTheme to
// `inspectToken`).
import { resolveTheme as _resolveTheme } from "../lib/theme/resolve-theme";
import { createWire as _createWire } from "../lib/theme/theme-wire";
import type { ThemeInputs as _ThemeInputs } from "../types/theme-inputs";
import type { ResolvedTheme as _ResolvedTheme } from "../lib/theme/resolve-theme";
export { resolveTheme } from "../lib/theme/resolve-theme";
export type { ResolvedTheme } from "../lib/theme/resolve-theme";
export { createWire } from "../lib/theme/theme-wire";
export type { ThemeWire } from "../lib/theme/theme-wire";

/** R-friendly inspection bridge: resolves a `ThemeInputs` to a
 *  `ResolvedTheme` in one V8 hop. Internal — R wrappers chain it with
 *  `inspectToken` / `listComponentTokens` to deliver per-token traces. */
export function resolveFromInputs(inputs: _ThemeInputs): _ResolvedTheme {
  return _resolveTheme(_createWire(inputs, "inspect"));
}

// Contrast probe for the R-side `contrast_report(theme)` wrapper.
import { apcaLc as _apcaLc } from "../lib/oklch";
export { apcaContrast, apcaLc } from "../lib/oklch";

/** Build a contrast report for the foreground/background pairs that
 *  matter most: cell on row, header on header-bg, brand-solid pair.
 *  Returns absolute APCA-Lc values plus the v3 contrast ratio (which
 *  the WCAG 2.x flat 4.5:1 framing uses) so authors can sanity-check
 *  against either standard. */
export interface ContrastReportRow {
  readonly label: string;
  readonly fg: string;
  readonly bg: string;
  readonly apcaLc: number;
}

export function contrastReport(resolved: _ResolvedTheme): readonly ContrastReportRow[] {
  const cv = resolved.cssVars;
  const apca = (textHex: string, bgHex: string): number => Math.abs(_apcaLc(textHex, bgHex));
  return [
    { label: "row text on row bg", fg: cv["--tv-row-base-fg"] ?? "#000", bg: cv["--tv-row-base-bg"] ?? "#fff",
      apcaLc: apca(cv["--tv-row-base-fg"] ?? "#000", cv["--tv-row-base-bg"] ?? "#fff") },
    { label: "row text on alt bg", fg: cv["--tv-row-base-fg"] ?? "#000", bg: cv["--tv-row-alt-bg"] ?? "#fff",
      apcaLc: apca(cv["--tv-row-base-fg"] ?? "#000", cv["--tv-row-alt-bg"] ?? "#fff") },
    { label: "emphasis fg on emphasis bg", fg: cv["--tv-row-emphasis-fg"] ?? "#000", bg: cv["--tv-row-emphasis-bg"] ?? "#fff",
      apcaLc: apca(cv["--tv-row-emphasis-fg"] ?? "#000", cv["--tv-row-emphasis-bg"] ?? "#fff") },
    { label: "muted text on surface", fg: cv["--tv-text-muted"] ?? "#000", bg: cv["--tv-surface-bg"] ?? "#fff",
      apcaLc: apca(cv["--tv-text-muted"] ?? "#000", cv["--tv-surface-bg"] ?? "#fff") },
    { label: "text-onsolid on brand-solid", fg: cv["--tv-text-onsolid"] ?? "#fff", bg: cv["--tv-brand-solid"] ?? "#000",
      apcaLc: apca(cv["--tv-text-onsolid"] ?? "#fff", cv["--tv-brand-solid"] ?? "#000") },
  ];
}

// Shared-product computation for split_by widgets. R delegates here via
// the v8 bridge (`ts_call("computeSharedAxis"|"computeSharedWidths", ...)`);
// JS authors building SplitForest payloads can call these directly to
// pre-stamp shared widths / axis range before serializing.
export { computeSharedAxis, computeSharedWidths } from "../lib/split-shared";
export type {
  SubsetSpec,
  SharedAxisArgs, SharedAxisResult,
  SharedWidthsArgs, SharedWidthsResult,
} from "../lib/split-shared";
export type { WebThemeArgs, ThemeRef, PresetName } from "../lib/theme/theme-api";

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
  webTheme, resolveThemeRef,
} from "../lib/theme-api";

// Resolved theme → portable CSS custom properties. Useful for inspecting,
// exporting, or matching surrounding chrome to the tabviz palette.
export { getThemeCSS, buildThemeCSS, buildWidgetCSS } from "../lib/theme-css";
export type { WidgetCSSContext } from "../lib/theme-css";

// Theme authoring: inputs flow through the adapter to produce the
// resolved theme blob that the renderer consumes.
export { buildTheme } from "../lib/theme-adapter";

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
export type { WebThemeArgs, ThemeRef, PresetName } from "../lib/theme-api";

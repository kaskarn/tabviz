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
  colText, colLabel,
  colNumeric, colN, colCurrency, colPercent,
  colInterval, colPvalue, colRange, colEvents,
  colBar, colSparkline, colHeatmap, colProgress,
  colBadge, colIcon, colStars, colPictogram, colRing,
  colImg, colReference,
  colGroup,
} from "./columns";
export type {
  CommonColumnArgs,
  ColTextArgs, ColNumericArgs, ColNArgs, ColCurrencyArgs,
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

// Theme API (re-exported from lib/ for convenience — same surface, one import path)
export {
  themeCochrane, themeLancet, themeJama, themeDark,
  themeDwarven, themeElvish, themeHobbit,
  webTheme, setInputs, setVariants, setSpacing, setThemeField,
  resolveThemeRef, resolveTheme,
} from "../lib/theme-api";
export type {
  WebThemeArgs, ThemeRef,
  ResolveDraft, ResolveOptions, ThemeOverrides,
  PresetName,
} from "../lib/theme-api";

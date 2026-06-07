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
  themeLedger, themeTerminal, themeAurora,
  themeBlueprint, themeSunprint,
  webTheme, resolveThemeRef,
} from "../lib/theme/theme-api";

// Resolved theme → portable CSS custom properties. Useful for inspecting,
// exporting, or matching surrounding chrome to the tabviz palette.
export { getThemeCSS, buildThemeCSS, buildWidgetCSS } from "../lib/theme/theme-css";
export type { WidgetCSSContext } from "../lib/theme/theme-css";

// Theme authoring: inputs flow through the adapter to produce the
// resolved theme blob that the renderer consumes.
export { buildTheme } from "../lib/theme/theme-adapter";

// Bindable Tier-2 roles (ALL_ROLES minus off-ramp). R's set_role()
// validates against this roster via ts_call so the R assert can never
// drift from the TS spine (flow review F3: an unknown role silently
// no-oped in the resolver yet persisted on the artifact).
import { ALL_ROLES as _ALL_ROLES, OFF_RAMP_ROLES as _OFF_RAMP_ROLES } from "../types/theme-roles";
export function listBindableRoles(): string[] {
  return _ALL_ROLES.filter((r) => !_OFF_RAMP_ROLES.has(r));
}

// V4 substrate inspection helpers. R wraps these via `ts_call(...)` to
// expose `list_component_tokens()` / `inspect_token()` / `theme_css_vars()`
// at the R user surface (Stage 1 §40 step 9).
export { inspectToken, listComponentTokens, formatTrace } from "../lib/theme/inspect";
export type { TokenInspection, TokenSummary, TraceStep } from "../lib/theme/inspect";

// Bridge: build the v4 cssVars map for a given resolved WebTheme. R wraps
// this as `theme_css_vars(theme)` for at-a-glance inspection of the wire.
export { getCssVars, setReadVarDevThrow } from "../lib/theme/consumer-bridge";

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

import { PRESETS as _PRESETS } from "../lib/theme/theme-presets-inputs";

/** Return a preset's raw `ThemeInputs` (NOT the projected `ResolvedTheme`).
 *  Used by the R↔TS parity test to compare input shapes directly, bypassing
 *  the `buildTheme` adapter that flattens through v3 vocabulary. */
export function inputsForPreset(name: string): _ThemeInputs {
  const inputs = (_PRESETS as Record<string, _ThemeInputs>)[name];
  if (inputs === undefined) {
    throw new Error(`inputsForPreset: no preset "${name}"`);
  }
  return inputs;
}

// Contrast probe for the R-side `contrast_report(theme)` wrapper.
import { apcaLc as _apcaLc, oklchToHex as _oklchToHex, oklchMix as _oklchMix } from "../lib/oklch";
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

/** Composite an `oklch(L C H / A)` alpha value over a hex backing surface,
 *  returning a measurable hex. Plain hex passes through. Anything else
 *  (gradients, "none") returns null — the caller skips the row rather
 *  than measuring garbage (`hexToRgb("oklch(…)")` parseInt'd into a
 *  fabricated contrast=1 — R2 color review F4). */
function measurableBg(value: string | undefined, backing: string): string | null {
  if (!value) return null;
  if (value.startsWith("#")) return value;
  const m = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/);
  if (!m) return null;
  const hex = _oklchToHex({ L: parseFloat(m[1]!), C: parseFloat(m[2]!), H: parseFloat(m[3]!) });
  const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
  return alpha >= 1 ? hex : _oklchMix(backing, hex, alpha);
}

export function contrastReport(resolved: _ResolvedTheme): readonly ContrastReportRow[] {
  const cv = resolved.cssVars;
  const apca = (textHex: string, bgHex: string): number => Math.abs(_apcaLc(textHex, bgHex));
  const surface = cv["--tv-surface-bg"] ?? "#fff";
  const rows: ContrastReportRow[] = [];
  const push = (label: string, fg: string | undefined, bg: string | undefined): void => {
    const bgHex = measurableBg(bg, surface);
    if (!fg || !bgHex) return; // skip unmeasurable rows instead of fabricating
    rows.push({ label, fg, bg: bgHex, apcaLc: apca(fg, bgHex) });
  };
  push("row text on row bg",        cv["--tv-row-base-fg"], cv["--tv-row-base-bg"]);
  push("row text on alt bg",        cv["--tv-row-base-fg"], cv["--tv-row-alt-bg"]);
  push("emphasis fg on emphasis bg", cv["--tv-row-emphasis-fg"], cv["--tv-row-emphasis-bg"]);
  push("muted text on surface",     cv["--tv-text-muted"], cv["--tv-surface-bg"]);
  push("subtle text on surface",    cv["--tv-text-subtle"], cv["--tv-surface-bg"]);
  // Real emitted tokens (the old row read --tv-text-onsolid /
  // --tv-brand-solid, which the manifest never emits — the fallbacks
  // fabricated a constant Lc 107.9 for every theme).
  push("header-fill fg on header-fill bg", cv["--tv-header-fill-fg"], cv["--tv-header-fill-bg"]);
  return rows;
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

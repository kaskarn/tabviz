// User-facing JS theme API — TS port of `R/themes-api.R`.
//
// - `themeCochrane()` / `themeLancet()` / ... — preset constructors that
//   return a fully-resolved WebTheme.
// - `webTheme({ brand, accent, ... })` — hand-rolled theme constructor;
//   mirrors `R::web_theme()`.
// - `resolveThemeRef(name | object)` — name-string resolver used by
//   `tabviz({ theme: "lancet" })` and the View Source emitter.

import { buildTheme } from "./theme-adapter";
import { PRESETS } from "./theme-presets-inputs";
import type { ThemeInputs } from "../../types/theme-inputs";
import type { WebTheme } from "../../types/theme-resolved";

export type PresetName = keyof typeof PRESETS;

// ────────────────────────────────────────────────────────────────────
// Preset constructors
// ────────────────────────────────────────────────────────────────────

export const themeCochrane      = (): WebTheme => buildTheme(PRESETS.cochrane,        "cochrane");
export const themeLancet        = (): WebTheme => buildTheme(PRESETS.lancet,          "lancet");
export const themeJama          = (): WebTheme => buildTheme(PRESETS.jama,            "jama");
export const themeNejm          = (): WebTheme => buildTheme(PRESETS.nejm,            "nejm");
export const themeNature        = (): WebTheme => buildTheme(PRESETS.nature,          "nature");
export const themeBmj           = (): WebTheme => buildTheme(PRESETS.bmj,             "bmj");
export const themeDark          = (): WebTheme => buildTheme(PRESETS.dark,            "dark");
export const themeBauhaus       = (): WebTheme => buildTheme(PRESETS.bauhaus,         "bauhaus");
export const themeSwiss         = (): WebTheme => buildTheme(PRESETS.swiss,           "swiss");
export const themeTufte         = (): WebTheme => buildTheme(PRESETS.tufte,           "tufte");
export const themeNewsprint     = (): WebTheme => buildTheme(PRESETS.newsprint,       "newsprint");
export const themeSolarized     = (): WebTheme => buildTheme(PRESETS.solarized,       "solarized");
export const themeSolarizedDark = (): WebTheme => buildTheme(PRESETS.solarized_dark,  "solarized_dark");
export const themeTonal         = (): WebTheme => buildTheme(PRESETS.tonal,           "tonal");
export const themeTonalDark     = (): WebTheme => buildTheme(PRESETS.tonal_dark,      "tonal_dark");
export const themeDwarven       = (): WebTheme => buildTheme(PRESETS.dwarven,         "dwarven");
export const themeElvish        = (): WebTheme => buildTheme(PRESETS.elvish,          "elvish");
export const themeHobbit        = (): WebTheme => buildTheme(PRESETS.hobbit,          "hobbit");
export const themeSynthwave     = (): WebTheme => buildTheme(PRESETS.synthwave,       "synthwave");
export const themeBrutalist     = (): WebTheme => buildTheme(PRESETS.brutalist,       "brutalist");
export const themeAtelier       = (): WebTheme => buildTheme(PRESETS.atelier,         "atelier");
export const themeExecutive     = (): WebTheme => buildTheme(PRESETS.executive,       "executive");

// ────────────────────────────────────────────────────────────────────
// webTheme: custom theme constructor (mirrors R::web_theme)
// ────────────────────────────────────────────────────────────────────

export interface WebThemeArgs {
  name?: string;
  /** Partial anchor overrides. Each anchor is an OKLCH triple {L, C, H};
   *  missing anchors inherit from the base preset. */
  anchors?: Partial<ThemeInputs["anchors"]>;
  mode?: "standard" | "high-contrast" | "reduced-transparency";
  polarity?: "light" | "dark";
  density?: "compact" | "comfortable" | "spacious";
  categorical?: string;
  sequential?: string;
  diverging?: string;
  fonts?: { body?: string; display?: string; mono?: string };
  status?: ThemeInputs["status"];
  /** Base preset name; defaults to `"cochrane"`. */
  baseTheme?: PresetName;
}

const INPUT_KEYS: readonly (keyof ThemeInputs)[] = [
  "anchors", "mode", "polarity",
  "categorical", "sequential", "diverging", "status", "fonts", "density",
];

export function webTheme(args: WebThemeArgs = {}): WebTheme {
  const baseName = args.baseTheme ?? "cochrane";
  const baseInputs = PRESETS[baseName];
  const overlay: Partial<ThemeInputs> = {};
  for (const k of INPUT_KEYS) {
    const v = (args as Record<string, unknown>)[k as string];
    if (v !== undefined) (overlay as Record<string, unknown>)[k as string] = v;
  }
  // Anchors deep-merge: partial anchor overrides inherit unspecified slots
  // from the base preset.
  const mergedAnchors = args.anchors
    ? { ...baseInputs.anchors, ...args.anchors }
    : baseInputs.anchors;
  const inputs: ThemeInputs = { ...baseInputs, ...overlay, anchors: mergedAnchors };
  return buildTheme(inputs, args.name ?? "custom");
}

// ────────────────────────────────────────────────────────────────────
// Name-string resolver (for tabviz({ theme: "lancet" }))
// ────────────────────────────────────────────────────────────────────

/** Overrides shape for ThemeRef. Same as `Partial<ThemeInputs>` except
 *  `anchors` is `Partial<ThemeAnchors>` (any subset of paper/ink/brand/
 *  accent) so callers can override just one anchor and inherit the rest. */
export type ThemeRefOverrides = Partial<Omit<ThemeInputs, "anchors">> & {
  anchors?: Partial<ThemeInputs["anchors"]>;
};

export type ThemeRef =
  | PresetName
  | WebTheme
  | { extend: PresetName; overrides?: ThemeRefOverrides };

export function resolveThemeRef(ref: ThemeRef): WebTheme {
  if (typeof ref === "string") {
    return buildTheme(PRESETS[ref], ref);
  }
  if (isResolvedTheme(ref)) return ref;
  const baseInputs = PRESETS[ref.extend];
  // V4: anchors deep-merge so a partial `{ anchors: { brand } }` override
  // inherits the base's paper/ink/accent.
  const mergedAnchors = ref.overrides?.anchors
    ? { ...baseInputs.anchors, ...ref.overrides.anchors }
    : baseInputs.anchors;
  const merged: ThemeInputs = {
    ...baseInputs,
    ...ref.overrides,
    anchors: mergedAnchors,
  };
  return buildTheme(merged, ref.extend);
}

function isResolvedTheme(x: unknown): x is WebTheme {
  return typeof x === "object" && x !== null && (x as { schemaVersion?: number }).schemaVersion === 2;
}

export type { ThemeInputs, WebTheme };

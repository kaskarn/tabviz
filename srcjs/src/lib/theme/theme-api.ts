// User-facing JS theme API — TS port of `R/themes-api.R`.
//
// - `themeCochrane()` / `themeLancet()` / ... — preset constructors that
//   return a fully-resolved WebTheme.
// - `webTheme({ brand, accent, ... })` — hand-rolled theme constructor;
//   mirrors `R::web_theme()`.
// - `resolveThemeRef(name | object)` — name-string resolver used by
//   `tabviz({ theme: "lancet" })` and the View Source emitter.

import { buildTheme } from "./theme-adapter";
import { PRESETS, preset } from "./theme-presets-inputs";
import type { ThemeInputs } from "../../types/theme-inputs";
import type { WebTheme } from "../../types/theme-resolved";

export type PresetName = keyof typeof PRESETS;

// ────────────────────────────────────────────────────────────────────
// Preset constructors — the 9 committed identities (27→9 cull, 2026-06-09).
// One per axis (rgc_v4 model). The 18 deleted constructors (themeCochrane,
// themeLancet, …) are gone; a deleted look's BRAND is a set_brand() away, its
// FULL personality a webTheme({ baseTheme: "nejm", … }) away (set_brand alone
// recolors only the brand anchor — it does NOT reproduce a journal's shell /
// type-scale / density).
// ────────────────────────────────────────────────────────────────────

export const themeNejm          = (): WebTheme => buildTheme(PRESETS.nejm,       "nejm");
export const themeLedger        = (): WebTheme => buildTheme(PRESETS.ledger,     "ledger");
export const themeBrutalist     = (): WebTheme => buildTheme(PRESETS.brutalist,  "brutalist");
export const themeAurora        = (): WebTheme => buildTheme(PRESETS.aurora,     "aurora");
export const themeTerminal      = (): WebTheme => buildTheme(PRESETS.terminal,   "terminal");
export const themeNewsprint     = (): WebTheme => buildTheme(PRESETS.newsprint,  "newsprint");
export const themeBlueprint     = (): WebTheme => buildTheme(PRESETS.blueprint,  "blueprint");
export const themeSynthwave     = (): WebTheme => buildTheme(PRESETS.synthwave,  "synthwave");
export const themeDwarven       = (): WebTheme => buildTheme(PRESETS.dwarven,    "dwarven");

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
  /** Structural variants — Tier-1 enums R's web_theme() also accepts
   *  (docs review: the settings-overhaul promoted these to first-class
   *  inputs; the TS constructor lagged the R surface). */
  headerStyle?: ThemeInputs["header_style"];
  borderPreset?: ThemeInputs["border_preset"];
  slotStyle?: ThemeInputs["slot_style"];
  /** Base preset name; defaults to `"nejm"`. */
  baseTheme?: PresetName;
}

const INPUT_KEYS: readonly (keyof ThemeInputs)[] = [
  "anchors", "mode", "polarity",
  "categorical", "sequential", "diverging", "status", "fonts", "density",
];

/** camelCase arg → snake_case ThemeInputs key (authoring sugar only;
 *  the wire stays snake_case per the locked naming convention). */
const VARIANT_KEYS = {
  headerStyle: "header_style",
  borderPreset: "border_preset",
  slotStyle: "slot_style",
} as const;

export function webTheme(args: WebThemeArgs = {}): WebTheme {
  const baseName = args.baseTheme ?? "nejm";
  // preset() falls back to NEJM for an unknown/deleted base name.
  const baseInputs = preset(baseName);
  const overlay: Partial<ThemeInputs> = {};
  for (const k of INPUT_KEYS) {
    const v = (args as Record<string, unknown>)[k as string];
    if (v !== undefined) (overlay as Record<string, unknown>)[k as string] = v;
  }
  for (const [argKey, inputKey] of Object.entries(VARIANT_KEYS)) {
    const v = (args as Record<string, unknown>)[argKey];
    if (v !== undefined) (overlay as Record<string, unknown>)[inputKey] = v;
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
    // preset() falls back to NEJM for an unknown/deleted name (post-cull).
    return buildTheme(preset(ref), ref);
  }
  if (isResolvedTheme(ref)) return ref;
  const baseInputs = preset(ref.extend);
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

// `WebTheme.schemaVersion = 4` post-coherence (was at `2` through v3).
// Aligned with `ThemeStructure.schemaVersion = 4` so both versions track
// the V4 substrate together. The wire-spec version (`CURRENT_VERSION` in
// spec/index.ts, currently 1.2) is unrelated.
function isResolvedTheme(x: unknown): x is WebTheme {
  return typeof x === "object" && x !== null && (x as { schemaVersion?: number }).schemaVersion === 4;
}

export type { ThemeInputs, WebTheme };

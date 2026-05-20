/**
 * User-facing v2 theme API — TS port of `R/themes-api.R`.
 *
 * - `themeCochrane()` / `themeLancet()` / ... — preset constructors that
 *   return a fully-resolved WebThemeV2.
 * - `webTheme({ inputs, variants, base_theme, overrides })` — hand-rolled
 *   theme constructor; mirrors `R::web_theme()`.
 * - `setInputs` / `setVariants` / `setSpacing` / `setThemeField` — modifier
 *   helpers; each re-resolves and returns a new WebThemeV2.
 * - `resolveThemeByName(name, overrides?)` — name-string resolver used by
 *   `tabviz({ theme: "lancet" })` and the View Source emitter.
 */

import { resolveTheme, type ResolveDraft, type ResolveOptions, type ThemeOverrides } from "./theme-resolve";
import {
  COCHRANE_DRAFT, LANCET_DRAFT, JAMA_DRAFT, DARK_DRAFT,
  DWARVEN_DRAFT, ELVISH_DRAFT, HOBBIT_DRAFT,
  BAUHAUS_DRAFT, SWISS_DRAFT, TUFTE_DRAFT, NEWSPRINT_DRAFT,
  SOLARIZED_DRAFT, SOLARIZED_DARK_DRAFT, TONAL_DRAFT, TONAL_DARK_DRAFT,
  PRESET_DRAFTS, type PresetName,
} from "./theme-presets-inputs";
import type {
  WebThemeV2, ThemeInputsV2, ThemeVariantsV2, WebFontV2,
  SpacingTokensV2, AxisConfigV2, LayoutV2,
} from "../types/theme-v2";

// ────────────────────────────────────────────────────────────────────
// Preset constructors
// ────────────────────────────────────────────────────────────────────

export const themeCochrane      = (): WebThemeV2 => resolveTheme(COCHRANE_DRAFT);
export const themeLancet        = (): WebThemeV2 => resolveTheme(LANCET_DRAFT);
export const themeJama          = (): WebThemeV2 => resolveTheme(JAMA_DRAFT);
export const themeDark          = (): WebThemeV2 => resolveTheme(DARK_DRAFT);
export const themeBauhaus       = (): WebThemeV2 => resolveTheme(BAUHAUS_DRAFT);
export const themeSwiss         = (): WebThemeV2 => resolveTheme(SWISS_DRAFT);
export const themeTufte         = (): WebThemeV2 => resolveTheme(TUFTE_DRAFT);
export const themeNewsprint     = (): WebThemeV2 => resolveTheme(NEWSPRINT_DRAFT);
export const themeSolarized     = (): WebThemeV2 => resolveTheme(SOLARIZED_DRAFT);
export const themeSolarizedDark = (): WebThemeV2 => resolveTheme(SOLARIZED_DARK_DRAFT);
export const themeTonal         = (): WebThemeV2 => resolveTheme(TONAL_DRAFT);
export const themeTonalDark     = (): WebThemeV2 => resolveTheme(TONAL_DARK_DRAFT);
export const themeDwarven       = (): WebThemeV2 => resolveTheme(DWARVEN_DRAFT);
export const themeElvish        = (): WebThemeV2 => resolveTheme(ELVISH_DRAFT);
export const themeHobbit        = (): WebThemeV2 => resolveTheme(HOBBIT_DRAFT);

// ────────────────────────────────────────────────────────────────────
// webTheme: custom theme constructor (mirrors R::web_theme)
// ────────────────────────────────────────────────────────────────────

export interface WebThemeArgs {
  name?: string;
  inputs?: Partial<ThemeInputsV2>;
  variants?: Partial<ThemeVariantsV2>;
  webFonts?: WebFontV2[];
  /** Base preset name; defaults to `"cochrane"`. */
  baseTheme?: PresetName;
  /** Tier 2/3 overrides applied after baseTheme + inputs. */
  overrides?: ThemeOverrides;
  /** Construction-time contrast validation; default `true`. */
  validate?: boolean;
}

/**
 * Build a custom v2 theme from Tier 1 inputs + optional Tier 2/3 overrides,
 * starting from a base preset. Mirrors R's `web_theme()`.
 *
 * When `inputs` / `variants` / `webFonts` are passed, the result is built
 * from a fresh skeleton seeded with the base preset's Tier 1 — pinned Tier
 * 2/3 fields on the base are NOT inherited (they were tuned for the base's
 * identity and would likely look wrong against new inputs).
 */
export function webTheme(args: WebThemeArgs = {}): WebThemeV2 {
  const baseName = args.baseTheme ?? "cochrane";
  const baseDraft = PRESET_DRAFTS[baseName];
  const customizing = args.inputs != null || args.variants != null || args.webFonts != null || args.overrides != null;

  if (!customizing) {
    // No customization → return base verbatim under the new name.
    return resolveTheme({ ...baseDraft, name: args.name ?? baseDraft.name }, { validate: args.validate });
  }

  // Merge: base inputs ← user inputs (applyInputsResets handled here).
  const mergedInputs: ThemeInputsV2 = {
    ...baseDraft.inputs as ThemeInputsV2,
    ...applyInputsResets(args.inputs ?? {}),
  };

  const draft: ResolveDraft = {
    name: args.name ?? "custom",
    inputs: mergedInputs as ResolveDraft["inputs"],
    variants: { ...baseDraft.variants, ...args.variants },
    webFonts: args.webFonts ?? baseDraft.webFonts,
    overrides: args.overrides,
  };

  return resolveTheme(draft, { validate: args.validate });
}

// ────────────────────────────────────────────────────────────────────
// Modifier API — setInputs / setVariants / setSpacing / setThemeField
// ────────────────────────────────────────────────────────────────────

/**
 * Internal: when an input arg sets a tier seed (or `accent`/`fontBody`),
 * reset the matching companion(s) to null so the resolver re-derives.
 * Mirrors R's `apply_inputs_resets`.
 */
function applyInputsResets(args: Partial<ThemeInputsV2>): Partial<ThemeInputsV2> {
  const out: Partial<ThemeInputsV2> = { ...args };
  if ("primary" in args) {
    if (!("primaryDeep"   in args)) out.primaryDeep   = null;
    if (!("secondary"     in args)) out.secondary     = null;
    if (!("secondaryDeep" in args)) out.secondaryDeep = null;
  } else if ("secondary" in args) {
    if (!("secondaryDeep" in args)) out.secondaryDeep = null;
  }
  if ("accent"   in args && !("accentDeep"  in args)) out.accentDeep  = null;
  if ("fontBody" in args && !("fontDisplay" in args)) out.fontDisplay = null;
  return out;
}

/** Re-resolve a theme after a structural edit. Internal helper. */
function reresolve(theme: WebThemeV2, options?: ResolveOptions): WebThemeV2 {
  return resolveTheme(themeToDraft(theme), options);
}

/** Convert a fully-resolved WebThemeV2 back into a ResolveDraft. */
function themeToDraft(theme: WebThemeV2): ResolveDraft {
  return {
    name: theme.name,
    inputs: theme.inputs as ResolveDraft["inputs"],
    variants: theme.variants,
    webFonts: theme.webFonts,
    axis: theme.axis,
    layout: theme.layout,
    overrides: {
      surface: theme.surface,
      content: theme.content,
      divider: theme.divider,
      accent: theme.accent,
      status: theme.status,
      semantic: theme.semantic,
      series: theme.series,
      text: theme.text,
      spacing: theme.spacing,
      annotation: theme.annotation,
      header: theme.header,
      columnGroup: theme.columnGroup,
      rowGroup: theme.rowGroup,
      row: theme.row,
      cell: theme.cell,
      firstColumn: theme.firstColumn,
      plot: theme.plot,
      marks: theme.marks,
    },
  };
}

/**
 * Update Tier 1 inputs and re-resolve. Mirrors R's `set_inputs()`.
 *
 * When a tier seed is changed, its `_deep` companion (and downstream
 * mirrors) reset to null so the resolver re-derives them. Series_anchors
 * changes wipe series slot bundles so every derived fill refreshes.
 */
export function setInputs(theme: WebThemeV2, args: Partial<ThemeInputsV2>, options?: ResolveOptions): WebThemeV2 {
  const updates = applyInputsResets(args);
  const newInputs = { ...theme.inputs, ...updates };
  const draft = themeToDraft({ ...theme, inputs: newInputs });

  // series_anchors changed → drop existing series so the resolver rebuilds.
  if ("seriesAnchors" in args && draft.overrides) {
    draft.overrides = { ...draft.overrides, series: undefined };
  }
  return resolveTheme(draft, options);
}

/**
 * Update variants (density / headerStyle / firstColumnStyle) and re-resolve.
 * Density changes wipe the spacing overrides so the new preset's defaults apply.
 */
export function setVariants(
  theme: WebThemeV2,
  args: Partial<ThemeVariantsV2>,
  options?: ResolveOptions,
): WebThemeV2 {
  const draft = themeToDraft({ ...theme, variants: { ...theme.variants, ...args } });
  if ("density" in args && draft.overrides) {
    // Wipe spacing so the new density preset's defaults apply.
    draft.overrides = { ...draft.overrides, spacing: undefined };
  }
  return resolveTheme(draft, options);
}

/** Override one or more density-derived spacing tokens. Mirrors `set_spacing()`. */
export function setSpacing(
  theme: WebThemeV2,
  args: Partial<SpacingTokensV2>,
  options?: ResolveOptions,
): WebThemeV2 {
  return resolveTheme(
    themeToDraft({ ...theme, spacing: { ...theme.spacing, ...args } }),
    options,
  );
}

/**
 * Set a single theme field by path. The `path` is dot-separated; numeric
 * segments index into list properties (currently only `series`). Mirrors
 * `set_theme_field()`.
 *
 * Examples:
 *   setThemeField(theme, "rowGroup.L1.bg", "#EEE")
 *   setThemeField(theme, "series.0.fill", "#FF0000")
 *   setThemeField(theme, "inputs.primary", "#1F3A5F")
 */
export function setThemeField<T = unknown>(
  theme: WebThemeV2,
  path: string,
  value: T,
  options?: ResolveOptions,
): WebThemeV2 {
  if (path.length === 0) throw new Error("setThemeField: path must be non-empty");
  const parts = path.split(".");
  // Deep clone the theme; structuredClone covers our wire-shape JSON.
  const clone = structuredClone(theme) as unknown as Record<string, unknown>;
  let cursor: Record<string, unknown> | unknown[] = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = /^\d+$/.test(part)
      ? (cursor as unknown[])[Number(part)]
      : (cursor as Record<string, unknown>)[part];
    if (next == null || typeof next !== "object") {
      throw new Error(`setThemeField: path "${path}" breaks at segment "${part}"`);
    }
    cursor = next as Record<string, unknown> | unknown[];
  }
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) {
    (cursor as unknown[])[Number(last)] = value;
  } else {
    (cursor as Record<string, unknown>)[last] = value;
  }
  return reresolve(clone as unknown as WebThemeV2, options);
}

// ────────────────────────────────────────────────────────────────────
// Name-string resolver (for tabviz({ theme: "lancet" }))
// ────────────────────────────────────────────────────────────────────

/**
 * Resolve a theme reference — either a name string, a `{ extend, overrides }`
 * object, or an already-resolved WebThemeV2. Used by the top-level `tabviz()`
 * constructor for `{ theme: "lancet" }` ergonomics.
 */
export type ThemeRef =
  | PresetName
  | WebThemeV2
  | { extend: PresetName; overrides?: ThemeOverrides; variants?: Partial<ThemeVariantsV2> };

export function resolveThemeRef(ref: ThemeRef, options?: ResolveOptions): WebThemeV2 {
  if (typeof ref === "string") {
    return resolveTheme(PRESET_DRAFTS[ref], options);
  }
  if (isResolvedTheme(ref)) return ref;
  const baseDraft = PRESET_DRAFTS[ref.extend];
  return resolveTheme(
    {
      ...baseDraft,
      variants: { ...baseDraft.variants, ...ref.variants },
      overrides: { ...baseDraft.overrides, ...ref.overrides },
    },
    options,
  );
}

function isResolvedTheme(x: unknown): x is WebThemeV2 {
  return typeof x === "object" && x !== null && (x as { schemaVersion?: number }).schemaVersion === 2;
}

// Re-exports for ergonomics
export { resolveTheme };
export type { ResolveDraft, ResolveOptions, ThemeOverrides };
export type { ThemeInputsV2, ThemeVariantsV2, WebThemeV2, AxisConfigV2, LayoutV2 };
export type { PresetName };

/**
 * `@tabviz/core` authoring API barrel.
 *
 * Function builders for constructing WebSpec payloads programmatically in
 * TypeScript — mirrors R's `tabviz()`, `col_*()`, `viz_*()`, `web_theme*()`
 * helpers. See `docs/dev/r-ts-parity-notes.md` for per-helper parity status.
 */

// Top-level constructor
export { tabviz } from "./tabviz";
export type { TabvizArgs, PaginateOptions } from "./tabviz";
export { computePageBreaks } from "./paginate";
export type { PageBreakOptions, PageBreakResult } from "./paginate";

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

// Theme API (re-exported from lib/ for convenience — same surface, one import
// path). The 9 committed identities after the 27→9 cull (one per axis).
export {
  themeNejm, themeLedger, themeBrutalist, themeAurora, themeTerminal,
  themeNewsprint, themeBlueprint, themeSynthwave, themeDwarven,
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

// Component-model roster (W6) — component → region + state → channel →
// backing cssVar, derived from the manifest's `binding` annotations.
// R's set_component() validates against this via ts_call (the
// listBindableRoles pattern: the R assert can never drift from TS).
export { componentRoster } from "../lib/theme/component-bindings";

// One validation source for the `components` block across runtimes: R's
// set_component()/theme_from_wire() call this via ts_call and abort on a
// non-empty issue list — byte-identical rules to parseThemeWire's ingress.
import { sanitizeComponentBindings as _sanitizeCB } from "../lib/theme/component-bindings";
export function validateComponentBindings(
  bindings: unknown,
): { path: string; code: string; message: string }[] {
  return _sanitizeCB(bindings).issues;
}

// Domain-aware role roster — the discoverable companion to set_role()
// (round-3 API review: valid roles were only knowable by erroring). The
// `domain` facet ships now (all current roles are "color") so the Wave-3
// non-color scale-roles register into the SAME roster + shape, not a
// second namespace.
import { DEFAULT_ROLE_BINDINGS as _DEFAULTS } from "../lib/theme/role-bindings";
import { TOKENS_BY_ROLE as _TOKENS_BY_ROLE } from "../lib/theme/component-tokens";
import { bindingToAlias as _bindingToAlias } from "../lib/theme/alias";
import {
  TYPE_ROLE_NAMES as _TYPE_ROLE_NAMES, typeRoleToAlias as _typeRoleToAlias,
  CORNER_SLOTS as _CORNER_SLOTS, RULE_SLOTS as _RULE_SLOTS,
} from "../lib/theme/scale-roles";
import { DEFAULT_TYPE_ROLES as _DEFAULT_TYPE_ROLES } from "../lib/theme/typography";

/** The geometry SLOT tables (Wave 3) — single source for R's set_corners /
 *  set_rules (R caches these via ts_call + a parity test guards the mirror,
 *  the density-presets pattern). corners → radius {sm,md,lg,pill};
 *  rules → border-width {hair,thin,regular,thick}. */
export function geometrySlotTables(): {
  corners: typeof _CORNER_SLOTS;
  rules: typeof _RULE_SLOTS;
} {
  return { corners: _CORNER_SLOTS, rules: _RULE_SLOTS };
}

// Column-schema introspection — the machine-readable column contract,
// reachable over the V8 bridge for R `list_column_types()` / `column_schema()`.
export { listColumnTypes, columnSchema } from "./schema-introspect";
export type { ColumnTypeInfo, ColumnOptionInfo } from "./schema-introspect";
export interface RoleRosterEntry {
  role: string;
  /** Which generated scale the role indexes. `color` roles bind a ramp+grade;
   *  Wave-3 `type`/`spacing`/`geometry` roles will index their own scales. */
  domain: "color" | "type" | "spacing" | "geometry";
  /** The role's default coordinate as a portable alias string — the ONE
   *  domain-agnostic column (Wave 1.5 keystone fix). For color roles this is
   *  `"ramp.grade"` (e.g. `"neutral.5"`); non-color roles encode their scale
   *  slot here without needing a ramp/grade. */
  coordinate: string;
  /** Color-domain coordinate parts — present ONLY when `domain === "color"`.
   *  Non-color roles leave these undefined (don't widen the type to force a
   *  bogus ramp/grade onto a type/spacing role). */
  ramp?: string;
  grade?: number;
  /** One example `--tv-*` token the role drives, or `null` for roles consumed
   *  ONLY via computed tokens (series slots, alpha companions, focus-ring) —
   *  those have no direct manifest token, NOT that the role is inert. */
  example: string | null;
}
export function listRoles(): RoleRosterEntry[] {
  const color = _ALL_ROLES
    .filter((r) => !_OFF_RAMP_ROLES.has(r))
    .map((role): RoleRosterEntry => {
      const b = _DEFAULTS[role];
      const example = _TOKENS_BY_ROLE.get(role)?.[0]?.cssVar ?? null;
      return {
        role,
        domain: "color",
        coordinate: _bindingToAlias(b),
        ramp: b.ramp,
        grade: b.grade,
        example,
      };
    });
  // Non-color scale roles (Wave 3 keystone) — same roster, ONE namespace
  // for set_role() + the DTCG adapter. Their `coordinate` is the default
  // recipe/slot, NOT a ramp.grade (ramp/grade stay undefined for them).
  const type: RoleRosterEntry[] = _TYPE_ROLE_NAMES.map((role) => ({
    role,
    domain: "type" as const,
    coordinate: _typeRoleToAlias(_DEFAULT_TYPE_ROLES[role]),
    example: `--tv-text-${role}-size`,
  }));
  const geometry: RoleRosterEntry[] = [
    { role: "corners", domain: "geometry", coordinate: "soft", example: "--tv-radius-md" },
    { role: "rules", domain: "geometry", coordinate: "normal", example: "--tv-border-width-thin" },
  ];
  const spacing: RoleRosterEntry[] = [
    { role: "density", domain: "spacing", coordinate: "comfortable", example: "--tv-spacing-row-height" },
  ];
  return [...color, ...type, ...geometry, ...spacing];
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
export { createWire, buildThemeWire } from "../lib/theme/theme-wire";
export type { ThemeWire, ThemeWireEnvelope, PinnedThemeWire } from "../lib/theme/theme-wire";

// The portable-theme contract surface (Wave 4): the validating ingress +
// envelope builder must be reachable to any `@tabviz/core` consumer (an
// LLM driver / JS author parsing untrusted theme JSON) — previously they
// were studio-internal, so the "portable envelope" was a comment, not a
// usable API (ecosystem-lens W1 P1). normalizeRoleOverrides accepts both
// the alias + legacy coordinate forms.
export { parseThemeWire, ThemeWireParseError } from "../lib/theme/theme-wire-parse";
export { normalizeRoleOverrides, bindingToAlias, aliasToBinding } from "../lib/theme/alias";
export { validateThemeInputs, ThemeInputsValidationError } from "../lib/theme/theme-validate";
export type { ThemeIssue } from "../lib/theme/theme-validate";

// TS author-facade (Wave 4): the wire-op verbs the token-compiler story
// needs in BOTH languages — R has set_role/set_pin/clear_role; expose the
// matching TS surface so a JS author / LLM driver isn't second-class.
export { setRoleBinding, pinTokenByName, releaseRole } from "../lib/theme/theme-wire";

// DTCG interop + brand bootstrap (Wave 4 flagship). toDtcg/fromDtcg
// round-trip a theme through the Design Tokens format; suggestTheme derives
// a contrast-safe theme from one brand hex.
export { toDtcg, fromDtcg, dtcgFromTheme } from "../lib/theme/dtcg-adapter";
export type { DtcgDocument } from "../lib/theme/dtcg-adapter";
export { suggestTheme } from "../lib/theme/suggest-theme";
export type { SuggestThemeOptions } from "../lib/theme/suggest-theme";

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

/** The web fonts a named preset loads — the V8 seam R's GENERATED preset
 *  constructors fetch alongside inputsForPreset (the URL table is
 *  TS-owned: lib/theme/preset-web-fonts.ts). */
export { presetWebFonts } from "../lib/theme/preset-web-fonts";

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

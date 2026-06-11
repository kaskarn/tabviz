/**
 * Consumer migration bridge (Phase 6).
 *
 * During the substrate sprint, consumers transition from reading the v3
 * resolved theme object (`theme.row.alt.bg` etc.) to reading the v4 cssVars
 * map (`cssVars["--tv-row-alt-bg"]`). This module provides the bridge:
 * given a v3 WebTheme (which carries `authoringInputs`), it builds a v4
 * wire, runs `resolveTheme()`, and returns the cssVars map.
 *
 * Once all consumers have migrated, this bridge becomes unnecessary and
 * gets deleted (step 10 of Stage 1 §40 — v3 dead-code purge). Until then,
 * it lets consumers opt into reading v4 cssVars one cluster at a time
 * without committing to a wholesale rewrite.
 *
 * Usage pattern:
 *
 *   const cssVars = getCssVars(spec.theme);
 *   const bg = readVar(cssVars, "--tv-row-alt-bg", spec.theme.row.alt.bg);
 *   // bg is the v4 cssVar value when available; falls back to v3 read.
 *
 * The readVar helper supports the fallback so consumers can migrate
 * field-by-field with safe defaults.
 */

import type { WebTheme } from "../../types/theme-resolved";
import { createWire } from "./theme-wire";
import { computeV3BridgeVars } from "./v3-bridge-vars";
import { resolveTheme } from "./resolve-theme";
import { TOKENS_BY_VAR } from "./component-tokens";
import { componentBindingsKey } from "./component-bindings";

/** Build the v4 cssVars map for a given v3 WebTheme.
 *
 *  When `theme.authoringInputs` is undefined (older specs, hand-built
 *  themes), returns an empty record — consumers fall back to reading
 *  v3 fields directly per `readVar(...)`.
 *
 *  After resolving from authoringInputs, applies theme.spacing.* as
 *  override pins. This honors callers that mutate `spec.theme.spacing.X`
 *  after construction (a v3-era pattern that bypasses the v4 wire). */
// The expensive cascade (wire → ramps → roles → ~140-token manifest
// walk) is memoized per authoringInputs identity (same pattern as
// theme-css.ts's buildThemeCSS cache). Without this, every call re-ran
// the FULL cascade — and there are 50+ call sites, several per-cell in
// column renderers (adversarial code-quality review, 2026-06-05).
//
// Spacing pins are deliberately NOT part of the cached value: the
// v3-era `spec.theme.spacing.X = value` pattern mutates the theme
// IN PLACE (same identity), and caching the pinned result returned
// stale pins — caught immediately by svg-centering.test.ts's
// rowGroupPadding gate. The pin application is ~17 assignments on a
// spread; the cascade is the expensive part.
// Two-level cache (settings-overhaul P0): the outer WeakMap keys on the
// stable authoringInputs identity; the inner Map keys on a canonical
// stringification of roleOverrides. Role pins are part of the portable
// artifact now — before this, getCssVars built its wire with EMPTY
// overrides, so studio spine rebinds never affected widget rendering.
const cascadeCache = new WeakMap<object, Map<string, Record<string, string>>>();

/** Canonical, order-independent key for roleOverrides + components + pins. */
function overridesKey(
  ro: WebTheme["roleOverrides"],
  pins?: WebTheme["pins"],
  components?: WebTheme["components"],
): string {
  const roPart = !ro ? "" : Object.entries(ro)
    .filter(([, b]) => b != null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([role, b]) => `${role}:${b!.ramp}[${b!.grade}]`)
    .join("|");
  const pinPart = !pins ? "" : Object.entries(pins)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
  return `${roPart}//${pinPart}//${componentBindingsKey(components)}`;
}

/** Overlay Tier-2/3 token pins onto a resolved cssVars map. Applied at
 *  the cssVar layer AFTER resolve — never a post-resolve cluster stamp
 *  (the reapplyEdits anti-pattern). Validators downstream see pinned
 *  values because the overlay happens before they read the map. */
/** Characters no single CSS declaration VALUE can legitimately contain.
 *  `<` `>` break out of SVG/XML structure, `{` `}` `;` break out of the
 *  CSS declaration, control chars are never valid. `"` breaks out of a
 *  double-quoted SVG attribute (a value like `#fff" onload="..."` injects
 *  an event handler with no `<` at all) — banned; single quotes stay
 *  legal and are CSS-equivalent for font lists. This is the security gate
 *  the round-2 robustness review demanded: a pin value containing
 *  `"/><script>` reached exported SVG fill attributes verbatim (stored
 *  XSS in a SHARED artifact — the wire envelope spreads pins). */
// eslint-disable-next-line no-control-regex -- control chars are the POINT: this is the XSS ingress gate
const PIN_VALUE_FORBIDDEN = /[<>{};"\u0000-\u001f]/;
const PIN_VALUE_MAX_LEN = 512;

/** True when `v` is acceptable as a token-pin value. Exported so every
 *  ingress (settings import, studio setPin, R via wire) shares ONE rule. */
export function isValidPinValue(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 &&
    v.length <= PIN_VALUE_MAX_LEN && !PIN_VALUE_FORBIDDEN.test(v);
}

export function applyTokenPins(
  cssVars: Record<string, string>,
  pins: WebTheme["pins"],
  activeMode?: string,
): Record<string, string> {
  if (!pins) return cssVars;
  // Accessibility ratchet wins at PAINT, not just a lint (round-3 design-
  // tokens + inclusive-design): a raw pin overlays AFTER the cascade's mode
  // logic, so a pin on a token that HC/RT wants to drop/swap would defeat
  // the accessibility behavior and ship e.g. dark-on-dark to a high-
  // contrast viewer. When a mode is active, skip pins on tokens whose
  // manifest declares behavior for that mode.
  const hc = activeMode === "high-contrast";
  const rt = activeMode === "reduced-transparency";
  for (const [k, v] of Object.entries(pins)) {
    // Name gate (--tv- prefix) + VALUE gate (structural-char ban): a
    // hostile value in an imported envelope is dropped here, the one
    // chokepoint every resolve path shares (getCssVarsRaw → both the
    // widget paint block and the SVG export read through this).
    if (!k.startsWith("--tv-") || !isValidPinValue(v)) continue;
    if (hc || rt) {
      const m = TOKENS_BY_VAR.get(k)?.modes;
      if (m && ((hc && m.hc) || (rt && m.rt))) continue; // ratchet beats pin
    }
    cssVars[k] = v;
  }
  return cssVars;
}

/** The cached raw cascade resolve (pins applied; NO v3-bridge overlay,
 *  NO spacing pins). Shared by getCssVars and theme-css's paint-path
 *  emitter so a single paint never runs the cascade twice (perf review:
 *  _emitV4CssVarsBody re-resolved uncached on every theme CSS build).
 *  Throws on resolver errors — callers choose their fallback. */
export function getCssVarsRaw(theme: WebTheme): Record<string, string> {
  let byOverrides = cascadeCache.get(theme.authoringInputs!);
  if (!byOverrides) {
    byOverrides = new Map();
    cascadeCache.set(theme.authoringInputs!, byOverrides);
  }
  const key = overridesKey(theme.roleOverrides, theme.pins, theme.components);
  let base = byOverrides.get(key);
  if (!base) {
    const wire = {
      ...createWire(theme.authoringInputs!, theme.name ?? "custom"),
      roleOverrides: theme.roleOverrides ?? {},
      components: theme.components,
    };
    base = applyTokenPins(
      { ...(resolveTheme(wire).cssVars as Record<string, string>) },
      theme.pins,
      theme.authoringInputs!.mode,
    );
    byOverrides.set(key, base);
  }
  return base;
}

/** Cache of the base+v3-bridge overlay, keyed on the (immutable) theme
 *  object identity. The overlay is a pure function of the theme — the
 *  raw cascade (already cached in getCssVarsRaw) plus computeV3BridgeVars,
 *  which reads only theme config that changes with theme identity. Spacing
 *  pins are deliberately NOT baked in here: they're per-figure and applied
 *  fresh on every call (see applySpacingPins). We still spread a fresh copy
 *  per call because callers mutate the returned map. */
const cssVarsBridgeCache = new WeakMap<WebTheme, Record<string, string>>();

export function getCssVars(theme: WebTheme | undefined | null): Record<string, string> {
  if (!theme?.authoringInputs) return {};
  let withBridge = cssVarsBridgeCache.get(theme);
  if (!withBridge) {
    let base: Record<string, string>;
    try {
      base = getCssVarsRaw(theme);
    } catch {
      // Resolver errors during the sprint are tolerated; consumers fall
      // back to v3 reads. Drift gates + visual regression catch silent
      // mismatches.
      base = {};
    }
    // Overlay the v3 user-config bridge values over their "<v3-bridge>"
    // sentinels so every consumer of getCssVars (TS readers, R's
    // theme_css_vars/diff_themes/inspect_token via V8, the studio) sees
    // the SAME values the painted CSS uses. Before this, 16 tokens
    // round-tripped as the literal sentinel and --tv-text-title-fg
    // diverged between studio preview and R render (R3 studio F3/F4).
    withBridge = Object.assign({ ...base }, computeV3BridgeVars(theme, base));
    cssVarsBridgeCache.set(theme, withBridge);
  }
  // Fresh copy per call: callers mutate the result, and applySpacingPins
  // writes in place — never let either touch the cached overlay.
  return applySpacingPins({ ...withBridge }, theme);
}

/** Apply theme.spacing.* + theme.plot.* + theme.row.borderWidth as override
 *  pins on the cssVars map. Mirrors the v3-side "spec.theme.spacing.X = N"
 *  mutation pattern so the v4 path stays in sync with v3 mutations. */
export function applySpacingPins(
  cssVars: Record<string, string>,
  theme: WebTheme,
): Record<string, string> {
  const s = theme.spacing;
  // Each pin: only override when the field is set (preserves authoringInputs
  // density when no override exists).
  const pin = (cssVar: string, value: number | undefined): void => {
    if (value === undefined) return;
    cssVars[cssVar] = `${value}px`;
  };
  pin("--tv-spacing-row-height", s.rowHeight);
  pin("--tv-spacing-header-height", s.headerHeight);
  pin("--tv-spacing-padding", s.padding);
  pin("--tv-spacing-cell-padding-x", s.cellPaddingX);
  pin("--tv-spacing-cell-padding-y", s.cellPaddingY);
  pin("--tv-spacing-axis-gap", s.axisGap);
  pin("--tv-spacing-column-group-padding", s.columnGroupPadding);
  pin("--tv-spacing-row-group-padding", s.rowGroupPadding);
  pin("--tv-spacing-header-gap", s.headerGap);
  pin("--tv-spacing-footer-gap", s.footerGap);
  pin("--tv-spacing-title-subtitle-gap", s.titleSubtitleGap);
  pin("--tv-spacing-bottom-margin", s.bottomMargin);
  pin("--tv-spacing-indent-per-level", s.indentPerLevel);
  pin("--tv-spacing-container-padding", s.containerPadding);
  // Plot dims (non-density-scaled).
  if (theme.plot?.tickMarkLength !== undefined) pin("--tv-plot-tick-mark-length", theme.plot.tickMarkLength);
  if (theme.plot?.lineWidth !== undefined) pin("--tv-plot-line-width", theme.plot.lineWidth);
  if (theme.plot?.pointSize !== undefined) pin("--tv-plot-point-size", theme.plot.pointSize);
  return cssVars;
}

/** Read a cssVar with a v3 fallback.
 *
 *  Returns `cssVars[name]` when present (the v4 path); otherwise returns
 *  the `fallback` (the v3 field read). Treats placeholder values starting
 *  with `<` (TBD / input / computed / const) as "not yet resolved" and
 *  also falls back. */
export function readVar(
  cssVars: Record<string, string>,
  name: string,
  fallback: string | null | undefined,
): string | null | undefined {
  const v = cssVars[name];
  if (v === undefined) {
    // V3 fallback path. In dev, throw if we got here — every theme that
    // ships through buildTheme has authoringInputs set, and getCssVars
    // emits the full manifest. Hitting fallback means either (a) a
    // missing manifest entry (drift gate would catch it) or (b) a code
    // path constructing a theme without authoringInputs (the cutover
    // task to find + fix).
    if (isReadVarDevThrow()) {
      throw new Error(
        `readVar: cssVar "${name}" is missing — v3 fallback path hit. ` +
        `Either the manifest doesn't declare it, or a theme was built ` +
        `without going through buildTheme/resolveTheme. Fix the missing ` +
        `cssVar; do not rely on the v3 fallback.`,
      );
    }
    return fallback;
  }
  if (v.startsWith("<")) {
    // Placeholder; resolver bug. Coh.23 already throws at the source.
    if (isReadVarDevThrow()) {
      throw new Error(
        `readVar: cssVar "${name}" resolved to placeholder "${v}". ` +
        `This is a resolver-dispatch bug — fix resolve-theme.ts.`,
      );
    }
    return fallback;
  }
  return v;
}

/** Internal toggle so the dev-throw above can be turned on/off without
 *  conditional compilation. Defaults off (preserves current behavior);
 *  the v3→v4 cutover smoke test opts in via `setReadVarDevThrow(true)`. */
let _readVarDevThrow = false;
function isReadVarDevThrow(): boolean { return _readVarDevThrow; }
export function setReadVarDevThrow(on: boolean): void { _readVarDevThrow = on; }

/** Read a dimensional (px) cssVar with a numeric v3 fallback.
 *
 *  Parses strings like `"16px"`, `"16"`, `"1.5"`, `"1.5px"` into the
 *  underlying number. Returns `fallback` when the cssVar is missing,
 *  a placeholder, or unparseable. Used for spacing/plot-dim tokens where
 *  consumers expect a `number` (e.g. `theme.plot.lineWidth: number`). */
export function readVarPx(
  cssVars: Record<string, string>,
  name: string,
  fallback: number,
): number {
  const v = cssVars[name];
  if (v === undefined) return fallback;
  if (v.startsWith("<")) return fallback;
  // Strip `px` suffix and parse. Tolerate float, integer, or numeric strings.
  const trimmed = v.endsWith("px") ? v.slice(0, -2) : v;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

/** Stage 2 §1 typography role names. */
export type TypeRoleName =
  | "title" | "subtitle" | "body" | "numeric"
  | "label" | "caption" | "footnote" | "cell" | "tick";

/** Read a typography role's `family` cssVar with v3 fallback (a
 *  font-family stack string). Stage 2 §1 migration helper. */
export function readTypeFamily(
  cssVars: Record<string, string>,
  role: TypeRoleName,
  fallback: string,
): string {
  return readVar(cssVars, `--tv-text-${role}-family`, fallback) ?? fallback;
}

/** Read a typography role's `size` cssVar as a CSS dimension string
 *  (e.g. `"14px"` or v3's `"0.875rem"`). Stage 2 §1 migration helper. */
export function readTypeSize(
  cssVars: Record<string, string>,
  role: TypeRoleName,
  fallback: string,
): string {
  return readVar(cssVars, `--tv-text-${role}-size`, fallback) ?? fallback;
}

/** Read a typography role's `weight` cssVar as a numeric font-weight.
 *  Stage 2 §1 migration helper. */
export function readTypeWeight(
  cssVars: Record<string, string>,
  role: TypeRoleName,
  fallback: number,
): number {
  const v = cssVars[`--tv-text-${role}-weight`];
  if (v === undefined || v.startsWith("<")) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ────────────────────────────────────────────────────────────────────────────
// V3→V4 cutover helpers — color clusters.
//
// Each cluster (content / divider / accent / surface / row) gets a tiny
// helper that wraps the cssVar read with a literal sensible fallback.
// The fallback exists only for type safety (string return); per the
// readVar dev-throw + render-smoke gate (test-render-smoke.R), it never
// fires in production flows — every renderer-mounted theme has
// `authoringInputs` set, which guarantees the full v4 manifest is in
// cssVars. The literal defaults are sized for a generic editorial
// light-theme (cochrane-shaped) so any future surprise fallback at
// least renders something legible rather than transparent.
// ────────────────────────────────────────────────────────────────────────────

/** Read --tv-text (body/cell foreground). Replaces v3 `theme.content.primary`. */
export function readContentPrimary(cssVars: Record<string, string>): string {
  return readVar(cssVars, "--tv-text", "#1a1a1a") ?? "#1a1a1a";
}

/** Read --tv-text-muted. Replaces v3 `theme.content.secondary`. */
export function readContentSecondary(cssVars: Record<string, string>): string {
  return readVar(cssVars, "--tv-text-muted", "#666666") ?? "#666666";
}

/** Read --tv-text-subtle. Replaces v3 `theme.content.muted`. */
export function readContentMuted(cssVars: Record<string, string>): string {
  return readVar(cssVars, "--tv-text-subtle", "#999999") ?? "#999999";
}

/** Read --tv-cell-border. Replaces v3 `theme.divider.subtle`. */
export function readDividerSubtle(cssVars: Record<string, string>): string {
  return readVar(cssVars, "--tv-cell-border", "#e5e5e5") ?? "#e5e5e5";
}

/** Read --tv-border. Replaces v3 `theme.divider.strong`. */
export function readDividerStrong(cssVars: Record<string, string>): string {
  return readVar(cssVars, "--tv-border", "#999999") ?? "#999999";
}

/** Read --tv-accent. Replaces v3 `theme.accent.default`. */
export function readAccentDefault(cssVars: Record<string, string>): string {
  return readVar(cssVars, "--tv-accent", "#0066CC") ?? "#0066CC";
}

/** Read --tv-surface-bg. Replaces v3 `theme.surface.base`. */
export function readSurfaceBg(cssVars: Record<string, string>): string {
  return readVar(cssVars, "--tv-surface-bg", "#FFFFFF") ?? "#FFFFFF";
}

/** Read --tv-row-alt-bg. Replaces v3 `theme.row.alt.bg`. */
export function readRowAltBg(cssVars: Record<string, string>): string {
  return readVar(cssVars, "--tv-row-alt-bg", "#F7F7F7") ?? "#F7F7F7";
}

// Typography shorthand helpers — eliminate the most common v3 paths
// (theme.text.body.family, theme.text.body.size, theme.text.label.size,
// theme.text.cell.size). All return CSS-dimension strings to match the
// type expected by SVG attribute interpolation and the parseFontSize
// utility.

/** Read --tv-text-body-family. Replaces v3 `theme.text.body.family`. */
export function readBodyFamily(cssVars: Record<string, string>): string {
  return readTypeFamily(cssVars, "body",
    "system-ui, -apple-system, sans-serif");
}

/** Read --tv-text-body-size. Replaces v3 `theme.text.body.size` (a
 *  dimension string the consumer normally passes to parseFontSize). */
export function readBodySize(cssVars: Record<string, string>): string {
  return readTypeSize(cssVars, "body", "14px");
}

/** Read --tv-text-label-size. Replaces v3 `theme.text.label.size`. */
export function readLabelSize(cssVars: Record<string, string>): string {
  return readTypeSize(cssVars, "label", "10.5px");
}

/** Read --tv-text-cell-size. Replaces v3 `theme.text.cell.size`. */
export function readCellSize(cssVars: Record<string, string>): string {
  return readTypeSize(cssVars, "cell", "14px");
}

// V4-substrate convenience accessors that pull from authoringInputs +
// the v4 ramps. These give consumers a clean alternative to the v3
// `ResolvedInputs` compat shim (theme-resolved.ts).

import { applyPolarityToInputs } from "./resolve-theme";
import { buildRamps } from "./theme-resolve";
import { rampStep } from "../oklch";

/** Series anchor palette — 5 brand/accent ramp grades that drive the
 *  pooled-effect series-slot fills. Replaces v3 `theme.inputs.seriesAnchors`.
 *  Returns an empty array when authoringInputs is unavailable. */
export function readSeriesAnchors(theme: WebTheme | null | undefined): string[] {
  if (!theme?.authoringInputs) return [];
  const reflected = applyPolarityToInputs(theme.authoringInputs);
  const ramps = buildRamps(reflected);
  return [
    rampStep(ramps.brand, 9),
    rampStep(ramps.accent, 9),
    rampStep(ramps.brand, 7),
    rampStep(ramps.accent, 7),
    rampStep(ramps.brand, 5),
  ];
}

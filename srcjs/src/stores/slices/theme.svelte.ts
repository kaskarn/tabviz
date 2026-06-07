// Theme slice — preset/object swaps, deep field edits, override tracking,
// and split-widget snapshot persistence.
//
// Owns:
//   - themeEdits        section -> field -> value map (for source-gen)
//   - themeOverrides    Set<dotted-path> of user-overridden paths
//   - baseThemeName     name of the active preset / custom theme
//   - initialTheme      "clean" theme as of the last setSpec / theme swap
//                       (used by resetThemeEdits — preserves any R-side
//                       pre-customization that the bare preset would drop)
//   - initialWatermark  initial watermark text (same reset semantics)
//
// Dependencies (injected):
//   - getSpec / setSpec        — theme mutations write back through spec
//   - clearAutoWidthsKeepingUserResizes / measureAutoColumns
//                              — width-affecting edits invalidate cached
//                                column auto-widths; stays as a closure
//                                until columns slice ships
//   - appendOp                 — push setTheme / setWatermark records
//
// Extracted from tabvizStore.svelte.ts in Phase 0c-C1 PR2. See
// docs/dev/store-decomposition-idiom.md for the slice idiom.
//
// Watermark mutations (setWatermark / previewWatermark / colour / opacity)
// are spec-level and stay in the main factory; they touch `spec` but not
// theme state. `initialWatermark` lives here only because `resetThemeEdits`
// restores it alongside the theme — once the data slice ships, the
// initial-* capture migrates with `setSpec`.

import type { WebSpec } from "$types";
import type { ThemeInputs } from "$types/theme-inputs";
import { THEME_PRESETS, type ThemeName } from "$lib/theme/theme-presets";
import { buildTheme } from "$lib/theme/theme-adapter";
import { ops, type OpRecord } from "$lib/op-recorder";

/** Sections whose edits change text metrics or cell geometry; changing any
 *  field in these invalidates cached auto-widths. Banding/colors/axis are
 *  paint-only and don't affect widths, so they stay out of this list. */
const WIDTH_AFFECTING_SECTIONS = new Set(["typography", "spacing", "shapes"]);

/** Within `spacing`, only x-axis padding fields actually change column
 *  widths. rowHeight / headerHeight / footerGap / titleSubtitleGap /
 *  headerGap / bottomMargin / axisGap / indentPerLevel are vertical or
 *  geometry-only — remeasuring on those fires off needless work mid-
 *  drag and was the source of the "row-resize transiently collapses
 *  columns" symptom. */
const SPACING_WIDTH_FIELDS = new Set([
  "cellPaddingX",
  "padding",
  "containerPadding",
  "columnGroupPadding",
  "groupPadding",
  "rowGroupPadding",
]);

function spacingFieldAffectsWidth(field: string | undefined): boolean {
  return field == null ? true : SPACING_WIDTH_FIELDS.has(field);
}

export interface ThemeSnapshot {
  theme: WebSpec["theme"];
  themeEdits: Record<string, Record<string, unknown>>;
  themeOverrides: string[];
  baseThemeName: string;
}

export interface ThemeSliceDeps {
  getSpec: () => WebSpec | null;
  setSpec: (next: WebSpec) => void;
  clearAutoWidthsKeepingUserResizes: () => void;
  measureAutoColumns: () => void;
  appendOp: (record: OpRecord) => void;
  /** Dirty-gate probes for edits owned by OTHER slices that the settings
   *  panel's Reset button also clears (row-height pins live on the
   *  layout-zoom slice; banding overrides on the data slice). Without
   *  them `hasThemeEdits` under-reported: the Reset button stayed
   *  disabled while those edits were active, yet confirmReset clears
   *  them (R3 studio wiring — Reset gate/action asymmetry). */
  hasRowKindHeightPins: () => boolean;
  hasBandingOverride: () => boolean;
}

export interface ThemeSlice {
  readonly themeEdits: Record<string, Record<string, unknown>>;
  readonly themeOverrides: Set<string>;
  readonly baseThemeName: string;
  readonly initialTheme: WebSpec["theme"] | null;
  readonly initialWatermark: string | undefined;
  /** THEME-scoped dirty: authoring-input edits or themeEdits pins.
   *  Figure-scoped state (watermark, banding, row pins) is hasFigureEdits
   *  — the settings panel's THEME/FIGURE seam gives each its own reset
   *  (settings-overhaul P2). */
  readonly hasThemeEdits: boolean;
  /** FIGURE-scoped dirty: watermark drift + banding override + row-height
   *  pins. Matches exactly what resetFigure() undoes. */
  readonly hasFigureEdits: boolean;

  /** Capture the "clean" theme + watermark at setSpec / setThemeObject /
   *  setTheme time. Clears themeEdits/themeOverrides. Used both when a
   *  new spec arrives and when a preset/object swap establishes a new
   *  reset target. */
  captureInitial: (spec: WebSpec) => void;
  /** Clear initial-* and edit-tracking state. Called from `resetState()`
   *  in the main factory so a full reset wipes the snapshot too. */
  clearInitial: () => void;

  cloneTheme: (t: WebSpec["theme"]) => WebSpec["theme"];
  setTheme: (themeName: ThemeName) => void;
  setThemeObject: (theme: WebSpec["theme"]) => void;
  /** V3 authoring path: merge a partial ThemeInputs over the current
   *  theme's authoringInputs, rebuild the resolved theme via the adapter,
   *  and write back. Used by the V3 Theme settings panel. */
  setAuthoringInputs: (partial: Partial<ThemeInputs>) => void;
  previewAuthoringInputs: (partial: Partial<ThemeInputs>) => void;
  previewThemeField: (section: string, field: string, value: unknown) => void;
  setThemeField: (...args: unknown[]) => void;
  setThemeFieldDerived: (path: (string | number)[], value: unknown) => void;
  isOverridden: (path: (string | number)[]) => boolean;
  clearOverride: (path: (string | number)[]) => void;
  resetThemeEdits: () => void;
  resetWatermark: () => void;
  captureThemeSnapshot: () => ThemeSnapshot | null;
  applyThemeSnapshot: (snap: ThemeSnapshot) => void;
  /** Lighter than `resetThemeEdits` — wipes the tracking maps without
   *  touching spec. Used by `resetState()` to start fresh on the new
   *  initial-theme block. */
  reset: () => void;
}

export function createThemeSlice(deps: ThemeSliceDeps): ThemeSlice {
  // REPLACE-only state (per audit): use `$state.raw` to skip proxy wrap.
  // The `$state.snapshot(themeEdits)` call later in this file (for
  // structuredClone safety during split-widget snapshot persistence)
  // continues to work — `$state.snapshot` is a no-op on raw signals.
  let themeEdits = $state.raw<Record<string, Record<string, unknown>>>({});
  let baseThemeName = $state<string>("default");
  let themeOverrides = $state.raw<Set<string>>(new Set());
  let initialTheme = $state.raw<WebSpec["theme"] | null>(null);
  // Authoring-input edits (polarity/density via the cog drawer) bypass
  // the themeEdits map entirely, so the Reset gate never saw them and
  // the button stayed disabled for the everyday drawer's own edits (R2
  // UX review #1). A plain dirty flag is exact for the gate's purpose.
  let authoringEdited = $state(false);
  let initialWatermark = $state<string | undefined>(undefined);
  let initialWatermarkColor = $state<string | undefined>(undefined);
  let initialWatermarkOpacity = $state<number | undefined>(undefined);

  function cloneTheme(t: WebSpec["theme"]): WebSpec["theme"] {
    return JSON.parse(JSON.stringify(t));
  }

  function pathKey(path: (string | number)[]): string {
    return path.map(String).join(".");
  }

  function writeThemePath(path: (string | number)[], value: unknown): void {
    const spec = deps.getSpec();
    if (!spec || !spec.theme || path.length === 0) return;
    const updateAt = (obj: unknown, p: (string | number)[]): unknown => {
      const key = p[0];
      if (p.length === 1) {
        if (Array.isArray(obj)) {
          const next = [...obj];
          next[key as number] = value;
          return next;
        }
        return { ...(obj as Record<string, unknown>), [key as string]: value };
      }
      if (Array.isArray(obj)) {
        const next = [...obj];
        next[key as number] = updateAt(obj[key as number], p.slice(1));
        return next;
      }
      const cur = (obj as Record<string, unknown>)?.[key as string];
      return { ...(obj as Record<string, unknown>), [key as string]: updateAt(cur, p.slice(1)) };
    };
    deps.setSpec({ ...spec, theme: updateAt(spec.theme, path) as WebSpec["theme"] });
  }

  function captureInitial(spec: WebSpec): void {
    authoringEdited = false;
    initialTheme = cloneTheme(spec.theme);
    initialWatermark = spec.watermark ?? "";
    initialWatermarkColor = spec.watermarkColor;
    initialWatermarkOpacity = spec.watermarkOpacity;
    baseThemeName = spec.theme?.name ?? "default";
    themeEdits = {};
    themeOverrides = new Set();
  }

  function clearInitial(): void {
    initialTheme = null;
    initialWatermark = undefined;
    initialWatermarkColor = undefined;
    initialWatermarkOpacity = undefined;
  }

  function setTheme(themeName: ThemeName): void {
    const spec = deps.getSpec();
    const newTheme = THEME_PRESETS[themeName];
    if (!spec || !newTheme) return;
    // Deep-clone so subsequent in-panel edits don't mutate the shared preset
    // object (THEME_PRESETS is a module-level singleton).
    const cleanTheme = cloneTheme(newTheme);
    deps.setSpec({ ...spec, theme: cleanTheme });
    baseThemeName = themeName;
    themeEdits = {};
    // Refresh the reset target — a preset swap supersedes whatever was there.
    initialTheme = cloneTheme(cleanTheme);
    // Fonts / sizes / padding likely differ from the previous theme, so
    // every auto-width measurement is stale. Invalidate and re-run, but
    // preserve user-resized entries (measureAutoColumns skips those).
    deps.clearAutoWidthsKeepingUserResizes();
    deps.measureAutoColumns();
    deps.appendOp(ops.setTheme(themeName));
  }

  // Write `value` into `obj` at `path`, returning a new object (immutable
  // path-write). Mirrors the inline updater in `writeThemePath`.
  function writePathImmutable(obj: unknown, path: (string | number)[], value: unknown): unknown {
    if (path.length === 0) return obj;
    const key = path[0];
    if (path.length === 1) {
      if (Array.isArray(obj)) {
        const next = [...obj];
        next[key as number] = value;
        return next;
      }
      return { ...(obj as Record<string, unknown>), [key as string]: value };
    }
    if (Array.isArray(obj)) {
      const next = [...obj];
      next[key as number] = writePathImmutable(obj[key as number], path.slice(1), value);
      return next;
    }
    const cur = (obj as Record<string, unknown>)?.[key as string];
    return {
      ...(obj as Record<string, unknown>),
      [key as string]: writePathImmutable(cur, path.slice(1), value),
    };
  }

  // Re-apply themeEdits onto a freshly-built theme so pinned T2/T3 fields
  // (paper, ink_muted, header.bold.bg, etc.) survive an authoringInputs
  // rebuild — brand swap + dark-mode toggle leave per-cluster fine-tunes
  // intact, matching the V3 wire-format "pins survive re-resolution" spec.
  function reapplyEdits(theme: WebSpec["theme"]): WebSpec["theme"] {
    let next: unknown = theme;
    for (const [section, fields] of Object.entries(themeEdits)) {
      for (const [field, value] of Object.entries(fields)) {
        const path: (string | number)[] = field.includes(".")
          ? [section, ...field.split(".")]
          : [section, field];
        next = writePathImmutable(next, path, value);
      }
    }
    return next as WebSpec["theme"];
  }

  // V3 authoring path — merges a partial ThemeInputs over the current
  // theme's authoringInputs, rebuilds the resolved theme via buildTheme(),
  // re-applies tracked pins, and writes back. Theme name is preserved so
  // the source emitter still matches presets when the inputs happen to
  // round-trip to a known one.
  function setAuthoringInputs(partial: Partial<ThemeInputs>): void {
    authoringEdited = true;
    const spec = deps.getSpec();
    if (!spec || !spec.theme) return;
    const current = (spec.theme as { authoringInputs?: ThemeInputs }).authoringInputs;
    if (!current) return;
    const merged: ThemeInputs = { ...current, ...partial };
    const name = spec.theme.name ?? "custom";
    const rebuilt = reapplyEdits(buildTheme(merged, name) as WebSpec["theme"]);
    deps.setSpec({ ...spec, theme: rebuilt });
    // Identity changes (mode, brand, decorative, density) can shift text
    // metrics + cell paint. Invalidate auto-widths; user-resized columns
    // stay frozen.
    deps.clearAutoWidthsKeepingUserResizes();
    deps.measureAutoColumns();
  }

  // C53 (wire-audit Pass 4a): drag-time preview path. Identical cascade
  // re-resolve to setAuthoringInputs but SKIPS the column re-measure —
  // anchor-color edits don't change text metrics, and re-measuring every
  // column per slider tick was the fps trap the Round-3 architecture
  // review flagged. Callers commit via setAuthoringInputs on pointer-up.
  function previewAuthoringInputs(partial: Partial<ThemeInputs>): void {
    const spec = deps.getSpec();
    if (!spec || !spec.theme) return;
    const current = (spec.theme as { authoringInputs?: ThemeInputs }).authoringInputs;
    if (!current) return;
    const merged: ThemeInputs = { ...current, ...partial };
    const name = spec.theme.name ?? "custom";
    const rebuilt = reapplyEdits(buildTheme(merged, name) as WebSpec["theme"]);
    deps.setSpec({ ...spec, theme: rebuilt });
  }

  // Swap in a WebTheme object (for `enable_themes = list(...)` custom themes)
  // without disturbing any interactive column/row edits. Callers used to go
  // through setSpec({...spec, theme}) for this, which cleared the edits map.
  function setThemeObject(theme: WebSpec["theme"]): void {
    const spec = deps.getSpec();
    if (!spec) return;
    const cleanTheme = cloneTheme(theme);
    deps.setSpec({ ...spec, theme: cleanTheme });
    baseThemeName = theme?.name ?? "default";
    themeEdits = {};
    initialTheme = cloneTheme(cleanTheme);
    deps.clearAutoWidthsKeepingUserResizes();
    deps.measureAutoColumns();
  }

  /**
   * Live-preview a single theme field during a drag without recording
   * the edit or invalidating column widths.
   *
   * Must reassign the spec (via writeThemePath) rather than mutating in
   * place — `spec` is held as `$state.raw`, so deep mutations are
   * invisible to reactivity and the UI wouldn't repaint until commit.
   * `setColumnWidth`'s preview works on direct mutation because
   * `columnWidths` is a regular (deep-proxied) `$state`, not raw.
   */
  function previewThemeField(section: string, field: string, value: unknown): void {
    writeThemePath([section, field], value);
  }

  function setThemeField(...args: unknown[]): void {
    const spec = deps.getSpec();
    if (!spec || !spec.theme) return;
    let path: (string | number)[];
    let value: unknown;
    if (args.length === 3 && typeof args[0] === "string" && typeof args[1] === "string") {
      path = [args[0] as string, args[1] as string];
      value = args[2];
    } else if (args.length === 2 && Array.isArray(args[0])) {
      path = args[0] as (string | number)[];
      value = args[1];
    } else {
      return;
    }
    if (path.length === 0) return;

    writeThemePath(path, value);

    // Mark this path as a user-set override.
    themeOverrides = new Set(themeOverrides);
    themeOverrides.add(pathKey(path));

    // Track for source-gen. Group by top-level path step.
    const section = String(path[0]);
    const nextEdits = { ...themeEdits };
    if (path.length === 2 && typeof path[1] === "string") {
      nextEdits[section] = { ...(nextEdits[section] ?? {}), [path[1] as string]: value };
    } else {
      // Deep edit — store under a nested-path key.
      const subKey = path.slice(1).map(String).join(".");
      nextEdits[section] = { ...(nextEdits[section] ?? {}), [subKey]: value };
    }
    themeEdits = nextEdits;

    if (WIDTH_AFFECTING_SECTIONS.has(section)) {
      const field = path.length >= 2 && typeof path[1] === "string"
        ? (path[1] as string)
        : undefined;
      if (section !== "spacing" || spacingFieldAffectsWidth(field)) {
        deps.clearAutoWidthsKeepingUserResizes();
        deps.measureAutoColumns();
      }
    }
  }

  function setThemeFieldDerived(path: (string | number)[], value: unknown): void {
    const spec = deps.getSpec();
    if (!spec || !spec.theme || path.length === 0) return;
    if (themeOverrides.has(pathKey(path))) return;
    writeThemePath(path, value);
  }

  function isOverridden(path: (string | number)[]): boolean {
    return themeOverrides.has(pathKey(path));
  }

  function clearOverride(path: (string | number)[]): void {
    if (!themeOverrides.has(pathKey(path))) return;
    const next = new Set(themeOverrides);
    next.delete(pathKey(path));
    themeOverrides = next;

    // Also drop the value from themeEdits so a subsequent rebuild via
    // setAuthoringInputs() doesn't re-apply it. Without this, "Reset"
    // would clear the override flag but the value would stick.
    if (path.length >= 2) {
      const section = String(path[0]);
      const subKey = path.length === 2 ? String(path[1]) : path.slice(1).map(String).join(".");
      if (themeEdits[section] && subKey in themeEdits[section]) {
        const nextSection = { ...themeEdits[section] };
        delete nextSection[subKey];
        const nextEdits = { ...themeEdits };
        if (Object.keys(nextSection).length === 0) delete nextEdits[section];
        else nextEdits[section] = nextSection;
        themeEdits = nextEdits;
      }
    }

    // Re-derive: rebuild from current authoring inputs so the cleared
    // field reverts to its cascade-computed value. Re-applies any
    // remaining pins on top.
    const spec = deps.getSpec();
    const hasAuthoring = spec?.theme &&
      (spec.theme as { authoringInputs?: ThemeInputs }).authoringInputs != null;
    if (hasAuthoring) setAuthoringInputs({});
  }

  function resetThemeEdits(): void {
    authoringEdited = false;
    const spec = deps.getSpec();
    if (!spec) return;
    if (initialTheme) {
      deps.setSpec({ ...spec, theme: cloneTheme(initialTheme) });
    }
    themeEdits = {};
    // Override tracking must reset with the values it tracks — a stale
    // themeOverrides set made post-reset cascade edits skip fields that
    // looked "user-pinned" but had just been reverted.
    themeOverrides = new Set();
  }

  /** Restore the watermark trio to its captured initial — the theme-slice
   *  half of the FIGURE reset (banding + row pins live on their own
   *  slices; the panel's resetFigure orchestrates all three). */
  function resetWatermark(): void {
    const spec = deps.getSpec();
    if (!spec || initialWatermark === undefined) return;
    deps.setSpec({
      ...spec,
      watermark: initialWatermark,
      watermarkColor: initialWatermarkColor,
      watermarkOpacity: initialWatermarkOpacity,
    });
  }

  function captureThemeSnapshot(): ThemeSnapshot | null {
    const spec = deps.getSpec();
    if (!spec || !spec.theme) return null;
    return {
      theme: cloneTheme(spec.theme),
      // `themeEdits` is a `$state` proxy; structuredClone can throw
      // DataCloneError on the proxy itself (DOMException, even when
      // contents are plain). `$state.snapshot()` is Svelte 5's
      // canonical "unwrap to plain value" — produces a structured-
      // cloneable copy that we own.
      themeEdits: $state.snapshot(themeEdits) as Record<string, Record<string, unknown>>,
      themeOverrides: Array.from(themeOverrides),
      baseThemeName,
    };
  }

  function applyThemeSnapshot(snap: ThemeSnapshot): void {
    const spec = deps.getSpec();
    if (!spec) return;
    deps.setSpec({ ...spec, theme: cloneTheme(snap.theme) });
    // snap.themeEdits was unwrapped via $state.snapshot at capture
    // time, so it's already plain. structuredClone works here, but
    // a shallow walk is enough — $state(...) re-proxies on assign.
    themeEdits = JSON.parse(JSON.stringify(snap.themeEdits));
    themeOverrides = new Set(snap.themeOverrides);
    baseThemeName = snap.baseThemeName;
    deps.clearAutoWidthsKeepingUserResizes();
    deps.measureAutoColumns();
  }

  function reset(): void {
    themeEdits = {};
    themeOverrides = new Set();
    baseThemeName = "default";
    // initialTheme / initialWatermark stay — `resetState()` calls
    // `clearInitial()` separately if it wants them gone. This keeps
    // `resetThemeEdits()` (panel Reset button) safe to call repeatedly
    // without losing the spec's reset target.
  }

  return {
    get themeEdits() { return themeEdits; },
    get themeOverrides() { return themeOverrides; },
    get baseThemeName() { return baseThemeName; },
    get initialTheme() { return initialTheme; },
    get initialWatermark() { return initialWatermark; },
    get hasThemeEdits() {
      if (authoringEdited) return true;
      for (const key of Object.keys(themeEdits)) {
        if (Object.keys(themeEdits[key] ?? {}).length > 0) return true;
      }
      return false;
    },
    get hasFigureEdits() {
      const spec = deps.getSpec();
      if (initialWatermark !== undefined && (spec?.watermark ?? "") !== initialWatermark) {
        return true;
      }
      if (initialWatermark !== undefined && (
        (spec?.watermarkColor ?? null) !== (initialWatermarkColor ?? null) ||
        (spec?.watermarkOpacity ?? null) !== (initialWatermarkOpacity ?? null)
      )) {
        return true;
      }
      if (deps.hasRowKindHeightPins()) return true;
      if (deps.hasBandingOverride()) return true;
      return false;
    },

    captureInitial, clearInitial,
    cloneTheme, setTheme, setThemeObject, setAuthoringInputs, previewAuthoringInputs, previewThemeField,
    setThemeField, setThemeFieldDerived, isOverridden, clearOverride,
    resetThemeEdits, resetWatermark, captureThemeSnapshot, applyThemeSnapshot,
    reset,
  };
}

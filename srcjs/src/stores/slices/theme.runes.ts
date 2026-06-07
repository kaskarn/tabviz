// Unit tests for the theme slice (Phase 0c-C1 PR2).
//
// Tests exercise the slice in isolation by passing stub deps that
// emulate a tiny "spec" closure and verify the column-measurement
// callbacks fire on width-affecting edits.

import { describe, expect, test } from "vitest";
import { createThemeSlice } from "./theme.svelte";
import { buildTheme } from "$lib/theme/theme-adapter";
import { PRESETS } from "$lib/theme/theme-presets-inputs";
import { THEME_PRESETS } from "$lib/theme/theme-presets";
import type { WebSpec } from "$types";
import type { OpRecord } from "$lib/op-recorder";

function buildDeps(initialSpec?: WebSpec) {
  let spec: WebSpec | null = initialSpec ?? null;
  const opLog: OpRecord[] = [];
  const calls = { clearAuto: 0, measure: 0 };
  // Cross-slice dirty probes (mutable so tests can simulate row-height
  // pins / banding overrides owned by other slices).
  const probes = { rowKindPins: false, banding: false };
  const deps = {
    getSpec: () => spec,
    setSpec: (next: WebSpec) => { spec = next; },
    clearAutoWidthsKeepingUserResizes: () => { calls.clearAuto++; },
    measureAutoColumns: () => { calls.measure++; },
    appendOp: (r: OpRecord) => { opLog.push(r); },
    hasRowKindHeightPins: () => probes.rowKindPins,
    hasBandingOverride: () => probes.banding,
  };
  return {
    deps,
    opLog,
    calls,
    probes,
    get spec() { return spec; },
  };
}

function buildSpec(theme = THEME_PRESETS.cochrane, watermark: string | undefined = undefined): WebSpec {
  return {
    version: "1.0",
    data: { rows: [], groups: [], summaries: [] },
    columns: [],
    theme,
    watermark,
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableSelect: true, enableHover: true,
      enableResize: true, enableExport: true,
      enableFilters: false, enableReorderRows: true,
      enableReorderColumns: false, enableEdit: false,
    },
    layout: { plotWidth: "auto" },
  };
}

describe("theme slice — captureInitial / clearInitial", () => {
  test("captureInitial seeds baseThemeName from spec.theme.name", () => {
    const initial = buildSpec(THEME_PRESETS.jama);
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    expect(theme.baseThemeName).toBe(initial.theme.name ?? "default");
    expect(theme.initialTheme).not.toBeNull();
    expect(theme.themeEdits).toEqual({});
    expect(theme.themeOverrides.size).toBe(0);
  });

  test("captureInitial stores watermark, undefined → empty string", () => {
    const initial = buildSpec(THEME_PRESETS.cochrane, "draft");
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    expect(theme.initialWatermark).toBe("draft");
    theme.captureInitial(buildSpec());
    expect(theme.initialWatermark).toBe("");
  });

  test("clearInitial wipes initial-* state", () => {
    const initial = buildSpec();
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    theme.clearInitial();
    expect(theme.initialTheme).toBeNull();
    expect(theme.initialWatermark).toBeUndefined();
  });
});

describe("theme slice — setTheme / setThemeObject", () => {
  test("setTheme swaps spec.theme + records op + remeasures", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setTheme("jama");
    expect(harness.spec?.theme.name).toBe(THEME_PRESETS.jama.name);
    expect(theme.baseThemeName).toBe("jama");
    expect(harness.opLog[0].kind).toBe("set_theme");
    expect(harness.calls.measure).toBe(1);
    expect(harness.calls.clearAuto).toBe(1);
  });

  test("setTheme no-ops when spec is null", () => {
    const harness = buildDeps();
    const theme = createThemeSlice(harness.deps);
    theme.setTheme("jama");
    expect(harness.spec).toBeNull();
    expect(harness.opLog).toHaveLength(0);
  });

  test("setThemeObject preserves edits map (no op-log), updates baseThemeName", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setThemeObject(THEME_PRESETS.lancet);
    expect(harness.spec?.theme.name).toBe(THEME_PRESETS.lancet.name);
    expect(theme.baseThemeName).toBe(THEME_PRESETS.lancet.name ?? "default");
    expect(harness.opLog).toHaveLength(0); // not recorded
  });
});

describe("theme slice — setThemeField + overrides", () => {
  test("setThemeField writes path + marks override + tracks edit", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setThemeField(["accent", "default"], "#ff0000");
    expect(theme.themeOverrides.has("accent.default")).toBe(true);
    expect(theme.themeEdits.accent?.default).toBe("#ff0000");
    expect(theme.isOverridden(["accent", "default"])).toBe(true);
  });

  test("setThemeField with width-affecting section triggers remeasure", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setThemeField("spacing", "cellPaddingX", 8);
    expect(harness.calls.measure).toBe(1);
  });

  test("setThemeField with non-width spacing field skips remeasure", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setThemeField("spacing", "rowHeight", 32);
    expect(harness.calls.measure).toBe(0);
  });

  test("setThemeFieldDerived skips override flagging, no-op on already-overridden", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setThemeFieldDerived(["accent", "default"], "#aabbcc");
    expect(theme.themeOverrides.has("accent.default")).toBe(false);
    // Now user overrides; derived write should no-op.
    theme.setThemeField(["accent", "default"], "#ff0000");
    theme.setThemeFieldDerived(["accent", "default"], "#000000");
    // Spec still carries the user override; derived didn't bash it.
    const spec = harness.spec as WebSpec;
    expect((spec.theme.accent as unknown as Record<string, unknown>).default).toBe("#ff0000");
  });

  test("clearOverride removes the path from the override set", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setThemeField(["accent", "default"], "#ff0000");
    expect(theme.isOverridden(["accent", "default"])).toBe(true);
    theme.clearOverride(["accent", "default"]);
    expect(theme.isOverridden(["accent", "default"])).toBe(false);
  });
});

describe("theme slice — hasThemeEdits", () => {
  test("hasThemeEdits true after a setThemeField call", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    expect(theme.hasThemeEdits).toBe(false);
    theme.setThemeField(["accent", "default"], "#ff0000");
    expect(theme.hasThemeEdits).toBe(true);
  });

  test("watermark drift is FIGURE-scoped, not theme-scoped (P2 seam)", () => {
    const initial = buildSpec(THEME_PRESETS.cochrane, "");
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    expect(theme.hasFigureEdits).toBe(false);
    harness.deps.setSpec({ ...(harness.spec as WebSpec), watermark: "DRAFT" });
    expect(theme.hasFigureEdits).toBe(true);
    // The THEME gate must NOT light up for figure state.
    expect(theme.hasThemeEdits).toBe(false);
  });

  test("watermark color / opacity drift is FIGURE-scoped", () => {
    const initial = buildSpec(THEME_PRESETS.cochrane, "DRAFT");
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    expect(theme.hasFigureEdits).toBe(false);
    harness.deps.setSpec({ ...(harness.spec as WebSpec), watermarkColor: "#ff0000" });
    expect(theme.hasFigureEdits).toBe(true);
    harness.deps.setSpec({ ...(harness.spec as WebSpec), watermarkColor: undefined, watermarkOpacity: 0.5 });
    expect(theme.hasFigureEdits).toBe(true);
    expect(theme.hasThemeEdits).toBe(false);
  });

  test("hasFigureEdits folds cross-slice probes (row pins, banding)", () => {
    const initial = buildSpec();
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    expect(theme.hasFigureEdits).toBe(false);
    harness.probes.rowKindPins = true;
    expect(theme.hasFigureEdits).toBe(true);
    expect(theme.hasThemeEdits).toBe(false);
    harness.probes.rowKindPins = false;
    harness.probes.banding = true;
    expect(theme.hasFigureEdits).toBe(true);
    harness.probes.banding = false;
    expect(theme.hasFigureEdits).toBe(false);
  });
});

describe("theme slice — snapshot persistence", () => {
  test("captureThemeSnapshot returns a structured-cloneable plain object", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setThemeField(["accent", "default"], "#abcdef");
    const snap = theme.captureThemeSnapshot();
    expect(snap).not.toBeNull();
    // The Phase-0d split-widget regression: $state.snapshot must unwrap the
    // proxy so the snapshot is clone-safe.
    expect(() => structuredClone(snap)).not.toThrow();
    expect(snap?.themeEdits.accent?.default).toBe("#abcdef");
    expect(snap?.themeOverrides).toContain("accent.default");
  });

  test("applyThemeSnapshot restores theme + edits + overrides", () => {
    const harness = buildDeps(buildSpec());
    const theme = createThemeSlice(harness.deps);
    theme.setThemeField(["accent", "default"], "#abcdef");
    const snap = theme.captureThemeSnapshot()!;
    // Wipe state, then re-apply.
    theme.reset();
    expect(theme.themeOverrides.size).toBe(0);
    theme.applyThemeSnapshot(snap);
    expect(theme.themeOverrides.has("accent.default")).toBe(true);
    expect(theme.themeEdits.accent?.default).toBe("#abcdef");
  });
});

describe("theme slice — resetThemeEdits", () => {
  test("resetThemeEdits restores spec.theme only; resetWatermark restores the trio (P2 seam)", () => {
    const initial = buildSpec(THEME_PRESETS.cochrane, "");
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    theme.setThemeField(["accent", "default"], "#ff0000");
    harness.deps.setSpec({ ...(harness.spec as WebSpec), watermark: "DRAFT" });
    theme.resetThemeEdits();
    expect(theme.themeEdits).toEqual({});
    // Theme reset leaves FIGURE state alone…
    expect(harness.spec?.watermark).toBe("DRAFT");
    // …and the figure-side reset restores it.
    theme.resetWatermark();
    expect(harness.spec?.watermark).toBe("");
  });

  test("resetWatermark restores color/opacity; resetThemeEdits clears overrides", () => {
    const initial = buildSpec(THEME_PRESETS.cochrane, "DRAFT");
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    theme.setThemeField(["accent", "default"], "#ff0000");
    expect(theme.themeOverrides.size).toBeGreaterThan(0);
    harness.deps.setSpec({
      ...(harness.spec as WebSpec),
      watermarkColor: "#00ff00",
      watermarkOpacity: 0.8,
    });
    theme.resetThemeEdits();
    // Override tracking resets with the values it tracks.
    expect(theme.themeOverrides.size).toBe(0);
    theme.resetWatermark();
    expect(harness.spec?.watermarkColor).toBeUndefined();
    expect(harness.spec?.watermarkOpacity).toBeUndefined();
  });
});

describe("theme slice — reset", () => {
  test("reset wipes edit tracking but preserves initialTheme", () => {
    const initial = buildSpec();
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    theme.setThemeField(["accent", "default"], "#ff0000");
    theme.reset();
    expect(theme.themeEdits).toEqual({});
    expect(theme.themeOverrides.size).toBe(0);
    expect(theme.initialTheme).not.toBeNull();
  });
});

describe("theme slice — artifact survival through Tier-1 edits (final review P1)", () => {
  // The shipped bug class: setAuthoringInputs rebuilt via the string-name
  // buildTheme form, defaulting roleOverrides/pins to {} — the FIRST
  // Tier-1 edit silently wiped any pins the theme arrived with (import,
  // R set_pin()/set_role(), studio handoff). These tests pin survival
  // across a polarity flip, the canonical full re-resolve.
  function buildArtifactSpec() {
    const themed = buildTheme(PRESETS["cochrane"]!, {
      name: "cochrane",
      roleOverrides: { "text-muted": { ramp: "brand", grade: 8 } },
      pins: { "--tv-text-footnote-size": "0.7rem" },
    }) as WebSpec["theme"];
    return buildSpec(themed);
  }

  test("pins + roleOverrides survive setAuthoringInputs polarity flip", () => {
    const initial = buildArtifactSpec();
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    theme.setAuthoringInputs({ polarity: "dark" });
    const t = harness.spec?.theme as {
      authoringInputs?: { polarity?: string };
      roleOverrides?: Record<string, unknown>;
      pins?: Record<string, string>;
    };
    expect(t.authoringInputs?.polarity).toBe("dark");
    expect(t.roleOverrides?.["text-muted"]).toEqual({ ramp: "brand", grade: 8 });
    expect(t.pins?.["--tv-text-footnote-size"]).toBe("0.7rem");
  });

  test("preview path carries the artifacts too", () => {
    const initial = buildArtifactSpec();
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    theme.previewAuthoringInputs({ polarity: "dark" });
    const t = harness.spec?.theme as { pins?: Record<string, string> };
    expect(t.pins?.["--tv-text-footnote-size"]).toBe("0.7rem");
  });

  test("clearThemePin / clearThemeRoleOverride release exactly one entry (DT-12)", () => {
    const initial = buildArtifactSpec();
    const harness = buildDeps(initial);
    const theme = createThemeSlice(harness.deps);
    theme.captureInitial(initial);
    theme.clearThemePin("--tv-text-footnote-size");
    let t = harness.spec?.theme as {
      roleOverrides?: Record<string, unknown>;
      pins?: Record<string, string>;
    };
    expect(t.pins ?? {}).toEqual({});
    expect(t.roleOverrides?.["text-muted"]).toEqual({ ramp: "brand", grade: 8 });
    theme.clearThemeRoleOverride("text-muted");
    t = harness.spec?.theme as { roleOverrides?: Record<string, unknown> };
    expect(t.roleOverrides ?? {}).toEqual({});
  });
});

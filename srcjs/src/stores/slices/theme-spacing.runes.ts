// D42 — unit tests for the sanctioned per-token spacing-override verbs on the
// theme slice. Proves they route through the authoring channel (input-only,
// DT-11-clean), clamp, preview-vs-commit correctly, and survive re-resolution.

import { describe, expect, test } from "vitest";
import { createThemeSlice } from "./theme.svelte";
import { THEME_PRESETS } from "$lib/theme/theme-presets";
import type { WebSpec } from "$types";
import type { OpRecord } from "$lib/op-recorder";

function buildDeps(initialSpec?: WebSpec) {
  let spec: WebSpec | null = initialSpec ?? null;
  const opLog: OpRecord[] = [];
  const calls = { clearAuto: 0, measure: 0 };
  const probes = { rowKindPins: false, banding: false, labels: false };
  const deps = {
    getSpec: () => spec,
    setSpec: (next: WebSpec) => { spec = next; },
    clearAutoWidthsKeepingUserResizes: () => { calls.clearAuto++; },
    measureAutoColumns: () => { calls.measure++; },
    appendOp: (r: OpRecord) => { opLog.push(r); },
    hasRowKindHeightPins: () => probes.rowKindPins,
    hasBandingOverride: () => probes.banding,
    hasLabelEdits: () => probes.labels,
  };
  return { deps, opLog, calls, probes, get spec() { return spec; } };
}

function buildSpec(theme = THEME_PRESETS.nejm): WebSpec {
  return {
    version: "1.0",
    data: { rows: [], groups: [], summaries: [] },
    columns: [],
    theme,
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableHover: true, enableResize: true,
      enableExport: true, enableFilters: false, enableReorderRows: true,
      enableReorderColumns: false, enableEdit: false,
    },
    layout: { plotWidth: "auto" },
  };
}

function setup() {
  const harness = buildDeps(buildSpec());
  const theme = createThemeSlice(harness.deps);
  theme.captureInitial(harness.spec!);
  return { harness, theme };
}

describe("setSpacingOverride", () => {
  test("writes the override to authoringInputs + resolved cluster", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("rowHeight", 44);
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toEqual({ rowHeight: 44 });
    expect(harness.spec?.theme.spacing.rowHeight).toBe(44);
  });

  test("input-only: no T3 path override recorded, but the edit is dirty", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("cellPaddingX", 3);
    expect(theme.themeOverrides.size).toBe(0); // never touched setThemeField
    expect(harness.spec?.theme.spacing.cellPaddingX).toBe(3);
  });

  test("clamps out-of-bounds; non-finite is a no-op", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("rowHeight", 9999); // max 120
    expect(harness.spec?.theme.spacing.rowHeight).toBe(120);
    const before = harness.spec?.theme.authoringInputs?.spacing_overrides;
    theme.setSpacingOverride("rowHeight", NaN);
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toEqual(before); // unchanged
  });

  test("commit remeasures for a width-affecting token", () => {
    const { harness, theme } = setup();
    const before = harness.calls.measure;
    theme.setSpacingOverride("cellPaddingX", 4); // width-affecting
    expect(harness.calls.measure).toBeGreaterThan(before);
  });
});

describe("previewSpacingOverride", () => {
  test("updates the resolved cluster but does NOT remeasure (drag path)", () => {
    const { harness, theme } = setup();
    const before = harness.calls.measure;
    theme.previewSpacingOverride("cellPaddingX", 5);
    expect(harness.spec?.theme.spacing.cellPaddingX).toBe(5);
    expect(harness.calls.measure).toBe(before); // no remeasure mid-drag
  });
});

// Escape on a canvas seam / panel drag: the seam grammar demands the pin
// STATE come back too, not just the number — cancelling a drag on an AUTO
// token must leave it auto, or the token silently stops tracking density.
describe("cancelPreviewSpacingOverride", () => {
  test("an auto token goes back to auto (no override key left behind)", () => {
    const { harness, theme } = setup();
    const auto = harness.spec!.theme.spacing.footerGap;
    theme.previewSpacingOverride("footerGap", 21);
    theme.previewSpacingOverride("footerGap", 22);
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toEqual({ footerGap: 22 });
    theme.cancelPreviewSpacingOverride("footerGap");
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toBeUndefined();
    expect(harness.spec?.theme.spacing.footerGap).toBe(auto);
  });

  test("an already-overridden token returns to its COMMITTED value", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("footerGap", 10);
    theme.previewSpacingOverride("footerGap", 30);
    theme.cancelPreviewSpacingOverride("footerGap");
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toEqual({ footerGap: 10 });
    expect(harness.spec?.theme.spacing.footerGap).toBe(10);
  });

  test("a commit closes the session — a later stray cancel is a no-op", () => {
    const { harness, theme } = setup();
    theme.previewSpacingOverride("footerGap", 30);
    theme.setSpacingOverride("footerGap", 30);
    theme.cancelPreviewSpacingOverride("footerGap");
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toEqual({ footerGap: 30 });
  });

  test("cancel without a preview session is a no-op", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("rowHeight", 44);
    theme.cancelPreviewSpacingOverride("rowHeight");
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toEqual({ rowHeight: 44 });
  });
});

describe("clear / reset", () => {
  test("clearSpacingOverride drops one key; others survive", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("rowHeight", 44);
    theme.setSpacingOverride("footerGap", 3);
    theme.clearSpacingOverride("rowHeight");
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toEqual({ footerGap: 3 });
    expect(harness.spec?.theme.spacing.footerGap).toBe(3);
  });

  test("last cleared override → spacing_overrides becomes undefined", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("rowHeight", 44);
    theme.clearSpacingOverride("rowHeight");
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toBeUndefined();
  });

  test("resetSpacingOverrides wipes them all", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("rowHeight", 44);
    theme.setSpacingOverride("footerGap", 3);
    theme.resetSpacingOverrides();
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toBeUndefined();
  });
});

describe("composition + survival", () => {
  test("override wins over density_factor and survives a re-resolve", () => {
    const { harness, theme } = setup();
    theme.setSpacingOverride("rowHeight", 44);
    // a subsequent authoring edit re-resolves the cascade; the override holds
    theme.setAuthoringInputs({ density_factor: 1.5 });
    expect(harness.spec?.theme.spacing.rowHeight).toBe(44);
    expect(harness.spec?.theme.authoringInputs?.spacing_overrides).toEqual({ rowHeight: 44 });
  });
});

describe("spacingRoster", () => {
  test("reports resolved px + override + widthAffecting per token", () => {
    const { theme } = setup();
    theme.setSpacingOverride("cellPaddingX", 4);
    const roster = theme.spacingRoster();
    expect(roster).toHaveLength(15);
    const cpx = roster.find((r) => r.token === "cellPaddingX")!;
    expect(cpx.px).toBe(4);
    expect(cpx.overridden).toBe(true);
    expect(cpx.widthAffecting).toBe(true);
    const rh = roster.find((r) => r.token === "rowHeight")!;
    expect(rh.overridden).toBe(false);
    expect(rh.widthAffecting).toBe(false);
  });
});

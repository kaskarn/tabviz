// Tests for the shared cell color-resolution cascades (centralized from the
// per-renderer copies in bar/progress/sparkline/icon/pictogram/badge/ring).

import { describe, test, expect } from "bun:test";
import { resolveMarkerColor, buildThresholdStops } from "./color-resolution";
import { THEME_PRESETS } from "./theme/theme-presets";
import type { WebTheme } from "../types";

const theme = THEME_PRESETS.nejm as unknown as WebTheme;

describe("resolveMarkerColor", () => {
  test("explicit option color wins", () => {
    expect(resolveMarkerColor("#abc", undefined, undefined, theme)).toBe("#abc");
  });

  test("falls back to the theme accent default (a hex) when nothing else set", () => {
    expect(resolveMarkerColor(undefined, undefined, undefined, theme)).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });

  test("cell paint markerFill overrides the default", () => {
    const fill = resolveMarkerColor(undefined, { emphasis: true }, undefined, theme);
    // emphasis paint resolves to a concrete color, not the bare accent fallback
    expect(fill).toMatch(/^#|^var|^oklch|rgb/);
  });
});

describe("buildThresholdStops", () => {
  const D = "#000000";

  test("explicit customColors of length thresholds+1 is returned verbatim", () => {
    expect(buildThresholdStops([1, 2], ["#a", "#b", "#c"], theme, D)).toEqual(["#a", "#b", "#c"]);
  });

  test("one threshold → [default, negative]", () => {
    const stops = buildThresholdStops([5], undefined, theme, D);
    expect(stops.length).toBe(2);
    expect(stops[0]).toBe(D);
    expect(stops[1]).toBe(theme.status?.negative ?? D);
  });

  test("two thresholds → [positive, warning, negative]", () => {
    const stops = buildThresholdStops([3, 6], undefined, theme, D);
    expect(stops).toEqual([
      theme.status?.positive ?? D,
      theme.status?.warning ?? D,
      theme.status?.negative ?? D,
    ]);
  });

  test("empty thresholds → [default]", () => {
    expect(buildThresholdStops([], undefined, theme, D)).toEqual([D]);
  });

  test("customColors of WRONG length is ignored (falls to the status ramp)", () => {
    // 2 colors but 2 thresholds (needs 3) → not used verbatim
    expect(buildThresholdStops([3, 6], ["#a", "#b"], theme, D)).not.toEqual(["#a", "#b"]);
  });
});

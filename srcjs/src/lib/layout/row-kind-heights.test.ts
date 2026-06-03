// Tests for the row-kind height cascade (layers 1-4).

import { describe, it, expect } from "bun:test";
import {
  INTRINSIC_KIND_RATIOS,
  KIND_INHERITANCE,
  resolveRowKindRatio,
  resolveRowKindHeight,
} from "./row-kind-heights";

describe("INTRINSIC_KIND_RATIOS — layer 1 defaults", () => {
  it("spacer is 0.5 (half-height); everything else is 1.0", () => {
    expect(INTRINSIC_KIND_RATIOS.spacer).toBe(0.5);
    expect(INTRINSIC_KIND_RATIOS.data).toBe(1.0);
    expect(INTRINSIC_KIND_RATIOS.group_header).toBe(1.0);
    expect(INTRINSIC_KIND_RATIOS.summary).toBe(1.0);
    expect(INTRINSIC_KIND_RATIOS.header).toBe(1.0);
    expect(INTRINSIC_KIND_RATIOS.panel).toBe(1.0);
  });
});

describe("KIND_INHERITANCE — layer 2 graph", () => {
  it("summary inherits from data", () => {
    expect(KIND_INHERITANCE.summary).toBe("data");
  });
});

describe("resolveRowKindRatio — layered resolution", () => {
  it("with no overrides, uses intrinsic ratios", () => {
    expect(resolveRowKindRatio("data")).toBe(1.0);
    expect(resolveRowKindRatio("spacer")).toBe(0.5);
    expect(resolveRowKindRatio("summary")).toBe(1.0);
  });

  it("layer 4 (constructor) overrides intrinsic", () => {
    expect(resolveRowKindRatio("data", {
      constructorOverride: { data: 1.25 },
    })).toBe(1.25);
  });

  it("layer 3 (theme) overrides intrinsic", () => {
    expect(resolveRowKindRatio("data", {
      themeKinds: { data: { heightRatio: 1.15 } },
    })).toBe(1.15);
  });

  it("layer 4 wins over layer 3 (constructor beats theme)", () => {
    expect(resolveRowKindRatio("data", {
      themeKinds: { data: { heightRatio: 1.15 } },
      constructorOverride: { data: 1.25 },
    })).toBe(1.25);
  });

  it("layer 2 inheritance — summary inherits from data's theme value", () => {
    expect(resolveRowKindRatio("summary", {
      themeKinds: { data: { heightRatio: 1.30 } },
      // no summary entry
    })).toBe(1.30);
  });

  it("layer 2 inheritance — summary inherits from data's constructor value", () => {
    expect(resolveRowKindRatio("summary", {
      constructorOverride: { data: 1.40 },
    })).toBe(1.40);
  });

  it("summary's own value wins over inherited data value", () => {
    expect(resolveRowKindRatio("summary", {
      themeKinds: { data: { heightRatio: 1.30 } },
      constructorOverride: { summary: 1.5 },
    })).toBe(1.5);
  });

  it("constructor summary wins over both theme summary and theme data", () => {
    expect(resolveRowKindRatio("summary", {
      themeKinds: { summary: { heightRatio: 1.2 }, data: { heightRatio: 1.4 } },
      constructorOverride: { summary: 1.6 },
    })).toBe(1.6);
  });

  it("spacer doesn't inherit (intrinsic 0.5 wins when no overrides)", () => {
    // spacer has no parent in KIND_INHERITANCE, so even if data is set,
    // spacer stays at its intrinsic 0.5.
    expect(resolveRowKindRatio("spacer", {
      themeKinds: { data: { heightRatio: 1.5 } },
    })).toBe(0.5);
  });

  it("spacer with explicit theme override does honor the override", () => {
    expect(resolveRowKindRatio("spacer", {
      themeKinds: { spacer: { heightRatio: 0.75 } },
    })).toBe(0.75);
  });
});

describe("resolveRowKindHeight — full px formula", () => {
  it("with no pin, returns rowHeight × ratio", () => {
    expect(resolveRowKindHeight("data", 24, undefined)).toBe(24);
    expect(resolveRowKindHeight("spacer", 24, undefined)).toBe(12);
  });

  it("with pin, returns pin px (bypasses ratio)", () => {
    expect(resolveRowKindHeight("data", 24, 40)).toBe(40);
  });

  it("constructor override applies through to px", () => {
    expect(resolveRowKindHeight("data", 24, undefined, {
      constructorOverride: { data: 1.5 },
    })).toBe(36);
  });

  it("theme + inheritance combine to px", () => {
    expect(resolveRowKindHeight("summary", 24, undefined, {
      themeKinds: { data: { heightRatio: 1.25 } },
    })).toBe(30);
  });
});

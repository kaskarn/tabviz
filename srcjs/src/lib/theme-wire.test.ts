import { describe, it, expect } from "bun:test";
import {
  emptyWire, pin, release, isPinned,
  resolveWire, inspectLeaf,
} from "./theme-wire";
import { ref, lit } from "../types/theme-inputs";
import type { ThemeInputs } from "../types/theme-inputs";

const COCHRANE: ThemeInputs = { brand: "#0099CC", accent: "#C8553D" };

describe("emptyWire — initial state", () => {
  it("has empty pins and overrides", () => {
    const w = emptyWire(COCHRANE, "cochrane");
    expect(w.schemaVersion).toBe(3);
    expect(w.name).toBe("cochrane");
    expect(w.pins).toEqual([]);
    expect(w.overrides).toEqual({});
  });
});

describe("pin / release / isPinned", () => {
  it("pin adds path + override", () => {
    const w0 = emptyWire(COCHRANE);
    const w1 = pin(w0, "clusters.cell.fg", ref("ink_muted"));
    expect(w1.pins).toContain("clusters.cell.fg");
    expect(w1.overrides["clusters.cell.fg"]).toEqual({ ref: "ink_muted" });
  });

  it("pin is idempotent on the same path", () => {
    const w = pin(pin(emptyWire(COCHRANE), "a.b", "x"), "a.b", "x");
    expect(w.pins.length).toBe(1);
  });

  it("release removes pin + override", () => {
    const w1 = pin(emptyWire(COCHRANE), "clusters.cell.fg", ref("ink_muted"));
    const w2 = release(w1, "clusters.cell.fg");
    expect(w2.pins).toEqual([]);
    expect(w2.overrides).toEqual({});
  });

  it("release on non-pinned path is a no-op", () => {
    const w = release(emptyWire(COCHRANE), "nonexistent.path");
    expect(w.pins).toEqual([]);
  });

  it("isPinned reflects current state", () => {
    const w0 = emptyWire(COCHRANE);
    expect(isPinned(w0, "x")).toBe(false);
    const w1 = pin(w0, "x", "y");
    expect(isPinned(w1, "x")).toBe(true);
  });
});

describe("resolveWire — full build at consumption", () => {
  it("returns a ThemeStructure from empty wire", () => {
    const { theme } = resolveWire(emptyWire(COCHRANE, "cochrane"));
    expect(theme.schemaVersion).toBe(3);
    expect(theme.name).toBe("cochrane");
    expect(theme.tokens.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("applies overrides into the resolved theme", () => {
    const w = pin(emptyWire(COCHRANE), "clusters.cell.fg", lit("#FF00FF"));
    const { theme } = resolveWire(w);
    expect(theme.clusters.cell.fg).toEqual({ hex: "#FF00FF" });
  });

  it("provenance map reflects pins", () => {
    const w = pin(emptyWire(COCHRANE), "clusters.cell.fg", lit("#FF00FF"));
    const { provenance } = resolveWire(w);
    expect(provenance["clusters.cell.fg"]).toEqual({
      source: "pin",
      path: "clusters.cell.fg",
    });
  });

  it("nested-path override creates intermediate objects if needed", () => {
    const w = pin(emptyWire(COCHRANE), "roles.emphasis.fg", lit("#123456"));
    const { theme } = resolveWire(w);
    expect(theme.roles.emphasis.fg).toEqual({ hex: "#123456" });
  });
});

describe("inspectLeaf — provenance + resolved hex", () => {
  it("returns derived provenance for non-pinned leaf", () => {
    const { provenance } = inspectLeaf(emptyWire(COCHRANE), "clusters.cell.fg");
    expect(provenance.source).toBe("derived");
  });

  it("returns pin provenance for pinned leaf", () => {
    const w = pin(emptyWire(COCHRANE), "clusters.cell.fg", ref("ink_muted"));
    const { provenance } = inspectLeaf(w, "clusters.cell.fg");
    expect(provenance.source).toBe("pin");
  });

  it("resolves ColorRef to hex via the theme ramps", () => {
    const w = pin(emptyWire(COCHRANE), "clusters.cell.fg", ref("ink_muted"));
    const { theme } = resolveWire(w);
    const { resolved } = inspectLeaf(w, "clusters.cell.fg");
    expect(resolved).toBe(theme.tokens.ink_muted);
  });

  it("returns undefined for non-existent path", () => {
    const { value } = inspectLeaf(emptyWire(COCHRANE), "nonexistent.path.xyz");
    expect(value).toBeUndefined();
  });
});

describe("round-trip: pin + resolve + release + resolve", () => {
  it("pin survives serialization round trip", () => {
    const w0 = emptyWire(COCHRANE);
    const w1 = pin(w0, "clusters.row.alt.bg", ref("paper_sunken"));
    const j = JSON.stringify(w1);
    const w2 = JSON.parse(j);
    expect(w2.pins).toContain("clusters.row.alt.bg");
    expect(w2.overrides["clusters.row.alt.bg"]).toEqual({ ref: "paper_sunken" });
  });

  it("release after re-parse works", () => {
    const w1 = pin(emptyWire(COCHRANE), "x.y.z", "value");
    const parsed = JSON.parse(JSON.stringify(w1));
    const w2 = release(parsed, "x.y.z");
    expect(w2.pins).toEqual([]);
    expect(w2.overrides).toEqual({});
  });
});

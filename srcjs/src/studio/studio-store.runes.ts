// Studio store gates — the export envelope (settings-overhaul P0, DT-8/10).
//
// Every studio egress must emit the WIRE ENVELOPE
// `{$schema, name, inputs, roleOverrides}` — bare `inputs` was the shipped
// bug where spine rebinds didn't survive the studio's own Copy JSON.

import { describe, expect, test } from "vitest";
import { studioStore } from "./studio-store.svelte";
import { PRESETS } from "../lib/theme/theme-presets-inputs";
import { WIRE_SCHEMA } from "../lib/theme/theme-wire";
import { normalizeRoleOverrides } from "../lib/theme/alias";

describe("studio exportWire — the single envelope (DT-8/DT-10)", () => {
  test("envelope carries schema, name, inputs AND roleOverrides", () => {
    studioStore.init(PRESETS["cochrane"]!, "cochrane");
    studioStore.setRoleBinding("text-muted", "brand", 8);
    const wire = studioStore.exportWire();
    expect(wire).not.toBeNull();
    expect(wire!.$schema).toBe(WIRE_SCHEMA);
    expect(wire!.name).toBe("cochrane");
    expect(wire!.inputs).toBe(studioStore.inputs);
    // The portable envelope serializes role bindings as NAME aliases
    // ("brand.8"), not positional {ramp,grade} (theme-rework Wave 0).
    expect(wire!.roleOverrides["text-muted"]).toBe("brand.8");
  });

  test("self round-trip: export → re-init → rebind intact (DT-8)", () => {
    studioStore.init(PRESETS["cochrane"]!, "cochrane");
    studioStore.setRoleBinding("text-muted", "accent", 9);
    const wire = JSON.parse(JSON.stringify(studioStore.exportWire()));
    expect(wire.roleOverrides["text-muted"]).toBe("accent.9");
    // Re-import: a real importer normalizes the alias back to a coordinate
    // before seeding the store (what parseThemeWire / theme_from_wire do).
    studioStore.init(wire.inputs, wire.name, {
      roleOverrides: normalizeRoleOverrides(wire.roleOverrides) as never,
    });
    const again = studioStore.exportWire()!;
    expect(again.roleOverrides["text-muted"]).toBe("accent.9");
  });

  test("no edits → empty roleOverrides object, same envelope shape (DT-10)", () => {
    studioStore.init(PRESETS["cochrane"]!, "cochrane");
    const wire = studioStore.exportWire()!;
    expect(wire.roleOverrides).toEqual({});
    // One schema for both surfaces: the prefix artifact is the SAME
    // top-level shape, never a different envelope.
    expect(Object.keys(wire).sort()).toEqual(["$schema", "inputs", "name", "roleOverrides"]);
  });
});

describe("studio token pins (P3)", () => {
  test("setPin validates against the manifest and rides the envelope", () => {
    studioStore.init(PRESETS["cochrane"]!, "cochrane");
    expect(() => studioStore.setPin("--tv-not-a-token", "1px")).toThrow(/manifest/);
    studioStore.setPin("--tv-text-footnote-size", "0.7rem");
    const wire = studioStore.exportWire() as { pins?: Record<string, string> };
    expect(wire.pins?.["--tv-text-footnote-size"]).toBe("0.7rem");
    // contrast/validate read the PINNED cssVars
    expect(studioStore.resolved?.cssVars?.["--tv-text-footnote-size"]).toBe("0.7rem");
  });

  test("undo restores the pre-pin state; clearPin releases", () => {
    studioStore.init(PRESETS["cochrane"]!, "cochrane");
    studioStore.setPin("--tv-text-footnote-size", "0.7rem");
    expect(Object.keys(studioStore.pins)).toHaveLength(1);
    studioStore.undo();
    expect(Object.keys(studioStore.pins)).toHaveLength(0);
    studioStore.redo();
    studioStore.clearPin("--tv-text-footnote-size");
    expect(Object.keys(studioStore.pins)).toHaveLength(0);
    expect(studioStore.dirty).toBe(false);
  });
});

describe("studio handoff seeding (round-2 state review P1)", () => {
  test("seeded pins/roleOverrides live in history[0] — first undo keeps them", () => {
    // The "Edit in studio" handoff seeds an R-authored/imported theme's
    // artifacts THROUGH init. They must survive the first undo (cursor→0),
    // which previously reverted to an empty base and wiped them.
    studioStore.init(PRESETS["cochrane"]!, "cochrane", {
      roleOverrides: { "text-muted": { ramp: "brand", grade: 8 } },
      pins: { "--tv-text-footnote-size": "0.7rem" },
    });
    expect(studioStore.pins["--tv-text-footnote-size"]).toBe("0.7rem");
    expect(studioStore.roleOverrides["text-muted"]).toEqual({ ramp: "brand", grade: 8 });
    studioStore.apply({ ...studioStore.inputs!, polarity: "dark" }, "Polarity");
    studioStore.undo();
    expect(studioStore.pins["--tv-text-footnote-size"]).toBe("0.7rem");
    expect(studioStore.roleOverrides["text-muted"]).toEqual({ ramp: "brand", grade: 8 });
  });
});

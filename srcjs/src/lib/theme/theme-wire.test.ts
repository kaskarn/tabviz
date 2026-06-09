// Tests for the v4 theme-wire surface — role-binding overrides, friendly
// token-name pin lookup, error surface for off-ramp roles and non-role-
// sourced tokens, round-trip serialization.
//
// Stage 1 step 3 of the substrate sprint; supersedes the v3 dotted-path
// pin tests this file used to hold.

import { describe, it, expect } from "bun:test";
import {
  WIRE_SCHEMA,
  createWire,
  setRoleBinding,
  pinTokenByName,
  releaseRole,
  releaseAllRoles,
  isRolePinned,
  getRoleBinding,
  getRoleProvenance,
  resolveWire,
  TokenNotPinnableError,
  RoleNotBindableError,
  DEFAULT_ROLE_BINDINGS,
} from "./theme-wire";
import type { ThemeInputs } from "../../types/theme-inputs";
import { inputsFromHex } from "./theme-presets-inputs";

const COCHRANE: ThemeInputs = inputsFromHex({ brand: "#0099CC", accent: "#C8553D" });

describe("createWire — initial state", () => {
  it("has the v4 schema, name, inputs, and empty roleOverrides", () => {
    const w = createWire(COCHRANE, "nejm");
    expect(w.$schema).toBe(WIRE_SCHEMA);
    expect(w.$schema).toBe("tabviz-theme/v4");
    expect(w.name).toBe("nejm");
    expect(w.inputs).toEqual(COCHRANE);
    expect(w.roleOverrides).toEqual({});
  });

  it("defaults to name 'custom' when no name is given", () => {
    const w = createWire(COCHRANE);
    expect(w.name).toBe("custom");
  });
});

describe("setRoleBinding / releaseRole / isRolePinned / getRoleBinding", () => {
  it("setRoleBinding records a role override", () => {
    const w = setRoleBinding(createWire(COCHRANE), "surface-subtle", "neutral", 1);
    expect(w.roleOverrides["surface-subtle"]).toEqual({ ramp: "neutral", grade: 1 });
  });

  it("setRoleBinding is overwrite-safe on the same role", () => {
    const w0 = createWire(COCHRANE);
    const w1 = setRoleBinding(w0, "surface-subtle", "neutral", 1);
    const w2 = setRoleBinding(w1, "surface-subtle", "neutral", 3);
    expect(w2.roleOverrides["surface-subtle"]).toEqual({ ramp: "neutral", grade: 3 });
    expect(Object.keys(w2.roleOverrides)).toHaveLength(1);
  });

  it("releaseRole removes the role override", () => {
    const w1 = setRoleBinding(createWire(COCHRANE), "surface-subtle", "neutral", 1);
    const w2 = releaseRole(w1, "surface-subtle");
    expect(w2.roleOverrides).toEqual({});
  });

  it("releaseRole on non-pinned role is a no-op (same wire reference)", () => {
    const w0 = createWire(COCHRANE);
    const w1 = releaseRole(w0, "surface-subtle");
    expect(w1).toBe(w0);
  });

  it("releaseAllRoles clears the override map", () => {
    const w0 = createWire(COCHRANE);
    const w1 = setRoleBinding(w0, "surface", "neutral", 1);
    const w2 = setRoleBinding(w1, "border", "neutral", 7);
    const w3 = releaseAllRoles(w2);
    expect(w3.roleOverrides).toEqual({});
  });

  it("releaseAllRoles on empty wire is a no-op (same reference)", () => {
    const w0 = createWire(COCHRANE);
    expect(releaseAllRoles(w0)).toBe(w0);
  });

  it("isRolePinned reflects whether the role is in the override map", () => {
    const w0 = createWire(COCHRANE);
    expect(isRolePinned(w0, "surface-subtle")).toBe(false);
    const w1 = setRoleBinding(w0, "surface-subtle", "neutral", 1);
    expect(isRolePinned(w1, "surface-subtle")).toBe(true);
  });

  it("getRoleBinding returns override if pinned, default otherwise", () => {
    const w0 = createWire(COCHRANE);
    expect(getRoleBinding(w0, "surface")).toEqual(DEFAULT_ROLE_BINDINGS.surface);
    const w1 = setRoleBinding(w0, "surface", "neutral", 5);
    expect(getRoleBinding(w1, "surface")).toEqual({ ramp: "neutral", grade: 5 });
  });

  it("getRoleProvenance distinguishes user override from default", () => {
    const w0 = createWire(COCHRANE);
    const p0 = getRoleProvenance(w0, "surface");
    expect(p0.source).toBe("default");
    expect(p0.binding).toEqual(DEFAULT_ROLE_BINDINGS.surface);

    const w1 = setRoleBinding(w0, "surface", "neutral", 5);
    const p1 = getRoleProvenance(w1, "surface");
    expect(p1.source).toBe("override");
    expect(p1.binding).toEqual({ ramp: "neutral", grade: 5 });
  });

  it("setRoleBinding rejects grades outside [1, 11]", () => {
    const w = createWire(COCHRANE);
    expect(() => setRoleBinding(w, "surface", "neutral", 0)).toThrow(RangeError);
    expect(() => setRoleBinding(w, "surface", "neutral", 12)).toThrow(RangeError);
    expect(() => setRoleBinding(w, "surface", "neutral", 1.5)).toThrow(RangeError);
  });

  it("setRoleBinding throws RoleNotBindableError for off-ramp roles", () => {
    const w = createWire(COCHRANE);
    expect(() => setRoleBinding(w, "pos-text", "neutral", 11)).toThrow(RoleNotBindableError);
    expect(() => setRoleBinding(w, "text-onsolid", "neutral", 1)).toThrow(RoleNotBindableError);
    expect(() => setRoleBinding(w, "neg-fill", "brand", 3)).toThrow(RoleNotBindableError);
  });
});

describe("pinTokenByName — friendly lookup", () => {
  it("pins the source role for a role-sourced token", () => {
    const w0 = createWire(COCHRANE);
    const w1 = pinTokenByName(w0, "row-alt-bg", "neutral", 1);
    // Token --tv-row-alt-bg sources from role surface-subtle (Stage 1 §3c)
    expect(w1.roleOverrides["surface-subtle"]).toEqual({ ramp: "neutral", grade: 1 });
  });

  it("accepts both the bare leaf and the full cssVar", () => {
    const w0 = createWire(COCHRANE);
    const w1 = pinTokenByName(w0, "row-alt-bg", "neutral", 1);
    const w2 = pinTokenByName(w0, "--tv-row-alt-bg", "neutral", 1);
    expect(w1.roleOverrides).toEqual(w2.roleOverrides);
  });

  it("throws TokenNotPinnableError for input-sourced tokens", () => {
    const w = createWire(COCHRANE);
    // --tv-spacing-row-height sources from input.density
    expect(() => pinTokenByName(w, "spacing-row-height", "neutral", 1))
      .toThrow(TokenNotPinnableError);
  });

  it("throws TokenNotPinnableError for computed-sourced tokens", () => {
    const w = createWire(COCHRANE);
    // --tv-header-light-rule sources from role border-strong — pinnable
    // but for the error path, pick a computed one. The manifest has
    // --tv-header-text-size (not yet in the initial 40 entries) but
    // also --tv-cell-bg (const). Let's use cell-bg.
    expect(() => pinTokenByName(w, "cell-bg", "neutral", 1))
      .toThrow(TokenNotPinnableError);
  });

  it("throws TokenNotPinnableError for unknown tokens", () => {
    const w = createWire(COCHRANE);
    expect(() => pinTokenByName(w, "totally-fake-token", "neutral", 1))
      .toThrow(TokenNotPinnableError);
  });

  it("error message names the token", () => {
    const w = createWire(COCHRANE);
    try {
      pinTokenByName(w, "totally-fake-token", "neutral", 1);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TokenNotPinnableError);
      expect((e as TokenNotPinnableError).message).toContain("totally-fake-token");
    }
  });
});

describe("resolveWire — pre-step-4 behavior", () => {
  it("resolves an empty wire to a ThemeStructure", () => {
    const theme = resolveWire(createWire(COCHRANE, "nejm"));
    expect(theme.schemaVersion).toBe(4);
    expect(theme.name).toBe("nejm");
    expect(theme.tokens.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("resolves the same way regardless of role overrides (step-4 plugs them in)", () => {
    // Until step 4 of Stage 1 §40 rewrites the resolver, role overrides
    // are stored on the wire but NOT applied during resolveWire.
    const w0 = createWire(COCHRANE);
    const w1 = setRoleBinding(w0, "surface-subtle", "neutral", 1);
    const t0 = resolveWire(w0);
    const t1 = resolveWire(w1);
    // Both should resolve identically — overrides not yet enforced.
    expect(t1.tokens).toEqual(t0.tokens);
  });
});

describe("serialization round-trip", () => {
  it("wire serializes to JSON faithfully", () => {
    const w0 = createWire(COCHRANE, "test");
    const w1 = setRoleBinding(w0, "surface-subtle", "neutral", 1);
    const w2 = setRoleBinding(w1, "border", "brand", 7);
    const j = JSON.stringify(w2);
    const r = JSON.parse(j);
    expect(r.$schema).toBe(WIRE_SCHEMA);
    expect(r.name).toBe("test");
    expect(r.roleOverrides).toEqual({
      "surface-subtle": { ramp: "neutral", grade: 1 },
      border: { ramp: "brand", grade: 7 },
    });
  });
});

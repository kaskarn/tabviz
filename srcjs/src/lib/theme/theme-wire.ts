/**
 * Theme wire (v4 substrate).
 *
 * The wire is a self-contained, serializable theme. The complete authoring
 * state lives here:
 *   - `$schema`        — schema version identifier (`"tabviz-theme/v4"`)
 *   - `inputs`         — Tier-1 input values (brand, accent, fonts, mode, …)
 *   - `roleOverrides`  — user-pinned role bindings ({ramp, grade} per role)
 *
 * Wires are immutable; all mutators return a new wire. This is what makes
 * resolver memoization safe (single-slot identity cache, Stage 1 §11).
 *
 * The wire is fully serializable — no closures, no class instances. It is
 * exactly what gets written to JSON for export, sent over the htmlwidget
 * bridge, or round-tripped through R via V8.
 *
 * Override surface (Stage 1 §8–9):
 *   - Role-level overrides only — `{ramp, grade}` bound to a `RoleName`.
 *   - Token-level pinning is explicitly rejected (silently routes around
 *     the manifest's source declarations); the friendly `pinTokenByName`
 *     accepts a component-token name but resolves it to a role-level pin
 *     via the manifest's `source.role`.
 *   - Non-role-sourced tokens (status, computed, anchor, input, const)
 *     throw `TokenNotPinnableError` with an actionable message.
 *
 * NOTE (Stage 1 sprint kickoff state): `resolveWire()` still calls the
 * pre-existing `buildThemeStructure()` resolver — role overrides stored on
 * the wire are NOT yet applied during resolution. Step 4 of the substrate
 * sprint replaces the resolver with one that consumes roleOverrides and
 * emits the v4 CSS-var map via `emitCssVarsFromManifest()`.
 */

import type { ThemeInputs, ThemeStructure } from "../../types/theme-inputs";
import type { RoleName, RampName } from "../../types/theme-roles";
import { OFF_RAMP_ROLES } from "../../types/theme-roles";
import { buildThemeStructure } from "./theme-resolve";
import { TOKENS_BY_VAR } from "./component-tokens";

// ============================================================================
// SCHEMA + TYPES
// ============================================================================

/** Wire schema version. Frozen across the v4 substrate; bumps on incompatible
 *  shape changes (per Decisions log Q8 closure 2026-06-02). */
export const WIRE_SCHEMA = "tabviz-theme/v4" as const;
export type WireSchema = typeof WIRE_SCHEMA;

/** A single role binding — a pin from a role to a (ramp, grade) pair. */
export interface RoleBinding {
  readonly ramp: RampName;
  /** 1..11 (1-indexed, matches the CSS-var ramp grades). */
  readonly grade: number;
}

/** Map of pinned role bindings. Roles not in the map use defaults. */
export type RoleOverrides = Partial<Record<RoleName, RoleBinding>>;

/** The wire — the serializable theme value. */
export interface ThemeWire {
  readonly $schema: WireSchema;
  readonly name: string;
  readonly inputs: ThemeInputs;
  readonly roleOverrides: RoleOverrides;
}

/** Provenance of a role's current binding — whether the user pinned it or
 *  it's the default. The Cascade Inspector reads this to display "this is
 *  a user override" vs "this is the preset default". */
export type RoleProvenance =
  | { source: "default"; binding: RoleBinding }
  | { source: "override"; binding: RoleBinding };

// ============================================================================
// ERRORS
// ============================================================================

/** Thrown when `pinTokenByName()` is called with a token whose source isn't
 *  a Tier-2 role. The error message directs the user to the right modifier
 *  (e.g. `setBrand()` for input-sourced tokens). Per Stage 1 §9c. */
export class TokenNotPinnableError extends Error {
  readonly tokenName: string;
  constructor(tokenName: string, message: string) {
    super(message);
    this.name = "TokenNotPinnableError";
    this.tokenName = tokenName;
  }
}

/** Thrown when `setRoleBinding()` targets an off-ramp role (status, computed,
 *  text-onsolid). Off-ramp roles are anchored at Tier-1 inputs or computed at
 *  resolve time — not bindable via (ramp, grade). Per Stage 1 §26 + Q-P4.4. */
export class RoleNotBindableError extends Error {
  readonly role: RoleName;
  constructor(role: RoleName, message: string) {
    super(message);
    this.name = "RoleNotBindableError";
    this.role = role;
  }
}

// ============================================================================
// DEFAULT ROLE BINDINGS
//
// The cascade's defaults — every role's "where it lives if no override".
// Mirrors rgc_v4's DEFAULT_GRADES. Step 4 (resolver rewrite) takes ownership
// of this; for the substrate sprint kickoff it lives here so the wire layer
// can answer `getRoleBinding()` without depending on the not-yet-rewritten
// resolver. The default values are placeholders during step 3 and become
// fully authoritative once step 4 lands.
// ============================================================================

export const DEFAULT_ROLE_BINDINGS: Record<RoleName, RoleBinding> = {
  // Surface
  surface:           { ramp: "neutral", grade: 1 },
  "surface-subtle":  { ramp: "neutral", grade: 2 },
  // Fill states
  fill:              { ramp: "neutral", grade: 3 },
  "fill-hover":      { ramp: "neutral", grade: 4 },
  "fill-active":     { ramp: "neutral", grade: 5 },
  // Border
  "border-subtle":   { ramp: "neutral", grade: 6 },
  border:            { ramp: "neutral", grade: 7 },
  "border-strong":   { ramp: "neutral", grade: 8 },
  // Brand
  "brand-solid":       { ramp: "brand", grade: 9 },
  "brand-solid-hover": { ramp: "brand", grade: 10 },
  "brand-text":        { ramp: "brand", grade: 11 },
  // Text
  text:              { ramp: "neutral", grade: 11 },
  "text-muted":      { ramp: "neutral", grade: 8 },
  "text-subtle":     { ramp: "neutral", grade: 6 },
  "text-onsolid":    { ramp: "neutral", grade: 1 },  // computed at resolve; placeholder
  // Focus + highlight
  "focus-ring":      { ramp: "brand", grade: 8 },
  "highlight-bg":    { ramp: "brand", grade: 3 },    // reads alpha companion
  "highlight-bar":   { ramp: "brand", grade: 8 },
  // Accent
  "accent-fill":     { ramp: "accent", grade: 2 },
  "accent-border":   { ramp: "accent", grade: 7 },
  "accent-solid":    { ramp: "accent", grade: 9 },
  "accent-text":     { ramp: "accent", grade: 11 },
  // Status — off-ramp; placeholders only (anchored at status inputs in step 4)
  "pos-fill":        { ramp: "neutral", grade: 2 },
  "pos-solid":       { ramp: "neutral", grade: 9 },
  "pos-text":        { ramp: "neutral", grade: 11 },
  "neg-fill":        { ramp: "neutral", grade: 2 },
  "neg-solid":       { ramp: "neutral", grade: 9 },
  "neg-text":        { ramp: "neutral", grade: 11 },
  "warn-fill":       { ramp: "neutral", grade: 2 },
  "warn-text":       { ramp: "neutral", grade: 11 },
  "info-fill":       { ramp: "neutral", grade: 2 },
  "info-text":       { ramp: "neutral", grade: 11 },
  // Series slots — step 4 takes ownership; placeholders.
  "series-1-fill":   { ramp: "brand", grade: 9 },
  "series-1-stroke": { ramp: "brand", grade: 10 },
  "series-2-fill":   { ramp: "accent", grade: 9 },
  "series-2-stroke": { ramp: "accent", grade: 10 },
  "series-3-fill":   { ramp: "brand", grade: 7 },
  "series-3-stroke": { ramp: "brand", grade: 8 },
  "series-4-fill":   { ramp: "accent", grade: 7 },
  "series-4-stroke": { ramp: "accent", grade: 8 },
  "series-5-fill":   { ramp: "neutral", grade: 9 },
  "series-5-stroke": { ramp: "neutral", grade: 10 },
};

// ============================================================================
// WIRE CONSTRUCTORS + MUTATORS (all pure)
// ============================================================================

/** Construct a wire from inputs alone; no overrides. */
export function createWire(inputs: ThemeInputs, name = "custom"): ThemeWire {
  return {
    $schema: WIRE_SCHEMA,
    name,
    inputs,
    roleOverrides: {},
  };
}

/** Pin a role to a (ramp, grade) pair. Returns a new wire.
 *  Throws RoleNotBindableError if the role is off-ramp. */
export function setRoleBinding(
  wire: ThemeWire,
  role: RoleName,
  ramp: RampName,
  grade: number,
): ThemeWire {
  if (OFF_RAMP_ROLES.has(role)) {
    throw new RoleNotBindableError(
      role,
      `Role '${role}' is off-ramp (status-anchored or computed) and cannot be ` +
        `bound to a (ramp, grade) pair. Override the upstream input instead ` +
        `(e.g. setStatus("positive", "#abcdef") for pos-* roles).`,
    );
  }
  if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
    throw new RangeError(
      `Grade must be an integer in [1, 11]; got ${grade}`,
    );
  }
  return {
    ...wire,
    roleOverrides: {
      ...wire.roleOverrides,
      [role]: { ramp, grade },
    },
  };
}

/** Friendly token-name lookup. Finds the component-token in
 *  COMPONENT_TOKENS, identifies its source role, and pins that role.
 *
 *  Accepts either the bare leaf name (`"row-alt-bg"`) or the full cssVar
 *  (`"--tv-row-alt-bg"`). Throws TokenNotPinnableError for tokens whose
 *  source isn't a Tier-2 role (per Stage 1 §9c). */
export function pinTokenByName(
  wire: ThemeWire,
  tokenName: string,
  ramp: RampName,
  grade: number,
): ThemeWire {
  const cssVar = tokenName.startsWith("--tv-") ? tokenName : `--tv-${tokenName}`;
  const token = TOKENS_BY_VAR.get(cssVar);
  if (!token) {
    throw new TokenNotPinnableError(
      tokenName,
      `Token '${tokenName}' is not in COMPONENT_TOKENS. ` +
        `Use list_component_tokens() to discover available tokens.`,
    );
  }
  switch (token.source.tier) {
    case "role":
      return setRoleBinding(wire, token.source.role, ramp, grade);
    case "input":
      throw new TokenNotPinnableError(
        tokenName,
        `Token '${tokenName}' derives from input '${token.source.input}'. ` +
          `Use the appropriate input modifier (e.g. setBrand, setFonts) instead.`,
      );
    case "anchor":
      throw new TokenNotPinnableError(
        tokenName,
        `Token '${tokenName}' derives from anchor '${token.source.anchor}'. ` +
          `Modify the anchor via inputs.`,
      );
    case "computed":
      throw new TokenNotPinnableError(
        tokenName,
        `Token '${tokenName}' is computed (${token.source.note}); not pinnable. ` +
          `Change the source roles instead.`,
      );
    case "const":
      throw new TokenNotPinnableError(
        tokenName,
        `Token '${tokenName}' is a hard-coded constant (${token.source.note}); not pinnable.`,
      );
  }
}

/** Remove a role's override, falling back to its default binding. */
export function releaseRole(wire: ThemeWire, role: RoleName): ThemeWire {
  if (!(role in wire.roleOverrides)) return wire;
  const { [role]: _removed, ...rest } = wire.roleOverrides;
  void _removed;
  return { ...wire, roleOverrides: rest };
}

/** Remove all role overrides at once. */
export function releaseAllRoles(wire: ThemeWire): ThemeWire {
  if (Object.keys(wire.roleOverrides).length === 0) return wire;
  return { ...wire, roleOverrides: {} };
}

/** Is this role currently pinned (overridden)? */
export function isRolePinned(wire: ThemeWire, role: RoleName): boolean {
  return role in wire.roleOverrides;
}

/** Get the current binding for a role — override if pinned, default otherwise. */
export function getRoleBinding(wire: ThemeWire, role: RoleName): RoleBinding {
  return wire.roleOverrides[role] ?? DEFAULT_ROLE_BINDINGS[role];
}

/** Get the provenance for a role — distinguishes user override from default. */
export function getRoleProvenance(wire: ThemeWire, role: RoleName): RoleProvenance {
  const override = wire.roleOverrides[role];
  if (override) {
    return { source: "override", binding: override };
  }
  return { source: "default", binding: DEFAULT_ROLE_BINDINGS[role] };
}

// ============================================================================
// RESOLVE
// ============================================================================

/**
 * Resolve a wire to a ThemeStructure.
 *
 * SUBSTRATE SPRINT KICKOFF NOTE: this still calls the pre-v4 resolver
 * (`buildThemeStructure`) and IGNORES roleOverrides. The substrate
 * sprint's step 4 replaces this with a v4 resolver that:
 *   1. Builds ramps from inputs.
 *   2. Resolves roles using DEFAULT_ROLE_BINDINGS + wire.roleOverrides.
 *   3. Walks COMPONENT_TOKENS via emitCssVarsFromManifest to produce the
 *      CSS-var map.
 *   4. Returns a v4 ResolvedTheme (per Stage 1 §10a) instead of the v3
 *      ThemeStructure.
 *
 * Until step 4 lands, role overrides are stored on the wire but have no
 * effect on rendered output. The wire serialization/round-trip remains
 * faithful so tests can verify override storage without resolver hookup.
 */
export function resolveWire(wire: ThemeWire): ThemeStructure {
  return buildThemeStructure(wire.inputs, wire.name);
}

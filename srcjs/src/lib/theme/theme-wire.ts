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
 * Stage 1 substrate sprint state (post-merge): the actual v4 resolver
 * lives in `resolve-theme.ts::resolveTheme(wire)`, which consumes the
 * wire's `roleOverrides` and emits the cssVars map directly on the
 * returned `ResolvedTheme`. `resolveWire()` here is the legacy v3
 * resolver path kept available for callers that still consume
 * `ThemeStructure`.
 */

import type { ThemeInputs, ThemeStructure } from "../../types/theme-inputs";
import type { RoleName, RampName } from "../../types/theme-roles";
import { OFF_RAMP_ROLES } from "../../types/theme-roles";
import { buildThemeStructure } from "./theme-resolve";
import { TOKENS_BY_VAR } from "./component-tokens";
import {
  DEFAULT_ROLE_BINDINGS as DEFAULT_ROLE_BINDINGS_IMPORT,
  type RoleBinding as RoleBindingImport,
} from "./role-bindings";

/** Re-exported here so existing imports from theme-wire continue to work
 *  (the substrate consumes both surfaces). */
export const DEFAULT_ROLE_BINDINGS = DEFAULT_ROLE_BINDINGS_IMPORT;
export type RoleBinding = RoleBindingImport;

// ============================================================================
// SCHEMA + TYPES
// ============================================================================

/** Wire schema version. Frozen across the v4 substrate; bumps on incompatible
 *  shape changes (per Decisions log Q8 closure 2026-06-02). */
export const WIRE_SCHEMA = "tabviz-theme/v4" as const;
export type WireSchema = typeof WIRE_SCHEMA;

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

/** A wire that may carry token pins (the optional envelope member). */
export type PinnedThemeWire = ThemeWire & { pins?: Record<string, string> };

/** THE envelope builder (quality review: settings exportWire, the studio
 *  store, and the static download path each hand-rolled the same shape —
 *  one drift away from two envelopes). `pins` rides only when non-empty
 *  so pin-less exports stay byte-identical to the prefix artifact. */
export function buildThemeWire(
  inputs: ThemeInputs,
  name: string,
  roleOverrides: RoleOverrides = {},
  pins: Record<string, string> = {},
): PinnedThemeWire {
  const wire: PinnedThemeWire = { $schema: WIRE_SCHEMA, name, inputs, roleOverrides };
  return Object.keys(pins).length > 0 ? { ...wire, pins } : wire;
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
 * Resolve a wire to a v3 `ThemeStructure` via the legacy `buildThemeStructure`
 * path. The v4 cssVars resolver — which DOES consume `roleOverrides` and
 * emits the cssVars map directly — lives in `resolve-theme.ts::resolveTheme`.
 *
 * This function persists for callers that still want a ThemeStructure
 * (most notably the v3 deserialization path R-side). It IGNORES
 * `wire.roleOverrides` — those flow only through the v4 resolver.
 *
 * The wire serialization/round-trip remains
 * faithful so tests can verify override storage without resolver hookup.
 */
export function resolveWire(wire: ThemeWire): ThemeStructure {
  return buildThemeStructure(wire.inputs, wire.name);
}

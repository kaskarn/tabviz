// V3 paint-role resolver.
//
// Translates an active role name into a resolved SemanticBundle (hex
// values, refs dereferenced) for the renderer. Replaces the V2
// semantic-styling.ts read path; consumer cutover lands in PR I.

import type {
  WebThemeV3,
  RoleNameV3,
  PaintRoleV3,
  TokenRampsV3,
} from "../types/theme-v3";
import { resolveRef } from "./theme-resolve-v3";

/** Canonical role precedence: loud → quiet. */
export const ROLE_PRECEDENCE: ReadonlyArray<RoleNameV3> = [
  // Status roles outrank generic emphasis — they're explicit semantic intent.
  "negative",
  "positive",
  "warning",
  "info",
  // Generic emphasis ladder
  "fill",
  "accent",
  "emphasis",
  "bold",
  "muted",
];

/** Resolved role bundle — hex values, ready for inline style/SVG attribute. */
export interface ResolvedRoleBundle {
  bg: string | null;
  fg: string | null;
  border: string | null;
  markerFill: string | null;
  markerStroke: string | null;
  fontWeight: number | null;
  fontStyle: "normal" | "italic" | null;
}

/** Resolve a single paint role to a hex bundle against the theme's ramps. */
export function resolveRole(
  roleName: RoleNameV3,
  theme: WebThemeV3,
): ResolvedRoleBundle {
  const role: PaintRoleV3 = theme.roles[roleName];
  return resolveRoleRecipe(role, theme.ramps);
}

/** Resolve any role recipe against ramps. */
export function resolveRoleRecipe(
  role: PaintRoleV3,
  ramps: TokenRampsV3,
): ResolvedRoleBundle {
  return {
    bg: resolveRef(role.bg ?? null, ramps),
    fg: resolveRef(role.fg ?? null, ramps),
    border: resolveRef(role.border ?? null, ramps),
    markerFill: resolveRef(role.markerFill ?? null, ramps),
    markerStroke: resolveRef(role.markerStroke ?? null, ramps),
    fontWeight: role.fontWeight ?? null,
    fontStyle: role.fontStyle ?? null,
  };
}

/** True if at least one field of the bundle is non-null. */
export function bundleIsActive(b: ResolvedRoleBundle | null): boolean {
  if (!b) return false;
  return (
    b.bg !== null ||
    b.fg !== null ||
    b.border !== null ||
    b.markerFill !== null ||
    b.markerStroke !== null ||
    b.fontWeight !== null ||
    b.fontStyle !== null
  );
}

/** Pick the active role from a flag map, respecting precedence. */
export function activeRole(
  flags: Partial<Record<RoleNameV3, boolean>> | null | undefined,
): RoleNameV3 | null {
  if (!flags) return null;
  for (const role of ROLE_PRECEDENCE) {
    if (flags[role]) return role;
  }
  return null;
}

/**
 * Get the resolved bundle for the currently active role on a row/cell.
 * Returns null when no role is flagged active.
 */
export function resolveActiveRole(
  flags: Partial<Record<RoleNameV3, boolean>> | null | undefined,
  theme: WebThemeV3 | null | undefined,
): ResolvedRoleBundle | null {
  if (!theme) return null;
  const role = activeRole(flags);
  if (!role) return null;
  return resolveRole(role, theme);
}

/**
 * Opacity multipliers for viz marks when a role is active. Today only
 * `muted` produces non-default values (fade fill 40%, stroke 80%) —
 * status roles + emphasis/accent promote visibility, not reduce.
 */
export function roleMarkOpacity(
  flags: Partial<Record<RoleNameV3, boolean>> | null | undefined,
): { fill: number; stroke: number } | null {
  return activeRole(flags) === "muted"
    ? { fill: 0.4, stroke: 0.8 }
    : null;
}

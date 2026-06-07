// Named-alias projection for role bindings (theme-rework Wave 0).
//
// The resolver consumes role bindings as positional COORDINATES
// (`{ramp, grade}`), which is right for a generative, anchor-driven system.
// But the COORDINATE is the wrong PORTABLE contract: no external tool
// (Figma / Tokens Studio / Style Dictionary / DTCG) speaks `{ramp, grade}`,
// and a bare numeric index is opaque in a saved artifact.
//
// So we project bindings to a stable NAME at the wire boundary
// (`"neutral.5"`) and keep coordinates internal. Readers accept BOTH the
// name form and the legacy coordinate-object form (one-way migration: old
// files keep working; new files are name-shaped). What this buys: DTCG
// SHAPE (a string token reference, not an object) and rename-MIGRATABILITY
// — a future ramp re-index can ship a rename map (`neutral.5 → neutral.500`)
// that rewrites artifacts. NOTE it does NOT by itself make a binding survive
// a ramp re-TUNE: `"neutral.5"` re-targets to whatever grade 5 becomes,
// exactly as `{neutral, 5}` would. The resolver, `set_role(role, ramp,
// grade)`, and `DEFAULT_ROLE_BINDINGS` are unchanged — only the serialized
// shape changes.
//
// Round-3 design-tokens review insisted this land BEFORE the studio spine
// mounts (the spine teaches users to mint rebinds; their artifacts should be
// name-shaped from the start), and that this naming be the ONE namespace
// shared by the DTCG adapter (Wave 4).

import type { RampName } from "../../types/theme-roles";
import { ALL_RAMPS } from "../../types/theme-roles";
import type { RoleBinding } from "./role-bindings";

/** A role override entry as it may appear on the wire: the canonical NAME
 *  alias (`"neutral.5"`) or the legacy coordinate object. */
export type RoleOverrideWire = string | RoleBinding;

/** Project a coordinate binding to its stable alias name. */
export function bindingToAlias(binding: RoleBinding): string {
  return `${binding.ramp}.${binding.grade}`;
}

/** Parse an alias name back to a coordinate, or null if malformed. */
export function aliasToBinding(alias: string): RoleBinding | null {
  const dot = alias.lastIndexOf(".");
  if (dot < 1) return null;
  const ramp = alias.slice(0, dot);
  const grade = Number(alias.slice(dot + 1));
  if (!ALL_RAMPS.includes(ramp as RampName)) return null;
  if (!Number.isInteger(grade) || grade < 1 || grade > 11) return null;
  return { ramp: ramp as RampName, grade };
}

/** Normalize one wire entry (name OR coordinate object) to a coordinate.
 *  Returns null for malformed input (caller decides reject vs skip). */
export function normalizeBinding(entry: RoleOverrideWire): RoleBinding | null {
  if (typeof entry === "string") return aliasToBinding(entry);
  if (entry && typeof entry === "object" &&
      typeof (entry as RoleBinding).ramp === "string" &&
      Number.isFinite((entry as RoleBinding).grade)) {
    return { ramp: (entry as RoleBinding).ramp, grade: (entry as RoleBinding).grade };
  }
  return null;
}

/** READER: accept a roleOverrides map in EITHER form, return coordinates.
 *  Malformed entries are dropped (the value gate elsewhere reports). */
export function normalizeRoleOverrides(
  raw: Record<string, RoleOverrideWire> | undefined | null,
): Record<string, RoleBinding> {
  const out: Record<string, RoleBinding> = {};
  if (!raw) return out;
  for (const [role, entry] of Object.entries(raw)) {
    const b = normalizeBinding(entry);
    if (b) out[role] = b;
  }
  return out;
}

/** WRITER: project a coordinate roleOverrides map to name aliases for the
 *  portable wire (DTCG-shaped + rename-migratable; see module header). */
export function roleOverridesToAliases(
  ro: Record<string, RoleBinding> | undefined | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!ro) return out;
  for (const [role, b] of Object.entries(ro)) out[role] = bindingToAlias(b);
  return out;
}

// Non-color SCALE-ROLE layer (theme-rework Wave 3 — the keystone).
//
// The Tier-2 role layer for the NON-color scales (type / geometry /
// spacing), parallel to the color role layer in role-bindings.ts. Color
// roles index a generated ramp ({ramp, grade}); scale roles index a
// scale of a different kind:
//   - TYPE roles compose a {family, size, weight} recipe over the Tier-1
//     type knobs (the recipe table is typography.ts::DEFAULT_TYPE_ROLES).
//   - GEOMETRY roles are named corner/rule SLOTS (sharp/soft/round,
//     fine/normal/strong) that project onto the radius / border-width
//     scales.
//   - SPACING roles are named density-relative STEPS.
//
// Why these live on `ThemeInputs` (type_roles) / `geometry` / `density`
// rather than a separate `scaleRoles` wire field: a scale-role binding IS
// a composition of Tier-1 knobs, so it rides the existing inputs channel
// unchanged through the wire, R serialization, and the studio/widget
// stores — no parallel plumbing, no envelope bump. The "Tier-2 role"
// framing is about the RESOLVER (these resolve through an overlay table,
// rebindable + roster-visible + DTCG-named), not about a new wire location.
//
// The roster (authoring/index.ts::listRoles) surfaces these with their
// `domain` so `set_role()` and the DTCG adapter (Wave 4) share ONE
// namespace with the color roles.

import {
  DEFAULT_TYPE_ROLES,
  type TypeRole,
  type TypeRoleName,
  type SizeScaleStep,
} from "./typography";
import type { ThemeInputs } from "../../types/theme-inputs";

export type ScaleDomain = "type" | "geometry" | "spacing";

// ── TYPE ────────────────────────────────────────────────────────────────
export const TYPE_ROLE_NAMES = Object.keys(DEFAULT_TYPE_ROLES) as TypeRoleName[];

const TYPE_FAMILIES = ["display", "body", "mono", "numeric"] as const;
const TYPE_SIZES: readonly SizeScaleStep[] = [
  "label", "foot", "body", "head", "subtitle", "title", "display",
];
const TYPE_WEIGHTS = ["regular", "medium", "semibold", "bold"] as const;

/** A type role's default recipe serialized as a stable alias:
 *  `"family/size/weight"` (e.g. `"display/title/semibold"`). The `/`
 *  separators distinguish it from a color alias's `"ramp.grade"` so a
 *  reader can tell the two apart without knowing the role's domain. */
export function typeRoleToAlias(b: TypeRole): string {
  return `${b.family}/${b.size}/${b.weight}`;
}

/** Parse a `"family/size/weight"` alias back to a TypeRole, or null if
 *  malformed / out of vocabulary. */
export function aliasToTypeRole(s: string): TypeRole | null {
  const p = s.split("/");
  if (p.length !== 3) return null;
  const [family, size, weight] = p as [string, string, string];
  if (!TYPE_FAMILIES.includes(family as TypeRole["family"])) return null;
  if (!TYPE_SIZES.includes(size as SizeScaleStep)) return null;
  if (!TYPE_WEIGHTS.includes(weight as TypeRole["weight"])) return null;
  return {
    family: family as TypeRole["family"],
    size: size as SizeScaleStep,
    weight: weight as TypeRole["weight"],
  };
}

/** The EFFECTIVE type-role table: DEFAULT_TYPE_ROLES with `inputs.type_roles`
 *  overlaid per role (each field independently overridable). No overrides
 *  → returns DEFAULT_TYPE_ROLES verbatim so resolution is byte-identical
 *  (the resolver-dispatch snapshot stays stable for unedited themes). */
export function effectiveTypeRoles(
  inputs: ThemeInputs,
): Readonly<Record<TypeRoleName, TypeRole>> {
  const overrides = inputs.type_roles;
  if (!overrides || Object.keys(overrides).length === 0) return DEFAULT_TYPE_ROLES;
  const out = {} as Record<TypeRoleName, TypeRole>;
  for (const role of TYPE_ROLE_NAMES) {
    const base = DEFAULT_TYPE_ROLES[role];
    const ov = overrides[role];
    out[role] = ov
      ? {
          family: ov.family ?? base.family,
          size: ov.size ?? base.size,
          weight: ov.weight ?? base.weight,
        }
      : base;
  }
  return out;
}

// ── GEOMETRY (named corner / rule slots) ─────────────────────────────────
// Convenience slots that project onto the radius + border-width scales.
// They DON'T replace the fine-grained `inputs.geometry.{radius,border_width}`
// inputs — they're a coarse, roster-visible rebind that sets all four scale
// stops at once. A pinned fine-grained value still wins (it's set on the same
// inputs.geometry object after the slot expands).

export type CornerSlot = "sharp" | "soft" | "round";
export type RuleSlot = "fine" | "normal" | "strong";

export const CORNER_SLOTS: Readonly<Record<CornerSlot, {
  sm: number; md: number; lg: number; pill: number;
}>> = {
  sharp: { sm: 0,  md: 0,  lg: 0,  pill: 0   },
  soft:  { sm: 2,  md: 6,  lg: 10, pill: 999 }, // ≡ the resolver defaults
  round: { sm: 6,  md: 12, lg: 20, pill: 999 },
};

export const RULE_SLOTS: Readonly<Record<RuleSlot, {
  hair: number; thin: number; regular: number; thick: number;
}>> = {
  fine:   { hair: 0.5, thin: 0.75, regular: 1,   thick: 1.5 },
  normal: { hair: 0.5, thin: 1,    regular: 1.5, thick: 2.5 }, // ≡ the resolver defaults
  strong: { hair: 1,   thin: 1.5,  regular: 2,   thick: 3.5 },
};

// ── SPACING (named density-relative steps) ───────────────────────────────
// Spacing roles map to the existing density presets — the "step" a viewer
// picks IS the density preset (no separate vocabulary needed).

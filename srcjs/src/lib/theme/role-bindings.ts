/**
 * Default Tier-2 role bindings (v4 substrate).
 *
 * Every role's "where it lives if no user override" — a (ramp, grade) pair.
 * Mirrors rgc_v4's DEFAULT_GRADES. The wire layer answers `getRoleBinding()`
 * via this table when no override is set; the resolver (`resolve-theme.ts`)
 * consults it during the Tier-2 → Tier-3 mapping.
 *
 * Lives in its own module so both `theme-wire.ts` and `resolve-theme.ts`
 * can import from it without creating an import cycle (the wire and the
 * resolver are otherwise siblings, not arranged in a hierarchy).
 *
 * Per Stage 1 §10b reference; settled in the M3 / M4 sequence of the
 * substrate sprint.
 */

import type { RoleName, RampName } from "../../types/theme-roles";

/** A single role binding — a pin from a role to a (ramp, grade) pair. */
export interface RoleBinding {
  readonly ramp: RampName;
  /** 1..11 (1-indexed, matches the CSS-var ramp grades). */
  readonly grade: number;
}

/** Frozen table of every role's default (ramp, grade) pair.
 *
 *  Off-ramp roles (status, text-onsolid) carry placeholder bindings here —
 *  the resolver routes them through dedicated paths (status anchors +
 *  APCA contrast picker). The placeholder values are unused at resolve
 *  time but the table needs an entry per role for the wire's
 *  `getRoleBinding()` to return a sensible value. */
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
  // Status — off-ramp; placeholder bindings (resolver routes via status anchors)
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
  // Series slots
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

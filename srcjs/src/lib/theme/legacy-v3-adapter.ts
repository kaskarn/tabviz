// Transient v3 adapter — keeps the v3 ThemeControl + studio tabs +
// snippet generator alive through Phase A while the V4 anchors substrate
// is the canonical authoring surface. Phase B deletes the v3 UI; this
// file goes with it.
//
// Reads V4 `ThemeInputs` as a v3-shape view (`{ brand, accent, decorative,
// neutral_tint*, ... }` hex fields) and translates v3-style patches back
// into V4 anchor updates.

import type { ThemeInputs, OklchTriple } from "../../types/theme-inputs";
import { oklchToHex, hexToOklch } from "../oklch";

export type V3NeutralTint =
  | "untinted"
  | "brand"
  | "accent"
  | "decorative"
  | { hex: string };

/** Read-side view: V4 inputs projected back to the v3 hex-string shape
 *  the legacy ThemeControl + studio tabs were authored against. */
export interface V3InputsView {
  brand: string;
  accent: string;
  /** V4 has no decorative anchor; always `null` in this view. v3 UIs
   *  that surfaced a "decorative" swatch render it as the brand fallback. */
  decorative: string | null;
  /** V4 has no neutral_tint enum; always `"untinted"`. */
  neutral_tint: V3NeutralTint;
  /** V4 bakes tint into paper/ink chroma; the v3 strength knob has no
   *  V4 analogue. Always `0`. */
  neutral_tint_strength: number;
  /** Mirrors V4 `polarity`. */
  polarity: "light" | "dark";
}

/** Project V4 `ThemeInputs` to a v3-shape read view. */
export function legacyInputsView(inputs: ThemeInputs): V3InputsView {
  const a = inputs.anchors;
  const brand = oklchToHex(a.brand);
  const accent = oklchToHex(a.accent ?? a.brand);
  return {
    brand,
    accent,
    decorative: null,
    neutral_tint: "untinted",
    neutral_tint_strength: 0,
    polarity: inputs.polarity ?? "light",
  };
}

/** Patch shape accepted by [applyV3Patch]. Subset of [V3InputsView] +
 *  the orthogonal v4 fields that survived. */
export type V3InputsPatch = Partial<V3InputsView> & Partial<ThemeInputs>;

/** Write-side: apply a v3-style patch to V4 inputs. Hex fields
 *  (`brand`, `accent`) become anchor updates; v3-only knobs
 *  (`decorative`, `neutral_tint*`) are silently dropped (V4 has no
 *  equivalent — they're baked into anchors at preset definition time).
 *  Other V4 fields (polarity, density, fonts, ...) pass through. */
export function applyV3Patch(
  inputs: ThemeInputs,
  patch: V3InputsPatch,
): ThemeInputs {
  const next: ThemeInputs = { ...inputs };
  const anchors = { ...inputs.anchors };

  if (typeof patch.brand === "string") {
    anchors.brand = hexToOklch(patch.brand);
  }
  if (typeof patch.accent === "string") {
    anchors.accent = hexToOklch(patch.accent);
  }
  next.anchors = anchors;

  // Pass-through V4-native fields (anything besides the v3 shims).
  const v3Only = new Set([
    "brand", "accent", "decorative", "neutral_tint", "neutral_tint_strength",
  ]);
  for (const [k, v] of Object.entries(patch)) {
    if (v3Only.has(k)) continue;
    if (k === "anchors") continue;
    if (v === undefined) continue;
    (next as unknown as Record<string, unknown>)[k] = v;
  }
  return next;
}

/** Read the brand anchor as hex. Convenience wrapper. */
export function brandHex(inputs: ThemeInputs): string {
  return oklchToHex(inputs.anchors.brand);
}

/** Read the accent anchor (falling back to brand) as hex. */
export function accentHex(inputs: ThemeInputs): string {
  return oklchToHex(inputs.anchors.accent ?? inputs.anchors.brand);
}

/** Build a one-anchor patch from a hex. Convenience for the v3 UIs that
 *  push `{ brand: "#X" }` style edits. */
export function anchorPatch(name: "brand" | "accent", hex: string): { anchors: { brand?: OklchTriple; accent?: OklchTriple } } {
  return { anchors: { [name]: hexToOklch(hex) } };
}

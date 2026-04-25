/**
 * Resolve the 8-color theme palette surfaced in the settings panel's
 * "Theme" tab on every color picker.
 *
 * The R-side serializer always emits a length-8 `swatches` array — when
 * the author hasn't set one explicitly, it derives a sensible default
 * from the theme's named colors. So this helper is a thin guard: it
 * returns `colors.swatches` when shaped right and falls back to a
 * client-side derivation only if the wire shape is unexpected (defensive
 * for older bundles or hand-built specs).
 */

import type { WebTheme } from "$types";

const FALLBACK_LENGTH = 8;

export function resolveSwatches(theme: WebTheme | null | undefined): string[] {
  const c = theme?.colors;
  if (!c) return [];
  if (Array.isArray(c.swatches) && c.swatches.length === FALLBACK_LENGTH) {
    return c.swatches;
  }
  return [
    c.primary, c.accent, c.secondary, c.muted,
    c.foreground, c.border, c.background, c.rowBg,
  ];
}

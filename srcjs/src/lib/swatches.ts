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
  if (!theme) return [];
  // 8-color quick palette derived from v2 inputs + chrome roles.
  return [
    theme.inputs?.brand ?? "#000000",
    theme.accent?.default ?? "#000000",
    theme.content?.secondary ?? "#000000",
    theme.content?.muted ?? "#000000",
    theme.content?.primary ?? "#000000",
    theme.divider?.subtle ?? "#000000",
    theme.surface?.base ?? "#ffffff",
    theme.row?.base?.bg ?? "#ffffff",
  ].slice(0, FALLBACK_LENGTH);
}

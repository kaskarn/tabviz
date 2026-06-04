/**
 * Resolve the 8-color theme palette surfaced in the settings panel's
 * "Theme" tab on every color picker.
 *
 * Reads directly from the v4 cssVars manifest. R-side `serialize_theme`
 * always emits a length-8 `swatches` array; this helper is the
 * client-side derivation when the author hasn't pinned one explicitly.
 */

import type { WebTheme } from "$types";
import {
  getCssVars, readVar,
  readContentPrimary, readContentSecondary, readContentMuted,
  readAccentDefault, readSurfaceBg, readDividerSubtle,
} from "./theme/consumer-bridge";

const FALLBACK_LENGTH = 8;

export function resolveSwatches(theme: WebTheme | null | undefined): string[] {
  if (!theme) return [];
  const cssVars = getCssVars(theme);
  // 8-color quick palette. The first slot was historically "primary"
  // (v3 brand hex); v4 routes that through accent (the layered-emphasis
  // identity color) so this returns accent twice — once as the brand-
  // identity slot, once as the accent slot. Authors who want a distinct
  // brand swatch should pin `theme.swatches` explicitly.
  return [
    readAccentDefault(cssVars),
    readAccentDefault(cssVars),
    readContentSecondary(cssVars),
    readContentMuted(cssVars),
    readContentPrimary(cssVars),
    readDividerSubtle(cssVars),
    readSurfaceBg(cssVars),
    readVar(cssVars, "--tv-row-base-bg", "#FFFFFF") ?? "#FFFFFF",
  ].slice(0, FALLBACK_LENGTH);
}

// LIVE-CONFIG token emissions (the v3 bridge's survivor, W4 finale
// 2026-06-11). computeV3BridgeVars IS DELETED — every v3 recipe was
// ported into real v4 resolver groups (header-active / first-col /
// borders / ramp-direct / anchor / role / typography / const entries).
// What remains reads blob fields that DELIBERATELY stay on the wire:
// `series` (the slot system) and `layout` (spec-side figure config).
//
// Single source: theme-css.ts emits from this map; consumer-bridge
// overlays it onto resolved cssVars. Both surfaces agree by construction.

import type { WebTheme } from "../../types";
import { resolveContainerBorder } from "./layout-defaults";

/** LIVE-CONFIG emissions — NOT v3 debt. These read blob fields the W4
 *  verdict table deliberately keeps (`series` = the slot system;
 *  `layout` = spec-side figure config). They ride the same overlay path
 *  as the bridge but SURVIVE W4. */
export function computeLiveConfigVars(
  theme: WebTheme,
  cv: Record<string, string>,
): Record<string, string> {
  const v4Accent = cv["--tv-accent"] ?? "#2563eb";
  // `layout` is a wire blob that can be absent on a partial/transitioning
  // theme — resolve through the shared defaults (never read `.layout.x`
  // raw; that was the theme-switch crash).
  const { border, radius } = resolveContainerBorder(theme.layout);
  return {
    // Pooled-summary marker reads slot 0 — the slot system is
    // deliberately separate from the component model.
    "--tv-summary-fill":   theme.series?.[0]?.fill ?? v4Accent,
    "--tv-summary-border": theme.series?.[0]?.stroke ?? v4Accent,
    "--tv-container-border": border ? "1px solid var(--tv-border)" : "none",
    "--tv-container-border-radius": `${radius}px`,
  };
}

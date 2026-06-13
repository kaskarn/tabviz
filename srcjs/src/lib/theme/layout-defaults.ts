/**
 * Single source for the figure-LAYOUT blob defaults.
 *
 * `theme.layout` is a wire blob (spec-side figure config) that a fully
 * resolved theme always carries — but it can be ABSENT on a partial or
 * transitioning theme: JS-authored themes that never set it, a slim D13
 * envelope observed mid-rebuild, an older-wire blob. The live-config
 * emitter (`computeLiveConfigVars`) and the SVG export both run on those
 * transient shapes, so they must default rather than assume — the same
 * way `computeLiveConfigVars` already guards `theme.series?.[0]`.
 *
 * Before this module the container-border defaults (`false` / `8px`) were
 * HARDCODED in three places (theme-adapter's buildTheme, svg-generator,
 * and read raw in v3-bridge-vars with no guard at all — the source of the
 * "Cannot read properties of undefined (reading 'containerBorder')" crash
 * on theme switch). One helper now owns them so they cannot drift.
 */
import type { Layout } from "../../types";

export const CONTAINER_BORDER_DEFAULT = false;
export const CONTAINER_BORDER_RADIUS_DEFAULT = 8;

type ContainerBorderFields = Pick<Layout, "containerBorder" | "containerBorderRadius">;

/** Resolve the container-border config from a possibly-absent layout blob.
 *  Always returns a concrete `{ border, radius }` — never throws on a
 *  partial theme. */
export function resolveContainerBorder(
  layout: ContainerBorderFields | undefined | null,
): { border: boolean; radius: number } {
  return {
    border: layout?.containerBorder ?? CONTAINER_BORDER_DEFAULT,
    radius: layout?.containerBorderRadius ?? CONTAINER_BORDER_RADIUS_DEFAULT,
  };
}

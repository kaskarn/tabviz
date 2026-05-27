// Schema boot file — imports the schema registry AND all built-in
// behaviors. Runtime entries (htmlwidget mount, V8 bridge, editor
// host) should import this, not `columns/index.ts` directly, so that
// behavior side-effect registrations fire before any dispatcher runs.
//
// Why a separate file: the schema registry (`columns/index.ts`) and
// the behavior registrar (`extend.ts`) have a load-time cycle if the
// behavior modules side-effect-import at registry construction time.
// By moving registrations here, the cycle is broken: extend.ts loads,
// columns/index.ts loads, init.ts (which depends on both) loads
// last and triggers the behavior side-effects.

// Schemas — re-exported so consumers can keep one import.
export * from "./columns";

// Behavior registrations. Each module side-effect-registers on first
// import AND exports an idempotent re-register function for tests
// that call `__resetRuntimeRegistries()` between cases.
import { registerReferenceBehaviors } from "./columns/reference-behaviors";
import { registerVizBehaviors }       from "./columns/viz-behaviors";
import { registerSortBehaviors }      from "./columns/sort-behaviors";
import { registerWidthBehaviors }     from "./columns/width-behaviors";
import { registerEmitBehaviors }      from "./columns/emit-behaviors";
import { registerIntervalRenderer }   from "./columns/interval-renderer";
import { registerTextCompositionRenderers } from "./columns/text-composition-renderers";
import { registerBadgeRenderer }      from "./columns/badge-renderer";
import { registerIconRenderer }       from "./columns/icon-renderer";
import { registerStarsRenderer }      from "./columns/stars-renderer";
import { registerRingRenderer }       from "./columns/ring-renderer";
import { registerProgressRenderer }   from "./columns/progress-renderer";
// DOM cell renderers live in `./init-dom` — they import Svelte
// components and must NOT be pulled into the V8 bundle. Browser
// entries import `init-dom` (which side-effect-imports this file too)
// so they pick up everything; V8 imports `init` directly and stays
// Svelte-free.

/**
 * Re-register every built-in schema behavior. Idempotent. Call this
 * from `beforeEach` in test files that wipe runtime registries via
 * `__resetRuntimeRegistries()` and still need built-in behaviors
 * (sortKey, contributeBanks, …) available.
 */
export function bootBuiltinBehaviors(): void {
  registerReferenceBehaviors();
  registerVizBehaviors();
  registerSortBehaviors();
  registerWidthBehaviors();
  registerEmitBehaviors();
  registerIntervalRenderer();
  registerTextCompositionRenderers();
  registerBadgeRenderer();
  registerIconRenderer();
  registerStarsRenderer();
  registerRingRenderer();
  registerProgressRenderer();
}

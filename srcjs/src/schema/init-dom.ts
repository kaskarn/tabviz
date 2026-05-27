// Browser-only boot file. Loads the V8-safe `./init` first (schemas
// + behaviors + text-composition renderers that have no Svelte
// imports), then registers DOM cell renderers that DO import Svelte
// components.
//
// Browser bundle entries (`htmlwidgets/index.svelte.ts`,
// `htmlwidgets/index-split.svelte.ts`) import this file. The V8
// export bundle (`export/v8-entry.ts`) imports `./init` directly so
// Svelte components stay out of its dependency graph.

import "./init";

// DOM cell renderers — each pulls a Svelte component into the
// browser bundle. Add new ones here as schema renderers gain DOM
// slots (visual cells that mount existing Svelte cell components).
import { registerPictogramRenderer }    from "./columns/pictogram-renderer";
import { registerVisualCellRenderers }  from "./columns/visual-cell-renderers";
import { registerBarRenderer }          from "./columns/bar-renderer";
import { registerHeatmapRenderer }      from "./columns/heatmap-renderer";

/**
 * Re-register every browser-only renderer. Idempotent. Tests that
 * wipe runtime registries via `__resetRuntimeRegistries()` call
 * `bootBuiltinBehaviors()` (from `./init`) AND `bootDomRenderers()`
 * to restore everything.
 */
export function bootDomRenderers(): void {
  registerPictogramRenderer();
  registerVisualCellRenderers();
  registerBarRenderer();
  registerHeatmapRenderer();
}

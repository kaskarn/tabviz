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

// Behavior side-effect registrations.
import "./columns/reference-behaviors";
import "./columns/viz-behaviors";

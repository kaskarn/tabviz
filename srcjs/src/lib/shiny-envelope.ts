// Helper for constructing the Shiny outbound envelope used by every
// `Shiny.setInputValue` call the widget makes. The type lives in
// `$types` (it's part of the JS → R wire contract); this is the
// runtime constructor.
//
// Will relocate to the htmlwidgets adapter subpath (src/htmlwidgets/glue.ts)
// as part of the Phase 2 source-tree restructure. Lives in $lib for now
// so both index.svelte.ts and index-split.svelte.ts can share it.
//
// See docs/dev/source-tagging.md for the contract.

import type { ShinyEnvelope, SourceTag } from "$types";

/**
 * Wrap a value in a fresh Shiny envelope with `ts = Date.now()`. Use at
 * every `Shiny.setInputValue` site so the envelope shape stays defined
 * in one place.
 */
export function shinyEnvelope<T>(value: T, source: SourceTag): ShinyEnvelope<T> {
  return { value, source, ts: Date.now() };
}

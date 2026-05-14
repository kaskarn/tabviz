// Helper for constructing the Shiny outbound envelope used by every
// `Shiny.setInputValue` call the widget makes. The type lives in
// `$types` (it's part of the JS → R wire contract); this is the
// runtime constructor.
//
// Lives in $lib so both htmlwidgets adapters and the eventual `core/`
// factories can share it. Used by htmlwidgets/{index,index-split}.svelte.ts
// to wrap every outbound `Shiny.setInputValue` payload.
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

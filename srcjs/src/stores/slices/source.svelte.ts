// Source-tagging slice for outbound Shiny events.
//
// Every store setter that drives a Shiny-observable field calls
// `slice.markSource(field)` after the mutation. UI-driven calls leave
// currentSource at 'user'; proxy dispatch wraps its handler in
// `slice.withSource('proxy', () => ...)` so markSource captures 'proxy'
// synchronously before the $effect tick fires.
//
// `lastSource` is $state so Shiny output observers reactively read the
// latest tag. `currentSource` is a plain closure variable — its changes
// are synchronous within withSource's try/finally; no reactivity needed.
//
// Extracted from forestStore.svelte.ts as the Phase 0c-C1 spike (idiom
// (c) "method-only split" per spec §5.1-Q8). See
// docs/dev/store-decomposition-idiom.md for the decision record.

export type SourceTag = "user" | "proxy";

export interface SourceSlice {
  markSource: (field: string) => void;
  withSource: <T>(src: SourceTag, fn: () => T) => T;
  getSource: (field: string) => SourceTag;
}

export function createSourceSlice(): SourceSlice {
  let currentSource: SourceTag = "user";
  const lastSource = $state<Record<string, SourceTag>>({});

  function markSource(field: string): void {
    lastSource[field] = currentSource;
  }

  function withSource<T>(src: SourceTag, fn: () => T): T {
    const prev = currentSource;
    currentSource = src;
    try {
      return fn();
    } finally {
      currentSource = prev;
    }
  }

  function getSource(field: string): SourceTag {
    return lastSource[field] ?? "user";
  }

  return { markSource, withSource, getSource };
}

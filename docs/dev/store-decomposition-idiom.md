# Store decomposition idiom — Q8 spike decision record

**Decision:** Idiom (c) "method-only split via per-slice factory functions."
**Spike date:** 2026-05-12
**Prototype slice:** source-tagging (`$stores/slices/source.svelte.ts`)
**Status:** Validated. Phase 0c-C1 proceeds against this idiom.

This document resolves the open question Q8 in the program spec (`docs/dev/frontend-split-spec.md` §5.1) and constitutes the deliverable for the pre-step 1 spike in the launch plan.

---

## Context

The forestStore (`srcjs/src/stores/forestStore.svelte.ts`, 4261 lines) is a single Svelte 5 factory closure with `$state`, `$derived`, and `$effect` declarations colocated. Phase 0c-C1 of the program decomposes it into ~10-12 domain slices. Svelte 5 runes don't compose across module boundaries the way Pinia/Zustand slices do, so the decomposition idiom is load-bearing — it determines how `$state` declarations, derived values, and method definitions live in separate files while still binding into one reactive system.

Spec §4 Phase 0c-C1 named three candidate idioms:

- **(a) Parameter-passing** — sub-modules export pure functions taking a state record as an argument
- **(b) Svelte class-field idiom** — convert the factory to a class with `$state` class fields; sub-modules are classes sharing the parent via composition or context
- **(c) Method-only split** — the factory keeps the `$state` declarations, but method definitions move to per-slice files that close over the state (or accept it as an argument from a slice-local sub-factory)

The spike's job: prove one of these works end-to-end on a small slice, then commit to it as the C1 idiom.

---

## Why (c) — and what "(c)" actually looks like in practice

The recommended formulation, which the spike implemented:

- Each slice is a `.svelte.ts` file under `src/stores/slices/`.
- Each slice exports a `createXxxSlice()` factory function.
- The slice factory declares its own `$state` internally and returns a typed `XxxSlice` interface containing the methods and getters that depend on that state.
- The main store factory (`createForestStore()`) calls each slice factory once during construction. Methods returned by the slice are either re-exported directly on the store's public API or used internally by other slices.

This works because:

1. A `$state` declaration inside a function call returns a reactive proxy that lives as long as the closure. Multiple slices each get their own state without collision.
2. Functions returned from the slice factory close over the slice's `$state`, so calls to them remain reactive — components that read through them re-render correctly when the underlying state changes.
3. Reactivity composes through function call layers without ceremony — `getSource()` returning `lastSource[field]` triggers a read tracking the same way an inline access would.

The two alternative idioms have real costs:

- **(a) Parameter-passing** would require declaring every `$state` declaration up-front in one place and threading record arguments through every method body. Verbose and out-of-character for the existing codebase.
- **(b) Svelte class-field idiom** would require converting the factory to a class and converting `$state` to `$state.raw` / `$state` class fields, which is a more invasive idiom change than this codebase needs. Svelte 5 supports both function-factory and class patterns; the codebase is consistent on the factory pattern. Mixing idioms mid-program is the wrong move.

(c) is the smallest-delta idiom that respects the existing code style.

---

## The prototype

The spike extracted the source-tagging slice (~22 lines of state + helpers + ~50 `markSource()` call sites scattered through the store).

### Slice file (`srcjs/src/stores/slices/source.svelte.ts`)

```ts
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
    try { return fn(); } finally { currentSource = prev; }
  }

  function getSource(field: string): SourceTag {
    return lastSource[field] ?? "user";
  }

  return { markSource, withSource, getSource };
}
```

Notable points:

- `currentSource` stays a plain `let` (no `$state`). Its mutations are synchronous and don't need to drive reactivity; only `lastSource` is observed externally.
- The slice is *self-contained*: nothing else needs to know how source tagging is implemented.
- The exported interface (`SourceSlice`) is what the rest of the store depends on; the implementation behind it is the slice's business.

### Wiring in the main store

In `createForestStore()`:

```ts
const source = createSourceSlice();
const markSource = source.markSource;
const withSource = source.withSource;
// ... ~50 existing call sites work unchanged
```

The local `const markSource = source.markSource` aliasing keeps the existing ~50 `markSource("...")` call sites scattered through the store unchanged. Minimal-delta migration for an existing module; new modules from here on can just use `source.markSource(...)` directly.

In the public-API return:

```ts
return {
  // ...
  getSource: source.getSource,
  withSource,
  // ...
};
```

---

## Verification

The spike was run end-to-end against the production codebase on the `split` branch:

| Check | Result |
|---|---|
| Build all three bundles (`tabviz.js`, `tabviz_split.js`, `svg-generator.js`) | ✔ clean |
| `bun test` | 122 pass, 6 fail — all 6 failures pre-existing and unrelated (color/swatch tests, stashed-and-unstashed comparison confirms) |
| `devtools::test()` (R-side, full suite) | ✔ 100% pass ("Your tests are beautiful") |
| `tabviz::render_visual_tests()` (full visual battery) | ✔ 45 succeeded, 1 skipped, 0 failed |

Reactivity propagation was implicitly exercised across the visual tests (theme changes, sorts, filters, paint operations all run through the source-tagging path during their setup). The Shiny output path that calls `getSource()` directly inside `$effect` blocks (in `index.svelte.ts`) is structurally identical to the previous closure-local version — same `$state` proxy, same lookup. Direct runtime exercise of that path will happen in 0a-PR5 when the typed event emitter ships and we have a Shiny dashboard regression-checked end-to-end.

---

## Implications for the rest of Phase 0c-C1

Apply the same pattern to the remaining slices identified in §4 Phase 0c-C1:

```
srcjs/src/stores/slices/
├── source.svelte.ts          ← shipped by this spike
├── data.svelte.ts            ← spec ingestion, current page
├── sort-filter.svelte.ts     ← sort, column filters
├── columns.svelte.ts         ← column ops
├── rows-groups.svelte.ts     ← row selection, group collapse, row reorder
├── cells.svelte.ts           ← cell edits, label edits
├── semantics.svelte.ts       ← paint tool, row/cell semantics, theme tokens
├── layout-zoom.svelte.ts     ← dimensions, zoom, autofit, aspect, banding, plot width
├── axis.svelte.ts            ← axis zooms, effective domains
├── theme.svelte.ts           ← theme switching, theme field edits, snapshots
└── events.svelte.ts          ← typed event emitter (Phase 0a-S3)
```

Slices that cross-depend on each other (e.g., semantics reads theme state) compose by accepting other slice interfaces as constructor arguments:

```ts
export function createSemanticsSlice(theme: ThemeSlice, source: SourceSlice): SemanticsSlice {
  // ...
}
```

The main store factory threads dependencies in topological order — the spec §4 listing is already roughly in that order; the actual graph emerges as each slice ships.

### Risks remaining

The spike validated the *idiom*. It did not validate every variety of state. Specifically:

- `$derived` chains across slices have not been exercised. Need a derived slice spike before tackling layout-zoom, axis, or any slice with cross-slice derivations.
- `$effect.root()` and related runes have not been touched — the existing store doesn't use them, and we shouldn't need them in slices.

These are not blockers, just open questions for the next spike (if needed) when we reach Phase 0c-C1 for real.

---

## Status notes

The spike's working tree (slice file + forestStore.svelte.ts edits) sits on the `split` branch as uncommitted work. Decision: **land the spike as a single commit** so it remains a worked example for the rest of C1 (and so subsequent Phase 0a work isn't blocked by an in-progress refactor). Phase 0c-C1 then has the source slice already in place and proceeds with the next slice up.

This is a slight cross-phase landing (Phase 0c work appearing before Phase 0a is done), but the spec's stopping rules support it: the change is small, behavior-preserving, and the alternative (waiting until Phase 0c) would mean throwing away tested working code.

// Shared theme-INPUT access for the settings tabs (Variations / Identity
// / Plots / Styling). ONE place for the authoringInputs read + the
// sanctioned write verbs (DT-11: theme inputs only, never a Tier-2/3
// path — gate: settings-band-contract.test.ts).
//
// `WebTheme.authoringInputs` is fully typed (types/theme-resolved.ts), so
// no cast is needed: each tab previously widened `theme` through a
// structural `{ authoringInputs?: ThemeInputs }` cast, which DEFEATED the
// WebTheme contract (a field rename would have compiled clean and broken
// silently). This helper drops the cast and the per-tab boilerplate.
//
// Svelte 5 pattern: the `$derived`s run in the calling component's
// reactive scope (the same getter-returning idiom the stores use). The
// store is passed as a GETTER (`() => store`) — accessing it inside the
// derived closures, not capturing it once, is what keeps svelte-check's
// `state_referenced_locally` lint quiet. Read `.inputs` / `.theme`
// through the returned object (or re-wrap in a local `$derived`) — do NOT
// destructure them, or reactivity is captured once. The verbs
// (commit/preview/patch) are stable and safe to destructure.
import type { TabvizStore } from "$stores/tabvizStore.svelte";
import type { ThemeInputs } from "$types/theme-inputs";

/** Shared theme-input accessor (return type inferred):
 *  - `theme`  — the resolved WebTheme (for roleOverrides / pins / series reads)
 *  - `inputs` — the authoring inputs, or null before a spec lands
 *  - `commit(next)`  — full-inputs history step (re-resolves the cascade)
 *  - `preview(next)` — full-inputs drag-tick channel (no history)
 *  - `patch(key, value)` — splice one top-level key + commit (no-op pre-inputs) */
export function useThemeInputs(getStore: () => TabvizStore) {
  const theme = $derived(getStore().spec?.theme);
  const inputs = $derived(theme?.authoringInputs ?? null);
  return {
    get theme() { return theme; },
    get inputs() { return inputs; },
    commit: (next: ThemeInputs) => getStore().setAuthoringInputs(next),
    preview: (next: ThemeInputs) => getStore().previewAuthoringInputs(next),
    patch<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]) {
      if (inputs) getStore().setAuthoringInputs({ ...inputs, [key]: value });
    },
  };
}

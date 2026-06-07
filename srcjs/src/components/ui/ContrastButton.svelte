<script lang="ts">
  // Always-on accessibility escape: a single high-contrast toggle that
  // survives author-freeze. The richer Contrast control lives in the
  // settings FIGURE band, but `enable_theme_edit=FALSE` removes the whole
  // cog — which used to take the low-vision viewer's only MANUAL contrast
  // lever with it (the OS prefers-contrast path already survives freeze;
  // this restores the manual one). Rendered by ControlToolbar ONLY when the
  // cog is hidden, so there's exactly one contrast control in each state.
  //
  // This is the narrow regression fix, NOT the full accessibility panel
  // (reduced-transparency / motion / text-scale / ratchet) — that's a
  // separate, deferred arc.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const more = $derived(store.contrastOverride === "more");
  function toggle(): void {
    store.setContrastOverride(more ? "auto" : "more");
  }
</script>

<button
  class="contrast-btn"
  onclick={toggle}
  aria-pressed={more}
  aria-label={more ? "High contrast on" : "Increase contrast"}
  data-tooltip={more ? "High contrast: on" : "Increase contrast"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3 a9 9 0 0 1 0 18 z" fill="currentColor" stroke="none" />
  </svg>
</button>

<style>
  .contrast-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    background: var(--tv-surface-bg, #ffffff);
    color: var(--tv-text-muted, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .contrast-btn:hover {
    background: var(--tv-hover-bg, #e2e8f0);
    color: var(--tv-text, #1a1a1a);
  }
  .contrast-btn[aria-pressed="true"] {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 18%, var(--tv-surface-bg, #ffffff));
    color: var(--tv-accent, #2563eb);
    border-color: color-mix(in srgb, var(--tv-accent, #2563eb) 40%, var(--tv-border, #e2e8f0));
  }
</style>

<script lang="ts">
  // Arrange tool toggle (interactivity-UX arc P2). A toolbar MODE in the
  // paint-tool grammar: arming it reveals every resize seam at once —
  // row-kind bottom edges (per-kind height pins), header height, group
  // gaps, footer gap — each with a visible handle, live px readout,
  // double-click reset and arrow-key nudge. Disarming returns the widget
  // to a clean reading surface.
  //
  // Rendered only when interaction.enableArrange resolves TRUE
  // (conservative default OFF; authors opt in per spec / theme / global).
  // Escape disarms — handled here via svelte:window so the exit works
  // regardless of what currently has focus.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const active = $derived(store.arrangeMode);
  function toggle(): void {
    store.setArrangeMode(!active);
  }
  function onWindowKey(e: KeyboardEvent): void {
    if (!active || e.key !== "Escape") return;
    // Seam drags consume their own Escape (cancel) with stopPropagation
    // in capture phase, so reaching here means no drag is in flight.
    store.setArrangeMode(false);
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<button
  class="arrange-btn"
  class:active
  onclick={toggle}
  aria-pressed={active}
  aria-label={active ? "Exit arrange mode" : "Arrange: drag row heights and gaps"}
  data-tooltip={active ? "Exit arrange (Esc)" : "Arrange rows & spacing"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v18" />
    <path d="M9 6l3-3 3 3" />
    <path d="M9 18l3 3 3-3" />
    <path d="M4 12h16" />
  </svg>
</button>

<style>
  .arrange-btn {
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
  .arrange-btn:hover {
    background: var(--tv-hover-bg, #e2e8f0);
    color: var(--tv-text, #1a1a1a);
  }
  .arrange-btn.active {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 18%, var(--tv-surface-bg, #ffffff));
    color: var(--tv-accent, #2563eb);
    border-color: color-mix(in srgb, var(--tv-accent, #2563eb) 40%, var(--tv-border, #e2e8f0));
  }
</style>

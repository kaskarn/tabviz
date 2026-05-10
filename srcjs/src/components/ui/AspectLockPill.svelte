<!--
  Aspect-lock pill — visible only when a target aspect ratio is pinned.
  Click to release.

  Why a pill: the aspect-lock is a non-default state that affects how
  the widget responds to interactive content changes (group expand /
  collapse, pagination), and the existing slider+toggle live inside
  the zoom dropdown — invisible at rest. The pill makes the lock
  state visible at a glance, with one-click release. The slider in
  the dropdown is still available for fine-tuning the target before
  / instead of releasing.
-->
<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  // Only show when an aspect target is pinned.
  const targetAspect = $derived(store.targetAspect);
  const display = $derived.by(() => {
    if (targetAspect == null) return null;
    return Math.round(targetAspect * 100) / 100;
  });

  function release() {
    store.setTargetAspect(null);
  }
</script>

{#if display != null}
  <button
    class="aspect-lock-pill"
    onclick={release}
    title="Aspect ratio pinned at {display}:1. Click to release."
    aria-label="Release aspect ratio lock"
  >
    <!-- Lock icon -->
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
    <span class="aspect-text">{display}:1</span>
    <!-- Close x -->
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  </button>
{/if}

<style>
  .aspect-lock-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 35%, transparent);
    border-radius: 11px;
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 12%, var(--tv-bg, #ffffff));
    color: var(--tv-accent, #2563eb);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }

  .aspect-lock-pill:hover {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 20%, var(--tv-bg, #ffffff));
    border-color: color-mix(in srgb, var(--tv-accent, #2563eb) 55%, transparent);
  }

  .aspect-lock-pill:focus-visible {
    outline: 2px solid var(--tv-accent, #2563eb);
    outline-offset: 2px;
  }

  .aspect-text {
    line-height: 1;
  }

  /* In the floating glass-pill toolbar (auto-fit container hover state),
     match the surrounding chrome — no border, transparent background. */
  :global(.tabviz-container > .control-toolbar .aspect-lock-pill) {
    border-color: color-mix(in srgb, var(--tv-accent, #2563eb) 25%, transparent) !important;
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 8%, transparent) !important;
  }
</style>

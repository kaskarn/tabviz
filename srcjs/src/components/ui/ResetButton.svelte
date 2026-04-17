<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  function handleReset() {
    store.resetState();
  }
</script>

<button
  class="reset-btn"
  onclick={handleReset}
  aria-label="Reset view to default settings"
  data-tooltip="Reset view"
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
</button>

<style>
  .reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 6px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .reset-btn:hover {
    background: var(--wf-border, #e2e8f0);
    color: var(--wf-fg, #1a1a1a);
  }
</style>

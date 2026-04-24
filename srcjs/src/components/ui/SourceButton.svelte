<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SourceModal from "./SourceModal.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  let open = $state(false);
</script>

<button
  class="source-btn"
  class:active={open}
  onclick={() => (open = !open)}
  aria-label="View source"
  aria-expanded={open}
  data-tooltip="View source"
>
  <!-- `</>` code brackets glyph -->
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
</button>

<SourceModal {store} {open} onclose={() => (open = false)} />

<style>
  .source-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 6px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .source-btn:hover {
    background: var(--wf-border, #e2e8f0);
    color: var(--wf-fg, #1a1a1a);
  }

  .source-btn.active {
    background: var(--wf-primary, #2563eb);
    color: var(--wf-bg, #ffffff);
    border-color: var(--wf-primary, #2563eb);
  }
</style>

<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    store: ForestStore;
    field: string;
    header: string;
  }

  let { store, field, header }: Props = $props();

  let btnEl: HTMLButtonElement | null = $state(null);

  const isActive = $derived(store.getColumnFilter(field) !== null);
  const isOpen = $derived(store.filterPopoverTarget?.field === field);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (isOpen) store.closeFilterPopover();
    else store.openFilterPopover(field, header, btnEl);
  }
</script>

<button
  bind:this={btnEl}
  class="filter-btn"
  class:active={isActive}
  class:open={isOpen}
  aria-label="Filter column {header}"
  aria-expanded={isOpen}
  onclick={toggle}
  title={isActive ? "Filter active (click to edit)" : "Filter column"}
>
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 3 L14 3 L10 8 L10 13 L6 11 L6 8 Z" fill={isActive ? "currentColor" : "none"} />
  </svg>
</button>

<style>
  /* Absolute-positioned inside the header cell. Reveal on header hover;
     stay persistent when a filter is applied so the user sees the active
     state at rest. Sits LEFT of the resize handle and LEFT of the drag grip. */
  .filter-btn {
    position: absolute;
    top: 50%;
    right: 24px;
    transform: translateY(-50%);
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; padding: 0;
    border: none; background: transparent; color: var(--tv-secondary, #64748b);
    cursor: pointer; border-radius: 3px;
    opacity: 0;
    transition: opacity .12s, background-color .12s;
    pointer-events: none;
    z-index: 5;
  }
  /* Reveal on header hover */
  :global(.tabviz-container .header-cell:hover) .filter-btn {
    opacity: 0.75;
    pointer-events: auto;
  }
  .filter-btn:hover { opacity: 1; background: var(--tv-border, #f1f5f9); }
  /* Active filter: stay fully visible at rest */
  .filter-btn.active {
    opacity: 1;
    pointer-events: auto;
    color: var(--tv-primary, #2563eb);
  }
  .filter-btn.open { background: var(--tv-border, #f1f5f9); opacity: 1; }
</style>

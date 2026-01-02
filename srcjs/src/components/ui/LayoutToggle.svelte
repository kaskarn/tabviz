<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  let dropdownOpen = $state(false);

  const widthMode = $derived(store.widthMode);
  const heightPreset = $derived(store.heightPreset);

  const WIDTH_OPTIONS = [
    { value: 'fit' as const, label: 'Fit Content' },
    { value: 'fill' as const, label: 'Fill Container' },
    { value: 'responsive' as const, label: 'Responsive' },
  ];

  const HEIGHT_OPTIONS = [
    { value: 'small' as const, label: 'Small (400px)' },
    { value: 'medium' as const, label: 'Medium (600px)' },
    { value: 'large' as const, label: 'Large (1000px)' },
    { value: 'full' as const, label: 'Full Height' },
    { value: 'container' as const, label: 'Fill Container' },
  ];

  function closeDropdown() {
    dropdownOpen = false;
  }

  function selectWidthMode(mode: 'fit' | 'fill' | 'responsive') {
    store.setWidthMode(mode);
  }

  function selectHeightPreset(preset: 'small' | 'medium' | 'large' | 'full' | 'container') {
    store.setHeightPreset(preset);
  }

  // Close dropdown when clicking outside
  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".layout-toggle-wrapper")) {
      closeDropdown();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="layout-toggle-wrapper">
  <button
    class="layout-btn"
    onclick={() => (dropdownOpen = !dropdownOpen)}
    aria-label="Layout options"
    aria-expanded={dropdownOpen}
  >
    <!-- Resize/expand icon -->
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  </button>

  {#if dropdownOpen}
    <div class="layout-dropdown">
      <div class="section-label">Width</div>
      {#each WIDTH_OPTIONS as option}
        <button
          class="dropdown-item"
          class:active={widthMode === option.value}
          onclick={() => selectWidthMode(option.value)}
        >
          {#if widthMode === option.value}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          {:else}
            <span class="spacer"></span>
          {/if}
          <span>{option.label}</span>
        </button>
      {/each}

      <div class="divider"></div>

      <div class="section-label">Height</div>
      {#each HEIGHT_OPTIONS as option}
        <button
          class="dropdown-item"
          class:active={heightPreset === option.value}
          onclick={() => selectHeightPreset(option.value)}
        >
          {#if heightPreset === option.value}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          {:else}
            <span class="spacer"></span>
          {/if}
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .layout-toggle-wrapper {
    position: relative;
  }

  .layout-btn {
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

  .layout-btn:hover {
    background: var(--wf-border, #e2e8f0);
    color: var(--wf-fg, #1a1a1a);
  }

  .layout-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 160px;
    padding: 4px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 101;
  }

  .section-label {
    padding: 6px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--wf-muted, #94a3b8);
  }

  .divider {
    height: 1px;
    margin: 4px 8px;
    background: var(--wf-border, #e2e8f0);
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--wf-fg, #1a1a1a);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .dropdown-item:hover {
    background: var(--wf-border, #f1f5f9);
  }

  .dropdown-item.active {
    color: var(--wf-primary, #2563eb);
    font-weight: 500;
  }

  .dropdown-item svg {
    flex-shrink: 0;
    color: var(--wf-primary, #2563eb);
  }

  .spacer {
    width: 14px;
    flex-shrink: 0;
  }
</style>

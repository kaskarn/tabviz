<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import { autoPosition } from "$lib/dropdown-position";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  let dropdownOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);

  const zoom = $derived(store.zoom);
  const autoFit = $derived(store.autoFit);
  const actualScale = $derived(store.actualScale);
  const isClamped = $derived(store.isClamped);
  const maxWidth = $derived(store.maxWidth);
  const maxHeight = $derived(store.maxHeight);

  // Display percentages
  const displayPercent = $derived(Math.round(actualScale * 100));
  const zoomPercent = $derived(Math.round(zoom * 100));

  // Max size options
  const MAX_WIDTH_OPTIONS = [
    { value: null, label: 'None' },
    { value: 600, label: '600px' },
    { value: 800, label: '800px' },
    { value: 1000, label: '1000px' },
    { value: 1200, label: '1200px' },
  ];

  const MAX_HEIGHT_OPTIONS = [
    { value: null, label: 'None' },
    { value: 400, label: '400px' },
    { value: 600, label: '600px' },
    { value: 800, label: '800px' },
  ];

  function closeDropdown() {
    dropdownOpen = false;
  }

  // Handle zoom slider change (fires on release)
  function handleZoomSlider(event: Event) {
    const target = event.target as HTMLInputElement;
    store.setZoom(parseFloat(target.value) / 100);
  }

  // Handle max-width select
  function handleMaxWidthChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value === 'null' ? null : parseInt(target.value);
    store.setMaxWidth(value);
  }

  // Handle max-height select
  function handleMaxHeightChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value === 'null' ? null : parseInt(target.value);
    store.setMaxHeight(value);
  }

  // Close dropdown when clicking outside
  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".zoom-controls-wrapper")) {
      closeDropdown();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="zoom-controls-wrapper">
  <!-- Trigger button showing current actual scale -->
  <button
    bind:this={triggerEl}
    class="zoom-trigger-btn"
    onclick={() => (dropdownOpen = !dropdownOpen)}
    aria-label="Zoom and display options"
    aria-expanded={dropdownOpen}
    title="Zoom: {displayPercent}%"
  >
    <!-- Zoom/magnifier icon -->
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
    <span class="zoom-text">{displayPercent}%</span>
  </button>

  {#if dropdownOpen}
    <div class="zoom-dropdown" use:autoPosition={{ triggerEl }}>
      <!-- Zoom slider row -->
      <div class="zoom-row">
        <button
          class="zoom-btn"
          onclick={() => store.zoomOut()}
          title="Zoom out (Cmd -)"
          aria-label="Zoom out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <input
          type="range"
          class="zoom-slider"
          min="50"
          max="200"
          step="5"
          value={zoomPercent}
          onchange={handleZoomSlider}
          title="Zoom level"
          aria-label="Zoom level"
        />

        <button
          class="zoom-btn"
          onclick={() => store.zoomIn()}
          title="Zoom in (Cmd +)"
          aria-label="Zoom in"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <span class="zoom-value">{zoomPercent}%</span>
      </div>

      <!-- Clamped indicator -->
      {#if isClamped}
        <div class="clamped-note">
          Showing {displayPercent}% (auto-fit)
        </div>
      {/if}

      <!-- Reset button -->
      {#if zoom !== 1.0}
        <button
          class="action-btn"
          onclick={() => store.resetZoom()}
          title="Reset to 100% (Cmd 0)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset to 100%
        </button>
      {/if}

      <div class="divider"></div>

      <!-- Fit to width button -->
      <button
        class="action-btn"
        onclick={() => store.fitToWidth()}
        title="Fit to container width (Cmd 1)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12H3M21 12l-4-4m4 4l-4 4M3 12l4-4m-4 4l4 4" />
        </svg>
        Fit to width
      </button>

      <!-- Auto-fit checkbox -->
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={autoFit}
          onchange={(e) => store.setAutoFit((e.target as HTMLInputElement).checked)}
        />
        <span>Auto-fit</span>
        <span class="checkbox-hint">Shrink if too large</span>
      </label>

      <div class="divider"></div>

      <!-- Max Size section -->
      <div class="section-label">Max Size</div>

      <div class="select-row">
        <label>
          <span class="select-label">Width</span>
          <select
            value={maxWidth === null ? 'null' : maxWidth}
            onchange={handleMaxWidthChange}
          >
            {#each MAX_WIDTH_OPTIONS as opt}
              <option value={opt.value === null ? 'null' : opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="select-row">
        <label>
          <span class="select-label">Height</span>
          <select
            value={maxHeight === null ? 'null' : maxHeight}
            onchange={handleMaxHeightChange}
          >
            {#each MAX_HEIGHT_OPTIONS as opt}
              <option value={opt.value === null ? 'null' : opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      </div>
    </div>
  {/if}
</div>

<style>
  .zoom-controls-wrapper {
    position: relative;
  }

  .zoom-trigger-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 6px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-secondary, #64748b);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .zoom-trigger-btn:hover {
    background: var(--wf-border, #e2e8f0);
    color: var(--wf-fg, #1a1a1a);
  }

  .zoom-text {
    min-width: 28px;
    text-align: center;
  }

  .zoom-dropdown {
    /* position: fixed set dynamically by autoPosition to escape clipping */
    min-width: 200px;
    padding: 8px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.08);
    z-index: 10001;  /* High z-index to appear above everything */
  }

  .zoom-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 4px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .zoom-btn:hover {
    background: var(--wf-border, #e2e8f0);
    color: var(--wf-fg, #1a1a1a);
  }

  .zoom-slider {
    flex: 1;
    height: 4px;
    margin: 0 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--wf-border, #e2e8f0);
    border-radius: 2px;
    cursor: pointer;
  }

  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--wf-primary, #2563eb);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .zoom-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .zoom-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--wf-primary, #2563eb);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .zoom-value {
    min-width: 36px;
    font-size: 11px;
    font-weight: 500;
    color: var(--wf-secondary, #64748b);
    text-align: right;
  }

  .clamped-note {
    padding: 4px 8px;
    margin: 4px 0;
    font-size: 10px;
    color: var(--wf-primary, #2563eb);
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 10%, transparent);
    border-radius: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--wf-fg, #1a1a1a);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .action-btn:hover {
    background: var(--wf-border, #f1f5f9);
  }

  .action-btn svg {
    color: var(--wf-secondary, #64748b);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
  }

  .checkbox-row:hover {
    background: var(--wf-border, #f1f5f9);
  }

  .checkbox-row input {
    margin: 0;
    accent-color: var(--wf-primary, #2563eb);
  }

  .checkbox-hint {
    margin-left: auto;
    font-size: 10px;
    color: var(--wf-muted, #94a3b8);
  }

  .divider {
    height: 1px;
    margin: 8px 0;
    background: var(--wf-border, #e2e8f0);
  }

  .section-label {
    padding: 2px 8px 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--wf-muted, #94a3b8);
  }

  .select-row {
    padding: 4px 8px;
  }

  .select-row label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .select-label {
    min-width: 40px;
    color: var(--wf-secondary, #64748b);
  }

  .select-row select {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 4px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-size: 11px;
    cursor: pointer;
  }

  .select-row select:focus {
    outline: none;
    border-color: var(--wf-primary, #2563eb);
  }
</style>

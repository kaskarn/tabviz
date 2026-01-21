<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import { exportToSVG, exportToPNG, triggerDownload, generateFilename } from "$lib/export";
  import { autoPosition } from "$lib/dropdown-position";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  let dropdownOpen = $state(false);
  let isExporting = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);

  function closeDropdown() {
    dropdownOpen = false;
  }

  async function handleExportSVG() {
    if (!store.spec) return;

    try {
      isExporting = true;
      // Get current dimensions from store to match web view
      const dimensions = store.getExportDimensions();
      const svgString = exportToSVG(store.spec, dimensions);
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      triggerDownload(blob, generateFilename("svg"));
    } catch (error) {
      console.error("Failed to export SVG:", error);
    } finally {
      isExporting = false;
      closeDropdown();
    }
  }

  async function handleExportPNG() {
    if (!store.spec) return;

    try {
      isExporting = true;
      // Get current dimensions from store to match web view
      const dimensions = store.getExportDimensions();
      const blob = await exportToPNG(store.spec, dimensions, 2);
      triggerDownload(blob, generateFilename("png"));
    } catch (error) {
      console.error("Failed to export PNG:", error);
    } finally {
      isExporting = false;
      closeDropdown();
    }
  }

  // Close dropdown when clicking outside
  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".download-button-wrapper")) {
      closeDropdown();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="download-button-wrapper">
  <button
    bind:this={triggerEl}
    class="download-btn"
    onclick={() => (dropdownOpen = !dropdownOpen)}
    aria-label="Download plot"
    aria-expanded={dropdownOpen}
    disabled={isExporting}
  >
    {#if isExporting}
      <svg width="16" height="16" viewBox="0 0 24 24" class="spin">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10" />
      </svg>
    {:else}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    {/if}
  </button>

  {#if dropdownOpen}
    <div class="download-dropdown" use:autoPosition={{ triggerEl }}>
      <button class="dropdown-item" onclick={handleExportSVG} disabled={isExporting}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor" stroke="none">SVG</text>
        </svg>
        <span>Download SVG</span>
      </button>
      <button class="dropdown-item" onclick={handleExportPNG} disabled={isExporting}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span>Download PNG</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .download-button-wrapper {
    position: relative;
  }

  .download-btn {
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

  .download-btn:hover {
    background: var(--wf-border, #e2e8f0);
    color: var(--wf-fg, #1a1a1a);
  }

  .download-btn:disabled {
    cursor: wait;
  }

  .download-dropdown {
    /* position: fixed set dynamically by autoPosition to escape clipping */
    min-width: 140px;
    padding: 4px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 10001;  /* High z-index to appear above everything */
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

  .dropdown-item:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .dropdown-item svg {
    flex-shrink: 0;
    color: var(--wf-secondary, #64748b);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .spin {
    animation: spin 1s linear infinite;
  }
</style>

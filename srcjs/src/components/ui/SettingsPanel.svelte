<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import BandingControl from "./BandingControl.svelte";
  import ColorsControl from "./ColorsControl.svelte";
  import TabStub from "./TabStub.svelte";
  import ThemeSourceModal from "./ThemeSourceModal.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const open = $derived(store.settingsOpen);
  const hasEdits = $derived(store.hasThemeEdits);

  /**
   * Tab registry. Each entry lists the id, user-facing label, and (for stubs)
   * a short teaser of what's coming. Keep the order mirroring the R theme
   * object structure (groupings → colors → typography → spacing → shapes →
   * axis → layout) so the panel reads like the package's mental model.
   */
  const tabs: {
    id: string;
    label: string;
    stub?: string;
  }[] = [
    { id: "groupings", label: "Groupings" },
    { id: "colors", label: "Colors" },
    {
      id: "typography",
      label: "Typography",
      stub: "Font family, sizes, weights, line height, header scale — all the typography knobs from `set_typography()`.",
    },
    {
      id: "spacing",
      label: "Spacing",
      stub: "Row height, header height, cell padding, section gaps, container padding — the `set_spacing()` surface.",
    },
    {
      id: "shapes",
      label: "Shapes",
      stub: "Point size, summary diamond, line width, border radius, effect color palette, marker shapes — from `set_shapes()`.",
    },
    {
      id: "axis",
      label: "Axis",
      stub: "Range, ticks, gridlines, CI clipping, null-value handling — the `set_axis()` surface.",
    },
    {
      id: "layout",
      label: "Layout",
      stub: "Plot position, table/plot widths, container border — the `set_layout()` surface (banding lives in Groupings).",
    },
  ];
  let activeTabId = $state<string>("groupings");

  let panelRef = $state<HTMLElement | null>(null);
  let lastFocused: Element | null = null;

  let sourceOpen = $state(false);

  $effect(() => {
    if (open) {
      lastFocused = document.activeElement;
      queueMicrotask(() => panelRef?.focus());
    } else if (lastFocused instanceof HTMLElement) {
      lastFocused.focus();
      lastFocused = null;
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      // Don't close the whole panel if the source modal is the topmost layer —
      // it has its own Escape handler.
      if (sourceOpen) return;
      e.stopPropagation();
      store.closeSettings();
    }
  }

  function handleReset() {
    if (!hasEdits) return;
    if (window.confirm("Reset all theme edits and restore the preset?")) {
      store.resetThemeEdits();
      // Banding overrides live outside of themeEdits but feel like "edits" to
      // the user; reset them too so the button means "start fresh".
      store.setBandingOverride(null);
      store.setBandingStartsWithBand(null);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <button
    type="button"
    class="settings-backdrop"
    aria-label="Close settings"
    tabindex="-1"
    onclick={() => store.closeSettings()}
  ></button>

  <div
    bind:this={panelRef}
    class="settings-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Display settings"
    tabindex="-1"
  >
    <header class="panel-header">
      <h2>Settings</h2>
      <button
        type="button"
        class="close-btn"
        aria-label="Close settings"
        onclick={() => store.closeSettings()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </header>

    <div class="tab-bar" role="tablist" aria-label="Settings sections">
      {#each tabs as tab (tab.id)}
        <button
          type="button"
          role="tab"
          id="settings-tab-{tab.id}"
          aria-controls="settings-panel-{tab.id}"
          aria-selected={activeTabId === tab.id}
          class:active={activeTabId === tab.id}
          onclick={() => (activeTabId = tab.id)}
        >{tab.label}</button>
      {/each}
    </div>

    <div class="panel-body">
      {#each tabs as tab (tab.id)}
        {#if activeTabId === tab.id}
          <div
            class="tab-panel"
            role="tabpanel"
            id="settings-panel-{tab.id}"
            aria-labelledby="settings-tab-{tab.id}"
          >
            {#if tab.id === "groupings"}
              <BandingControl {store} />
            {:else if tab.id === "colors"}
              <ColorsControl {store} />
            {:else if tab.stub}
              <TabStub title={tab.label} teaser={tab.stub} />
            {/if}
          </div>
        {/if}
      {/each}
    </div>

    <footer class="panel-footer">
      <button
        type="button"
        class="ghost-btn"
        disabled={!hasEdits}
        onclick={handleReset}
        title={hasEdits ? "Restore the preset" : "No edits to reset"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Reset
      </button>
      <button
        type="button"
        class="primary-btn"
        onclick={() => (sourceOpen = true)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        View source
      </button>
    </footer>
  </div>

  <ThemeSourceModal {store} open={sourceOpen} onclose={() => (sourceOpen = false)} />
{/if}

<style>
  .settings-backdrop {
    position: absolute;
    inset: 0;
    z-index: 10010;
    background: color-mix(in srgb, var(--wf-fg, #0f172a) 12%, transparent);
    border: none;
    padding: 0;
    cursor: pointer;
    animation: backdrop-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .settings-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: clamp(320px, 40%, 440px);
    z-index: 10011;
    background: var(--wf-bg, #ffffff);
    border-left: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    box-shadow:
      -24px 0 48px -12px color-mix(in srgb, var(--wf-fg, #0f172a) 12%, transparent),
      -2px 0 0 0 color-mix(in srgb, var(--wf-primary, #2563eb) 5%, transparent);
    display: flex;
    flex-direction: column;
    outline: none;
    animation: panel-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes panel-in {
    from { transform: translateX(24px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--wf-fg, #1a1a1a);
  }

  .close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .close-btn:hover {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 10%, transparent);
    color: var(--wf-fg, #1a1a1a);
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 0 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-bar button {
    position: relative;
    padding: 10px 12px;
    border: none;
    background: transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s ease;
  }

  .tab-bar button::after {
    content: "";
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: -1px;
    height: 2px;
    background: var(--wf-primary, #2563eb);
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .tab-bar button.active {
    color: var(--wf-primary, #2563eb);
  }

  .tab-bar button.active::after {
    transform: scaleX(1);
  }

  .tab-bar button:hover:not(.active) {
    color: var(--wf-fg, #1a1a1a);
  }

  .panel-body {
    flex: 1;
    padding: 4px 16px 16px;
    overflow-y: auto;
  }

  .tab-panel {
    display: block;
  }

  .panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 3%, transparent);
  }

  .ghost-btn,
  .primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
  }

  .ghost-btn {
    border: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 80%, transparent);
    background: transparent;
    color: var(--wf-secondary, #64748b);
  }

  .ghost-btn:hover:not(:disabled) {
    color: var(--wf-fg, #1a1a1a);
    border-color: color-mix(in srgb, var(--wf-primary, #2563eb) 25%, var(--wf-border, #e2e8f0));
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 6%, transparent);
  }

  .ghost-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .primary-btn {
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 30%, transparent);
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 10%, var(--wf-bg, #ffffff));
    color: var(--wf-primary, #2563eb);
  }

  .primary-btn:hover {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 18%, var(--wf-bg, #ffffff));
    border-color: color-mix(in srgb, var(--wf-primary, #2563eb) 45%, transparent);
  }
</style>

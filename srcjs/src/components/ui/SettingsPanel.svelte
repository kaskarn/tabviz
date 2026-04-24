<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import BasicsControl from "./BasicsControl.svelte";
  import ColorsControl from "./ColorsControl.svelte";
  import SemanticsControl from "./SemanticsControl.svelte";
  import TypographyControl from "./TypographyControl.svelte";
  import SpacingControl from "./SpacingControl.svelte";
  import ShapesControl from "./ShapesControl.svelte";
  import AxisControl from "./AxisControl.svelte";
  import LayoutControl from "./LayoutControl.svelte";
  import ThemeSourceModal from "./ThemeSourceModal.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const open = $derived(store.settingsOpen);
  const hasEdits = $derived(store.hasThemeEdits);

  /**
   * Tab registry. Each entry lists the id, user-facing label, and (for stubs)
   * a short teaser of what's coming. Keep the order mirroring the R theme
   * object structure (banding → colors → typography → spacing → shapes →
   * axis → layout) so the panel reads like the package's mental model.
   */
  const tabs: { id: string; label: string }[] = [
    { id: "basics",     label: "Basics" },
    { id: "colors",     label: "Colors" },
    { id: "semantics",  label: "Semantics" },
    { id: "typography", label: "Typography" },
    { id: "spacing",    label: "Spacing" },
    { id: "shapes",     label: "Shapes" },
    { id: "axis",       label: "Axis" },
    { id: "layout",     label: "Layout" },
  ];
  let activeTabId = $state<string>("basics");

  let panelRef = $state<HTMLElement | null>(null);
  let lastFocused: Element | null = null;

  let sourceOpen = $state(false);
  let resetConfirmOpen = $state(false);

  // Bottom-fade scroll hint: fades in when the body is scrollable AND the
  // user hasn't scrolled to the bottom. Beta feedback — some users did not
  // realize the panel was scrollable. The fade is a subtle bg-to-transparent
  // gradient overlay anchored to the bottom of the body.
  let bodyEl = $state<HTMLElement | null>(null);
  let showBottomFade = $state(false);

  function updateScrollHint() {
    if (!bodyEl) {
      showBottomFade = false;
      return;
    }
    const { scrollHeight, clientHeight, scrollTop } = bodyEl;
    const overflowing = scrollHeight > clientHeight + 1;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
    showBottomFade = overflowing && !atBottom;
  }

  // Recompute the body scroll hint when the panel opens or the active tab
  // changes (content length varies across tabs).
  $effect(() => {
    void activeTabId; // track
    void open;        // track
    queueMicrotask(() => {
      updateScrollHint();
    });
  });

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
    resetConfirmOpen = true;
  }

  function confirmReset() {
    // Run the mutations synchronously so the store state is up-to-date
    // BEFORE the dialog closes. Then defer the close so Svelte 5 has a
    // chance to flush the `spec = { ...spec, theme: ... }` signal before
    // the ConfirmDialog's `{#if open}` unmounts its portal — closing in
    // the same synchronous frame as the mutation has bitten us before
    // when the dialog's unmount effect fired ahead of theme-propagating
    // derived recomputes, leaving stale controls on screen even though
    // spec.theme had already reverted.
    store.resetThemeEdits();
    // Banding overrides live outside of themeEdits but feel like "edits" to
    // the user; reset them too so the button means "start fresh".
    store.setBandingOverride(null);
    store.setBandingStartsWithBand(null);
    queueMicrotask(() => {
      resetConfirmOpen = false;
    });
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
    <!--
      Single-line bar: title | global actions | horizontally-scrollable tabs.
      Replaces the former header + tab-strip + footer three-row chrome to
      reclaim ~78px of vertical space for the tab body.
    -->
    <div class="panel-bar">
      <span class="bar-title">Settings</span>

      <div class="bar-actions">
        <button
          type="button"
          class="bar-icon-btn"
          aria-label="View theme source"
          title="View theme source"
          onclick={() => (sourceOpen = true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
        <button
          type="button"
          class="bar-icon-btn"
          disabled={!hasEdits}
          onclick={handleReset}
          aria-label={hasEdits ? "Reset theme edits" : "No edits to reset"}
          title={hasEdits ? "Reset theme edits" : "No edits to reset"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      <span class="bar-divider" aria-hidden="true"></span>

      <label class="tab-select-wrap">
        <span class="visually-hidden">Settings section</span>
        <select
          class="tab-select"
          aria-label="Settings section"
          bind:value={activeTabId}
        >
          {#each tabs as tab (tab.id)}
            <option value={tab.id}>{tab.label}</option>
          {/each}
        </select>
      </label>

      <!--
        Explicit close button. Keeping it visible even though backdrop /
        Esc / re-clicking the toolbar gear all dismiss the panel —
        users reported the other dismissal paths were not discoverable.
      -->
      <button
        type="button"
        class="bar-icon-btn"
        aria-label="Close settings"
        title="Close"
        onclick={() => store.closeSettings()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="panel-body-wrap">
      <div
        class="panel-body"
        bind:this={bodyEl}
        onscroll={updateScrollHint}
      >
        {#each tabs as tab (tab.id)}
        {#if activeTabId === tab.id}
          <div
            class="tab-panel"
            role="tabpanel"
            id="settings-panel-{tab.id}"
            aria-labelledby="settings-tab-{tab.id}"
          >
            {#if tab.id === "basics"}
              <BasicsControl {store} />
            {:else if tab.id === "colors"}
              <ColorsControl {store} />
            {:else if tab.id === "semantics"}
              <SemanticsControl {store} />
            {:else if tab.id === "typography"}
              <TypographyControl {store} />
            {:else if tab.id === "spacing"}
              <SpacingControl {store} />
            {:else if tab.id === "shapes"}
              <ShapesControl {store} />
            {:else if tab.id === "axis"}
              <AxisControl {store} />
            {:else if tab.id === "layout"}
              <LayoutControl {store} />
            {/if}
          </div>
        {/if}
        {/each}
      </div>
      <div class="scroll-fade" class:visible={showBottomFade} aria-hidden="true"></div>
    </div>
  </div>

  <ThemeSourceModal {store} open={sourceOpen} onclose={() => (sourceOpen = false)} />

  <ConfirmDialog
    open={resetConfirmOpen}
    title="Reset all edits?"
    message="This will discard every in-panel theme edit (colors, banding, phase, …) and restore the preset."
    confirmLabel="Reset"
    cancelLabel="Keep edits"
    variant="danger"
    onconfirm={confirmReset}
    oncancel={() => (resetConfirmOpen = false)}
  />
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

  /* ---------------------------------------------------------------------
     Single-line bar: [Settings] [⎘][↻] | [ tab tab tab … ]
     --------------------------------------------------------------------- */
  .panel-bar {
    display: flex;
    align-items: center;
    min-height: 34px;
    padding: 0 8px 0 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
    gap: 6px;
  }

  .bar-title {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--wf-secondary, #64748b);
  }

  .bar-actions {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
  }

  .bar-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .bar-icon-btn:hover:not(:disabled),
  .bar-icon-btn:focus-visible {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 12%, transparent);
    color: var(--wf-primary, #2563eb);
  }

  .bar-icon-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .bar-divider {
    flex-shrink: 0;
    width: 1px;
    height: 20px;
    background: color-mix(in srgb, var(--wf-border, #e2e8f0) 70%, transparent);
    margin: 0 4px;
  }

  /**
   * Tab selector. Native <select> keeps the tab strip compact and reads
   * well at every panel width — users previously missed tabs that were
   * scrolled off-screen behind a fade indicator.
   */
  .tab-select-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .tab-select {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 20%, transparent);
    border-radius: 6px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
  }

  .tab-select:focus-visible {
    outline: 2px solid var(--wf-primary, #2563eb);
    outline-offset: 1px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /**
   * Wrap the scrollable body in a positioned container so the bottom-fade
   * scroll hint can overlay without affecting scroll metrics.
   */
  .panel-body-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .panel-body {
    height: 100%;
    padding: 2px 12px 12px;
    overflow-y: auto;
  }

  /*
   * Bottom fade: appears only when there's content below the fold. Uses the
   * panel's theme-aware background so it blends regardless of palette.
   */
  .scroll-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 40px;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--wf-bg, #ffffff) 0%, transparent),
      var(--wf-bg, #ffffff)
    );
    opacity: 0;
    transition: opacity 0.18s ease;
  }

  .scroll-fade.visible {
    opacity: 1;
  }

  .tab-panel {
    display: block;
  }
</style>

<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import BasicsControl from "./BasicsControl.svelte";
  import ThemeControl from "./ThemeControl.svelte";
  import V2LayoutControl from "./V2LayoutControl.svelte";
  import V2SpacingControl from "./V2SpacingControl.svelte";
  import V2MarksControl from "./V2MarksControl.svelte";
  import V2TextControl from "./V2TextControl.svelte";
  import TabSelect from "./TabSelect.svelte";
  // Axis settings are per-column now (via the column configure popover on
  // viz_forest / viz_bar / viz_boxplot / viz_violin). The theme Axis tab
  // was removed in v0.18 — R's set_axis() still exists for users who want
  // a cross-cutting default, but the interactive surface is column-scoped.
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
  const tabs: { id: string; label: string; kind?: "normal" | "advanced" }[] = [
    { id: "labels",   label: "Labels" },
    { id: "theme",    label: "Theme" },
    { id: "layout",   label: "Layout" },
    { id: "spacing",  label: "Spacing", kind: "advanced" },
    { id: "viz",      label: "Viz",     kind: "advanced" },
    { id: "text",     label: "Text",    kind: "advanced" },
  ];
  let activeTabId = $state<string>("labels");

  let panelRef = $state<HTMLElement | null>(null);
  let lastFocused: Element | null = null;

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
        <!-- The per-panel "View theme source" icon retired in v0.20; the
             unified "View source" lives on the main toolbar now. -->
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

      <div class="tab-select-wrap">
        <TabSelect
          options={tabs}
          value={activeTabId}
          onchange={(id) => (activeTabId = id)}
          ariaLabel="Settings section"
        />
      </div>

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
            {#if tab.id === "labels"}
              <BasicsControl {store} />
            {:else if tab.id === "theme"}
              <ThemeControl {store} />
            {:else if tab.id === "layout"}
              <V2LayoutControl {store} />
            {:else if tab.id === "spacing"}
              <V2SpacingControl {store} />
            {:else if tab.id === "viz"}
              <V2MarksControl {store} />
            {:else if tab.id === "text"}
              <V2TextControl {store} />
            {/if}
          </div>
        {/if}
        {/each}
      </div>
      <div class="scroll-fade" class:visible={showBottomFade} aria-hidden="true"></div>
    </div>
  </div>

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
    background: color-mix(in srgb, var(--tv-fg, #0f172a) 12%, transparent);
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
    background: var(--tv-bg, #ffffff);
    border-left: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 15%, var(--tv-border, #e2e8f0));
    box-shadow:
      -24px 0 48px -12px color-mix(in srgb, var(--tv-fg, #0f172a) 12%, transparent),
      -2px 0 0 0 color-mix(in srgb, var(--tv-primary, #2563eb) 5%, transparent);
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
    border-bottom: 1px solid color-mix(in srgb, var(--tv-border, #e2e8f0) 60%, transparent);
    gap: 6px;
  }

  .bar-title {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--tv-secondary, #64748b);
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
    color: var(--tv-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .bar-icon-btn:hover:not(:disabled),
  .bar-icon-btn:focus-visible {
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 12%, transparent);
    color: var(--tv-primary, #2563eb);
  }

  .bar-icon-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .bar-divider {
    flex-shrink: 0;
    width: 1px;
    height: 20px;
    background: color-mix(in srgb, var(--tv-border, #e2e8f0) 70%, transparent);
    margin: 0 4px;
  }

  /**
   * Tab selector. Wraps TabSelect — a small themed dropdown that replaces
   * the native <select> we used briefly in v0.15 (feedback: looked too
   * plain against the rest of the widget).
   */
  .tab-select-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
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
      color-mix(in srgb, var(--tv-bg, #ffffff) 0%, transparent),
      var(--tv-bg, #ffffff)
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

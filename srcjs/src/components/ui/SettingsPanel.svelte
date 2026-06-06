<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import BasicsControl from "./BasicsControl.svelte";
  import ThemeControl from "./ThemeControl.svelte";
  import LayoutControl from "./LayoutControl.svelte";
  import SpacingControl from "./SpacingControl.svelte";
  import RowKindHeightsControl from "./RowKindHeightsControl.svelte";
  import MarksControl from "./MarksControl.svelte";
  import TextControl from "./TextControl.svelte";
  import TokensControl from "./TokensControl.svelte";
  // TabSelect removed Phase B — replaced by TabBar (horizontal row).
  // Axis settings are per-column now (via the column configure popover on
  // viz_forest / viz_bar / viz_boxplot / viz_violin). The theme Axis tab
  // was removed in v0.18 — R's set_axis() still exists for users who want
  // a cross-cutting default, but the interactive surface is column-scoped.
  import ConfirmDialog from "./ConfirmDialog.svelte";
  // v2 design tokens — the Field/Pill/Knob/Swatch primitives the
  // re-skinned *Field wrappers use cascade off [data-tv-v2]. Importing
  // here ensures the stylesheet ships with the widget bundle even when
  // ColumnEditorV2Popover hasn't been lazy-loaded yet.
  import "$components/primitives/v2/tokens.css";
  import TabSelect, { type TabOption } from "./TabSelect.svelte";
  import WatermarkControl from "./WatermarkControl.svelte";

  interface Props {
    store: TabvizStore;
  }

  const { store }: Props = $props();

  const open = $derived(store.settingsOpen);
  const hasEdits = $derived(store.hasThemeEdits);

  /**
   * Tab registry. Each entry lists the id, user-facing label, and (for stubs)
   * a short teaser of what's coming. Keep the order mirroring the R theme
   * object structure (banding → colors → typography → spacing → shapes →
   * axis → layout) so the panel reads like the package's mental model.
   */
  // Tab order: Layout (now includes Labels + Watermark — content used
  // to live in its own tab but those concerns belong together for the
  // viewer composing the plot), then Theme, then a divider for the
  // detail surfaces.
  const tabs: TabOption[] = [
    { id: "layout",   label: "Layout",  glyph: "section.layout",       description: "Labels, density, banding, watermark" },
    { id: "theme",    label: "Theme",   glyph: "section.style",        description: "Identity colors, fonts, cascade" },
    { id: "spacing",  label: "Spacing", glyph: "density.comfortable",  description: "Row heights, gaps, padding",       kind: "advanced" },
    { id: "viz",      label: "Viz",     glyph: "type.viz",             description: "Series shapes, mark sizes",        kind: "advanced" },
    { id: "text",     label: "Text",    glyph: "type.text",            description: "Per-role typography",              kind: "advanced" },
    { id: "tokens",   label: "Tokens",  glyph: "section.options",      description: "Semantic row/cell tokens",         kind: "advanced" },
  ];
  let activeTabId = $state<string>("layout");

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
    // Banding overrides + row-height pins live outside of themeEdits but
    // feel like "edits" to the user; reset them too so the button means
    // "start fresh". `hasThemeEdits` folds the same set (gate ≡ action).
    store.setBandingOverride(null);
    store.setBandingStartsWithBand(null);
    store.resetRowKindHeights();
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
    data-tv-v2
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

    <!-- Section selector — restyled v2 dropdown. Glyph + label + per-
         option description in the popover; compact ink chip in the bar.
         Reverted from the TabBar glyph-only row because seven abstract
         icons side-by-side don't read at a glance — legibility beats
         density on a low-frequency surface. -->
    <div class="tab-bar">
      <TabSelect
        options={tabs}
        value={activeTabId}
        onchange={(id) => (activeTabId = id)}
        ariaLabel="Settings section"
      />
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
            {#if tab.id === "theme"}
              <ThemeControl {store} />
            {:else if tab.id === "layout"}
              <!-- User-locked order: Layout → Banding → Borders →
                   Labels → Watermark. LayoutControl outputs Layout +
                   Banding + Borders (in that order, internally),
                   then BasicsControl renders Labels, then
                   WatermarkControl. -->
              <LayoutControl {store} />
              <BasicsControl {store} />
              <WatermarkControl {store} />
            {:else if tab.id === "spacing"}
              <SpacingControl {store} />
              <RowKindHeightsControl {store} />
            {:else if tab.id === "viz"}
              <MarksControl {store} />
            {:else if tab.id === "text"}
              <TextControl {store} />
            {:else if tab.id === "tokens"}
              <TokensControl {store} />
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
    message="This will discard every in-panel edit — theme fields, banding, row-height pins, watermark — and restore the initial state."
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
    background: color-mix(in srgb, var(--tv-text, #0f172a) 12%, transparent);
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
    /* Layered paper background: warm cream base + barely-visible paper
       grain (SVG noise) so the panel reads as a real surface, not flat
       digital chrome. The radial gradient adds a subtle vignette so the
       eye centers on the active content. */
    background:
      radial-gradient(120% 60% at 50% 0%, rgba(255, 255, 255, 0.5) 0%, transparent 65%),
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.08  0 0 0 0 0.07  0 0 0 0 0.05  0 0 0 0.045 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"),
      var(--tv-surface-bg, #faf7f0);
    border-left: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 15%, var(--tv-border, #e2e8f0));
    box-shadow:
      -24px 0 48px -12px color-mix(in srgb, var(--tv-text, #0f172a) 12%, transparent),
      -2px 0 0 0 color-mix(in srgb, var(--tv-accent, #2563eb) 5%, transparent);
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
    /* Display font for one moment — the panel's signature. Cinzel /
       EB Garamond / serif fallback. Real small caps via font-feature-
       settings so the proportions are correct vs CSS uppercase. */
    font-family: var(--v2-font-display, "EB Garamond", "Palatino", Georgia, serif);
    font-size: 0.95rem;
    font-weight: 500;
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: 0.14em;
    color: var(--v2-ink, #15140e);
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
    color: var(--tv-text-muted, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .bar-icon-btn:hover:not(:disabled),
  .bar-icon-btn:focus-visible {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 12%, transparent);
    color: var(--tv-accent, #2563eb);
  }

  .bar-icon-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }


  /**
   * (Former .tab-select-wrap removed when the inline TabSelect dropdown
   * was replaced by the dedicated TabBar row below the panel-bar.)
   */

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
    /* Top padding lives on the first v2 Section's head (12px); adding
       it here pushes the first section down for no reason. Zero top
       lets the section's own padding own the rhythm. */
    padding: 0 12px 12px;
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
      color-mix(in srgb, var(--tv-surface-bg, #ffffff) 0%, transparent),
      var(--tv-surface-bg, #ffffff)
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

  /* Section selector chip in the panel bar — sits flush in the panel
     body with mild side-padding so the v2 chip's own ink-rule border
     reads clearly without crowding the body header. */
  .tab-bar {
    display: flex;
    padding: 6px 8px 4px;
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
  }
</style>

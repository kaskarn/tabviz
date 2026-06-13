<script lang="ts">
  // Settings panel — TOTAL OVERHAUL (settings-overhaul P2; plan:
  // docs/dev/settings-overhaul-plan.md).
  //
  // The old tab apparatus (6 tabs, 4 "advanced", three control dialects,
  // a scroll-hint band-aid, hidden .sr-only shadow controls) is gone.
  // The panel is a two-part document on one vertical scroll:
  //
  //   PANEL BAR     settings · [Reset theme] · ✕
  //   THEME band    Tier-1 only — INTERIM shell while the D21 redesign
  //                 builds Variations/Labels/Identity/Plots/Styling
  //                 tab-by-tab (docs/dev/settings-redesign.md)
  //   FIGURE band   per-spec state, with its OWN scoped reset
  //
  // Boundary law (DT-11): nothing in this tree writes a Tier-2/3 theme
  // path — deep editing lives in the studio. The grep gate in
  // settings-band-contract.test.ts enforces it.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import FigureBand from "./settings/FigureBand.svelte";
  import VariationsTab from "./settings/VariationsTab.svelte";
  import LabelsTab from "./settings/LabelsTab.svelte";
  import IdentityTab from "./settings/IdentityTab.svelte";
  // v2 design tokens — the primitives cascade off [data-tv-v2].
  import "$components/primitives/v2/tokens.css";

  interface Props {
    store: TabvizStore;
  }

  const { store }: Props = $props();

  // ── D21 tab spine ────────────────────────────────────────────────────
  // Final IA: Variations | Labels | Edit theme{Identity · Plots · Styling}.
  // Built tab-by-tab (settings-redesign.md): variations (P1) + labels
  // (P2) + identity under "edit theme" (P3) are live. The Edit-theme
  // CLUSTER chrome (inner tab row Identity | Plots | Styling) arrives
  // with Phase 4 when a second inner tab exists; "figure" hosts the
  // interim figure band (row pins + scoped reset) until Styling absorbs
  // the pins.
  type PanelTab = "variations" | "labels" | "theme" | "figure";
  let activeTab = $state<PanelTab>("variations");
  const TABS: ReadonlyArray<{ id: PanelTab; label: string }> = [
    { id: "variations", label: "variations" },
    { id: "labels", label: "labels" },
    { id: "theme", label: "edit theme" },
    { id: "figure", label: "this figure" },
  ];

  const open = $derived(store.settingsOpen);
  const themeDirty = $derived(store.hasThemeEdits);

  let panelRef = $state<HTMLElement | null>(null);
  let lastFocused: Element | null = null;
  let resetConfirmOpen = $state(false);

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
      // preventDefault marks the Escape as CONSUMED for sibling window
      // listeners (ArrangeButton checks e.defaultPrevented) — plain
      // stopPropagation cannot suppress same-node listeners, so without
      // this one Escape closed the panel AND silently disarmed arrange.
      e.preventDefault();
      e.stopPropagation();
      store.closeSettings();
      return;
    }
    // Focus trap (a11y review): aria-modal promises focus containment —
    // without it Tab walks out into the table behind the backdrop. The
    // ConfirmDialog portals OUTSIDE the panel, so the trap stands down
    // while it's open.
    if (e.key === "Tab" && panelRef && !resetConfirmOpen) {
      const focusables = panelRef.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panelRef.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleResetTheme() {
    if (!themeDirty) return;
    resetConfirmOpen = true;
  }

  function confirmResetTheme() {
    // THEME-scoped only (the seam): figure state (banding / watermark /
    // row pins) has its own reset in the FIGURE band. Mutations run
    // synchronously, then the dialog closes on a microtask so Svelte
    // flushes the spec signal before the portal unmounts.
    store.resetThemeEdits();
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
    <div class="panel-bar">
      <span class="bar-title">settings</span>
      <div class="bar-actions">
        <button
          type="button"
          class="bar-btn"
          disabled={!themeDirty}
          onclick={handleResetTheme}
          title={themeDirty ? "Reset theme edits" : "No theme edits to reset"}
        >Reset theme</button>
        <button
          type="button"
          class="bar-icon-btn"
          onclick={() => store.closeSettings()}
          aria-label="Close settings"
          title="Close"
        >✕</button>
      </div>
    </div>

    <div class="tab-strip" role="tablist" aria-label="Settings sections">
      {#each TABS as t (t.id)}
        <button type="button" role="tab" class="tab"
                class:active={activeTab === t.id}
                aria-selected={activeTab === t.id}
                tabindex={activeTab === t.id ? 0 : -1}
                onclick={() => (activeTab = t.id)}>{t.label}</button>
      {/each}
    </div>

    <div class="panel-body">
      {#if activeTab === "variations"}
        <div class="tab-pad"><VariationsTab {store} /></div>
      {:else if activeTab === "labels"}
        <div class="tab-pad"><LabelsTab {store} /></div>
      {:else if activeTab === "theme"}
        <div class="tab-pad"><IdentityTab {store} /></div>
      {:else}
        <!-- Interim figure band — Labels absorbs this when Phase 2 lands. -->
        <FigureBand {store} />
      {/if}
    </div>
  </div>

  <ConfirmDialog
    open={resetConfirmOpen}
    title="Reset theme edits?"
    message="This reverts every theme edit (anchors, surface, type, effects) to the loaded theme. Figure state — banding, watermark, row pins — is untouched; reset it from the This-Figure section."
    confirmLabel="Reset theme"
    cancelLabel="Keep edits"
    variant="danger"
    onconfirm={confirmResetTheme}
    oncancel={() => (resetConfirmOpen = false)}
  />
{/if}

<style>
  .settings-backdrop {
    position: absolute;
    inset: 0;
    z-index: 10010;
    /* No scrim over the figure (user feedback 2026-06-08: dimming the table
       while editing its appearance defeats the purpose — you can't judge the
       change against a darkened preview). The element stays as an invisible
       click-outside-to-close target only. */
    background: transparent;
    border: none;
    padding: 0;
    cursor: default;
  }

  .settings-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    /* 400px fixed (locked decision) — the width the IA was designed for.
       min() only guards genuinely narrow embeds. */
    width: min(400px, 100%);
    z-index: 10011;
    background: var(--v2-paper, #faf7f0);
    border-left: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 15%, var(--tv-border, #e2e8f0));
    box-shadow: -24px 0 48px -12px color-mix(in srgb, var(--tv-text, #0f172a) 12%, transparent);
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
  @media (prefers-reduced-motion: reduce) {
    .settings-backdrop,
    .settings-panel { animation: none; }
  }

  .panel-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
    flex: none;
  }
  .bar-title {
    font-family: var(--v2-font-display, "EB Garamond", serif);
    font-size: var(--v2-text-large, 16px);
    font-variant-caps: small-caps;
    letter-spacing: 0.04em;
    color: var(--v2-ink, #15140e);
  }
  .bar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .bar-btn {
    font-size: var(--v2-text-body, 11.5px);
    padding: 3px 10px;
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
  }
  .bar-btn:hover:not(:disabled) {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .bar-btn:disabled { opacity: 0.4; cursor: default; }
  .bar-icon-btn {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink-3, #8a8478);
    cursor: pointer;
    font-size: 12px;
  }
  .bar-icon-btn:hover { color: var(--v2-ink, #15140e); background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }

  .tab-strip {
    display: flex;
    gap: 2px;
    padding: 0 12px;
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
    flex: none;
  }
  .tab {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 7px 8px 6px;
    margin-bottom: -1px;
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-small, 10.5px);
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--v2-ink-3, #8a8478);
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }
  .tab:hover { color: var(--v2-ink, #15140e); }
  .tab.active {
    color: var(--v2-ink, #15140e);
    border-bottom-color: var(--v2-ink, #15140e);
  }
  .tab:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: -1px;
  }

  .panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .tab-pad {
    padding: 0 12px;
  }
</style>

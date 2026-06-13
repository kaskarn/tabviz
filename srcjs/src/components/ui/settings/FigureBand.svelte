<!--
  FigureBand — the THIS-FIGURE half of the rebuilt settings panel
  (settings-overhaul P2). Per-spec state that does NOT travel with the
  theme: banding override, watermark, row-height pins. Sits on recessed
  paper with its own scoped reset — the seam is structural, not
  typographic (the one thing a pure visual refresh would have skipped).

  Title/caption/footnote text fields are deliberately ABSENT (T3
  decision): content is edited inline on the canvas (PlotHeader /
  PlotFooter dblclick), never in a settings overlay.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  // Banding controls moved to the VARIATIONS tab as theme-input writes
  // (settings-redesign Phase 1); the runtime override (Shiny set_banding)
  // still participates in figure dirty/reset below. The Contrast row left
  // too — it duplicated the toolbar's ContrastButton (view state belongs
  // to the toolbar, D21 ruling 10). Watermark moved to the LABELS tab
  // (Phase 2); this band keeps the row pins + the scoped figure reset
  // until Styling absorbs the pins.

  // ── Row-height pins ─────────────────────────────────────────────────
  // The roster lists every pinnable kind in the figure (not just pinned
  // ones), so the panel can CREATE a first pin — pre-arc the section only
  // appeared once a pin already existed, and nothing else in the widget
  // could make one (interactivity-UX arc P0).
  let pinsOpen = $state(false);
  const rowKinds = $derived(store.rowKindRoster);
  const pinnedCount = $derived(rowKinds.filter((r) => r.pinned).length);
  const pinsSummary = $derived(pinnedCount ? `${pinnedCount} pinned` : "default");

  const figureDirty = $derived(store.hasFigureEdits);

  function resetFigure(): void {
    store.resetWatermark();
    store.setBandingOverride(null);
    store.setBandingStartsWithBand(null);
    store.resetRowKindHeights();
    // Labels are figure content (travel matrix: Labels → Reset figure).
    store.resetLabelEdits();
  }
</script>

<div class="figure-band">
  <div class="seam">
    <span class="seam-title">this figure</span>
    <span class="seam-sub">stays with this figure · not exported with the theme</span>
  </div>

  {#if rowKinds.length > 0}
    <DisclosureField label="Row heights" summary={pinsSummary} bind:open={pinsOpen}>
      {#each rowKinds as { kind, px, pinned } (kind)}
        <Field label={kind.replace("_", " ")}>
          <span class="pin-row">
            <Slider value={px} min={12} max={120} step={1} suffix="px"
                    ariaLabel="{kind} row height"
                    onchange={(v) => store.setRowKindHeight(kind, v)}
                    oncommit={(v) => store.setRowKindHeight(kind, v)} />
            {#if pinned}
              <button type="button" class="pin-clear" title="Release pin"
                      onclick={() => store.setRowKindHeight(kind, null)}>↻</button>
            {:else}
              <!-- keep the slider track width stable between states -->
              <span class="pin-clear-spacer" aria-hidden="true"></span>
            {/if}
          </span>
        </Field>
      {/each}
    </DisclosureField>
  {/if}

  <div class="figure-foot">
    <button
      type="button"
      class="reset-figure"
      disabled={!figureDirty}
      onclick={resetFigure}
    >Reset figure</button>
  </div>
</div>

<style>
  .figure-band {
    /* Recessed paper: this state is embedded in THIS document, literally
       sunk below the portable theme above it. */
    background: var(--v2-paper-2, #f3efe5);
    border-top: 1px solid var(--v2-rule, #d6d0c1);
    padding: 0 12px 8px;
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
  }
  .seam {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 10px 0 6px;
  }
  .seam-title {
    font-family: var(--v2-font-sans, system-ui);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 700;
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink-2, #4a463c);
  }
  .seam-sub {
    font-size: var(--v2-text-small, 10.5px);
    /* ink-2, not ink-3: this band sits on recessed paper-2 where ink-3
       drops below readable contrast (a11y review). */
    color: var(--v2-ink-2, #4a463c);
  }
  .pin-row {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    width: 100%;
    min-width: 0;
  }
  .pin-clear {
    flex: none;
    width: 24px;
    height: var(--v2-control-h, 22px);
    border: 0;
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
    padding: 0;
  }
  .pin-clear:hover { color: var(--v2-ink, #15140e); background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }
  .pin-clear-spacer {
    flex: none;
    width: 24px;
    height: var(--v2-control-h, 22px);
  }
  .figure-foot {
    display: flex;
    justify-content: flex-end;
    padding-top: 6px;
  }
  .reset-figure {
    font-size: var(--v2-text-body, 11.5px);
    padding: 3px 10px;
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
  }
  .reset-figure:hover:not(:disabled) {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .reset-figure:disabled { opacity: 0.4; cursor: default; }
</style>

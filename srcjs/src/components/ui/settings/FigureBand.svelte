<!--
  FigureBand — the THIS-FIGURE half of the rebuilt settings panel
  (settings-overhaul P2). It OWNS the scoped reset for per-spec state that
  does NOT travel with the theme — banding override, watermark, labels,
  row-height pins — even though each of those controls now lives on the
  tab that best fits it. Sits on recessed paper: the seam is structural,
  not typographic (the one thing a pure visual refresh would have skipped).

  Title/caption/footnote text fields are deliberately ABSENT (T3
  decision): content is edited inline on the canvas (PlotHeader /
  PlotFooter dblclick), never in a settings overlay.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  // Banding controls moved to the VARIATIONS tab as theme-input writes
  // (settings-redesign Phase 1); the runtime override (Shiny set_banding)
  // still participates in figure dirty/reset below. The Contrast row left
  // too — it duplicated the toolbar's ContrastButton (view state belongs
  // to the toolbar, D21 ruling 10). Watermark moved to the LABELS tab
  // (Phase 2). The row-height pins moved to Edit theme → SPACING (D42
  // S-5: all height control in one place); they remain FIGURE state and
  // still reset from here — `resetFigure` below is the scoped reset for
  // every figure-tier edit, wherever its control now lives.
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

  <p class="seam-note">Row heights by type are in Edit theme → Spacing; they
    stay figure state and reset here.</p>

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
  .seam-note {
    margin: 0;
    font-size: var(--v2-text-small, 10.5px);
    line-height: 1.4;
    /* ink-2 for the same recessed-paper contrast reason as .seam-sub. */
    color: var(--v2-ink-2, #4a463c);
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

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
  import type { RowKind } from "$lib/layout/row-kind";
  import { EnumRow } from "$components/theme-controls";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import Swatch from "$components/primitives/v2/Swatch.svelte";
  import TextInput from "$components/primitives/v2/TextInput.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  // ── Banding (data-slice override; finite structural pick) ──────────
  // The pill must not lie (review P1 #3): group-N themes surface their
  // level in the Level slider, and re-picking "group" PRESERVES the
  // current level instead of collapsing it to null.
  const banding = $derived(store.effectiveBanding);
  const bandingValue = $derived.by(() => {
    if (!banding || banding.mode === "none") return "none";
    return banding.mode === "row" ? "row" : "group";
  });
  const bandingLevel = $derived(
    banding && banding.mode !== "none" && banding.mode !== "row"
      ? (banding.level ?? 1)
      : 1,
  );
  const groupDepth = $derived(store.maxGroupDepth);
  const startsWithBand = $derived(store.bandingStartsWithBand);

  function setBandingMode(v: string): void {
    if (v === "group") {
      // Preserve the active level when one exists.
      const lvl = banding && banding.mode !== "none" && banding.mode !== "row"
        ? banding.level : null;
      store.setBandingOverride(lvl ? `group-${lvl}` : "group");
    } else {
      store.setBandingOverride(v === "none" ? "none" : "row");
    }
  }

  // ── Watermark ───────────────────────────────────────────────────────
  let watermarkOpen = $state(false);
  const wmText = $derived(store.spec?.watermark ?? "");
  const wmColor = $derived(store.spec?.watermarkColor ?? null);
  const wmOpacity = $derived(store.spec?.watermarkOpacity ?? 0.08);
  const wmSummary = $derived(wmText ? `"${wmText}"` : "off");

  // ── Row-height pins ─────────────────────────────────────────────────
  let pinsOpen = $state(false);
  const pins = $derived(Object.entries(store.rowKindHeights) as Array<[RowKind, number]>);
  const pinsSummary = $derived(pins.length ? `${pins.length} pinned` : "none");

  const figureDirty = $derived(store.hasFigureEdits);

  function resetFigure(): void {
    store.resetWatermark();
    store.setBandingOverride(null);
    store.setBandingStartsWithBand(null);
    store.resetRowKindHeights();
  }
</script>

<div class="figure-band">
  <div class="seam">
    <span class="seam-title">this figure</span>
    <span class="seam-sub">stays with this figure · not exported with the theme</span>
  </div>

  <EnumRow
    label="Banding"
    value={bandingValue}
    segments={groupDepth > 0
      ? [
          { value: "none", label: "none" },
          { value: "row", label: "row" },
          { value: "group", label: "group" },
        ]
      : [
          { value: "none", label: "none" },
          { value: "row", label: "row" },
        ]}
    onchange={setBandingMode}
  />
  {#if bandingValue === "group" && groupDepth > 1}
    <Field label="Level" hint="Which group depth alternates the band.">
      <Slider value={bandingLevel} min={1} max={groupDepth} step={1}
              ariaLabel="Banding group level"
              oncommit={(v) => store.setBandingOverride(`group-${v}`)} />
    </Field>
  {/if}
  {#if bandingValue !== "none"}
    <EnumRow
      label="Start"
      hint="Whether the first band is shaded or plain."
      value={startsWithBand ? "band" : "plain"}
      segments={[
        { value: "band", label: "band" },
        { value: "plain", label: "plain" },
      ]}
      onchange={(v) => store.setBandingStartsWithBand(v === "band")}
    />
  {/if}

  <DisclosureField label="Watermark" summary={wmSummary} bind:open={watermarkOpen}>
    <Field label="Text">
      <TextInput
        value={wmText}
        alignLeft
        placeholder="DRAFT"
        ariaLabel="Watermark text"
        oncommit={(v) => store.setWatermark(v)}
      />
    </Field>
    {#if wmText}
      <Field label="Color">
        <Swatch value={wmColor} allowUnset
                onchange={(v) => store.setWatermarkColor(v)} />
      </Field>
      <Field label="Opacity">
        <Slider value={wmOpacity} min={0.02} max={0.5} step={0.01} valueWidth={4}
                ariaLabel="Watermark opacity"
                oncommit={(v) => store.setWatermarkOpacity(v)} />
      </Field>
    {/if}
  </DisclosureField>

  {#if pins.length > 0}
    <DisclosureField label="Row pins" summary={pinsSummary} bind:open={pinsOpen}>
      {#each pins as [kind, px] (kind)}
        <Field label={kind.replace("_", " ")}>
          <span class="pin-row">
            <Slider value={px} min={12} max={120} step={1} suffix="px"
                    ariaLabel="{kind} row height"
                    oncommit={(v) => store.setRowKindHeight(kind, v)} />
            <button type="button" class="pin-clear" title="Release pin"
                    onclick={() => store.setRowKindHeight(kind, null)}>↻</button>
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
    color: var(--v2-ink-3, #8a8478);
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
    width: 18px;
    height: var(--v2-control-h, 22px);
    border: 0;
    background: transparent;
    color: var(--v2-ink-3, #8a8478);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
    padding: 0;
  }
  .pin-clear:hover { color: var(--v2-ink, #15140e); background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }
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

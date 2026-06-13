<!--
  LabelsTab — Layer 1b of the settings redesign (D21; canonical plan:
  docs/dev/settings-redesign.md). FIGURE CONTENT: the words that travel
  with THIS figure, never with the theme — title / subtitle / caption /
  footnote / tag text plus the watermark. How they LOOK (title bar,
  chip vs stripe, fonts) is Variations/Identity territory.

  Travel (the matrix): label writes land on the session label overlay
  (store.setLabel → labelEdits; the exporter merges into spec.labels),
  watermark writes land on spec fields — both FIGURE state, reverted by
  Reset figure (which clears the label overlay too, wired this phase).
  Inline dblclick editing on the canvas stays; this tab is the panel
  surface for the same slots (one VERB underneath — setLabel).

  Label LOCATION controls (title placement etc.) arrive once the engine
  supports label positioning — the maintainer's "(once supported)".

  Consequence note: an EMPTY slot's field is still rendered (typing
  into it creates the label — the consequence is the creation), so no
  absence-gating here; the harness types real text into each field and
  asserts the figure repaints.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import Swatch from "$components/primitives/v2/Swatch.svelte";
  import TextInput from "$components/primitives/v2/TextInput.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  type Slot = "title" | "subtitle" | "caption" | "footnote" | "tag";
  const SLOTS: ReadonlyArray<{ slot: Slot; label: string; hint?: string; placeholder: string }> = [
    { slot: "title", label: "Title", placeholder: "Figure title" },
    { slot: "subtitle", label: "Subtitle", placeholder: "Subtitle" },
    { slot: "caption", label: "Caption", placeholder: "Caption below the figure", hint: "Prose below the plot." },
    { slot: "footnote", label: "Footnote", placeholder: "Footnote" },
    { slot: "tag", label: "Tag", placeholder: "TABLE 1", hint: "Short stamp on the shell chip (Variations → Tag picks the treatment)." },
  ];

  // ── Watermark (figure state; moved here from the figure band) ───────
  const wmText = $derived(store.spec?.watermark ?? "");
  const wmColor = $derived(store.spec?.watermarkColor ?? null);
  const wmOpacity = $derived(store.spec?.watermarkOpacity ?? 0.08);
</script>

<div class="labels-tab">
  {#each SLOTS as { slot, label, hint, placeholder } (slot)}
    <div data-lt={slot}>
      <Field {label} {hint}>
        <TextInput
          value={store.getPlotLabel(slot) ?? ""}
          alignLeft
          {placeholder}
          ariaLabel="{label} text"
          oncommit={(v) => store.setLabel(slot, v)}
        />
      </Field>
    </div>
  {/each}

  <div class="strata">watermark</div>
  <div data-lt="watermark">
    <Field label="Text">
      <TextInput
        value={wmText}
        alignLeft
        placeholder="DRAFT"
        ariaLabel="Watermark text"
        oncommit={(v) => store.setWatermark(v)}
      />
    </Field>
  </div>
  {#if wmText}
    <div data-lt="watermark-color">
      <Field label="Color">
        <Swatch value={wmColor} allowUnset
                onchange={(v) => store.setWatermarkColor(v)} />
      </Field>
    </div>
    <div data-lt="watermark-opacity">
      <Field label="Opacity">
        <Slider value={wmOpacity} min={0.02} max={0.5} step={0.01} valueWidth={4}
                ariaLabel="Watermark opacity"
                onchange={(v) => store.setWatermarkOpacity(v)}
                oncommit={(v) => store.setWatermarkOpacity(v)} />
      </Field>
    </div>
  {/if}
</div>

<style>
  .labels-tab {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
    padding: 8px 0;
  }
  .strata {
    margin-top: 8px;
    padding: 6px 0 2px;
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink-3, #8a8478);
  }
</style>

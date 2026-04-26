<script lang="ts">
  // v2 Theme tab: Tier 1 inputs.
  // Brand + accent (with deep companions), status colors, series anchor list,
  // font pickers. Preset picker lives at top.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import ColorField from "./ColorField.svelte";
  import FontFamilyPicker from "./FontFamilyPicker.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  const inputs = $derived(store.spec?.theme?.inputs);
  const series = $derived(store.spec?.theme?.series ?? []);

  function setInput(field: string, value: unknown) {
    store.setThemeField(["inputs", field], value);
  }

  function setSeriesAnchor(idx: number, hex: string) {
    store.setThemeField(["series", idx, "fill"], hex);
    // Also nudge the inputs.series_anchors mirror so source-export reads it.
    const anchors = (inputs?.seriesAnchors ?? []).slice();
    anchors[idx] = hex;
    store.setThemeField(["inputs", "seriesAnchors"], anchors);
  }

  function addSeries() {
    const anchors = (inputs?.seriesAnchors ?? []).slice();
    // New slot defaults to a copy of the brand color.
    anchors.push(inputs?.brand ?? "#888888");
    store.setThemeField(["inputs", "seriesAnchors"], anchors);
  }

  function removeSeries(idx: number) {
    const anchors = (inputs?.seriesAnchors ?? []).slice();
    if (anchors.length <= 1) return;
    anchors.splice(idx, 1);
    store.setThemeField(["inputs", "seriesAnchors"], anchors);
  }
</script>

{#if inputs}
  <SettingsSection title="Brand" description="Primary brand identity. Deep companion is used for text and strokes; defaults to brand.">
    <ColorField label="Brand" value={inputs.brand} onchange={(v) => setInput("brand", v)} />
    <ColorField
      label="Brand (deep)"
      hint="Text and stroke variant — defaults to brand"
      value={inputs.brandDeep ?? inputs.brand}
      onchange={(v) => setInput("brandDeep", v)}
    />
  </SettingsSection>

  <SettingsSection title="Accent" description="Chrome accent for hover, selection, and active state.">
    <ColorField label="Accent" value={inputs.accent} onchange={(v) => setInput("accent", v)} />
    <ColorField
      label="Accent (deep)"
      hint="Defaults to accent"
      value={inputs.accentDeep ?? inputs.accent}
      onchange={(v) => setInput("accentDeep", v)}
    />
  </SettingsSection>

  <SettingsSection title="Status" description="Semantic indicator colors.">
    <ColorField label="Positive" value={inputs.statusPositive} onchange={(v) => setInput("statusPositive", v)} />
    <ColorField label="Negative" value={inputs.statusNegative} onchange={(v) => setInput("statusNegative", v)} />
    <ColorField label="Warning"  value={inputs.statusWarning}  onchange={(v) => setInput("statusWarning", v)} />
    <ColorField label="Info"     value={inputs.statusInfo ?? inputs.accent} onchange={(v) => setInput("statusInfo", v)} />
  </SettingsSection>

  <SettingsSection title="Series" description="Per-effect anchor colors. Each anchor seeds a slot bundle (fill, stroke, muted, emphasis) at resolve time.">
    {#each series as _slot, i (i)}
      <div class="series-row">
        <ColorField
          label={`Series ${i + 1}`}
          value={inputs.seriesAnchors[i]}
          onchange={(v) => setSeriesAnchor(i, v)}
        />
        <button class="series-remove" onclick={() => removeSeries(i)} aria-label="Remove series">×</button>
      </div>
    {/each}
    <button class="series-add" onclick={addSeries}>+ Add series</button>
  </SettingsSection>

  <SettingsSection title="Fonts" description="Body font is the primary face; display optional for titles; mono optional for code-like cells.">
    <FontFamilyPicker label="Body" value={inputs.fontBody} onchange={(v) => setInput("fontBody", v)} />
    <FontFamilyPicker label="Display" value={inputs.fontDisplay ?? inputs.fontBody} onchange={(v) => setInput("fontDisplay", v)} />
    <FontFamilyPicker label="Mono" value={inputs.fontMono ?? ""} onchange={(v) => setInput("fontMono", v)} />
  </SettingsSection>
{/if}

<style>
  .series-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .series-row > :global(*:first-child) {
    flex: 1;
  }
  .series-remove {
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--tv-border);
    background: transparent;
    color: var(--tv-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
  }
  .series-remove:hover {
    border-color: var(--tv-accent);
    color: var(--tv-accent);
  }
  .series-add {
    margin-top: 0.25rem;
    padding: 0.35rem 0.6rem;
    border: 1px dashed var(--tv-border);
    background: transparent;
    color: var(--tv-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    width: 100%;
  }
  .series-add:hover {
    border-style: solid;
    border-color: var(--tv-accent);
    color: var(--tv-accent);
  }
</style>

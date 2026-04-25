<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import NumberField from "./NumberField.svelte";
  import ColorField from "./ColorField.svelte";
  import { resolveSwatches } from "$lib/swatches";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const shapes = $derived(store.spec?.theme?.shapes);
  const colors = $derived(store.spec?.theme?.colors);
  const swatches = $derived(resolveSwatches(store.spec?.theme));

  function setField(field: string, value: unknown) {
    store.setThemeField("shapes", field, value);
  }

  function setColor(field: string, value: string) {
    store.setThemeField("colors", field, value);
  }

  const sizeFields = [
    { key: "pointSize",      label: "Point size",     hint: "Forest plot marker diameter", min: 4,   max: 16, step: 1 },
    { key: "summaryHeight",  label: "Summary height", hint: "Pooled diamond height",       min: 8,   max: 24, step: 1 },
    { key: "lineWidth",      label: "Line width",     hint: "CI whisker stroke",           min: 0.5, max: 4,  step: 0.5 },
    { key: "tickMarkLength", label: "Tick mark",      hint: "Length of tick marks on viz axes", min: 0, max: 12, step: 1 },
  ];

  /**
   * Effect colors are an ordered palette (marker / bar / boxplot / violin across
   * series). Editing any slot writes the full array back so downstream derivations
   * stay internally consistent — `setThemeField("shapes", "effectColors", [...])`.
   */
  const effectColors = $derived((shapes?.effectColors ?? []) as string[]);

  function setEffectColor(idx: number, value: string) {
    const next = [...effectColors];
    next[idx] = value;
    setField("effectColors", next);
  }
</script>

{#if shapes}
  <SettingsSection
    title="Sizes"
    description="Marker and summary sizing in pixels."
  >
    {#each sizeFields as f (f.key)}
      <NumberField
        label={f.label}
        hint={f.hint}
        value={(shapes as Record<string, number>)[f.key]}
        min={f.min}
        max={f.max}
        step={f.step}
        unit="px"
        onchange={(v) => setField(f.key, v)}
      />
    {/each}
  </SettingsSection>

  {#if effectColors.length > 0}
    <SettingsSection
      title="Effect palette"
      description="Colors cycled through when a viz column has multiple effects (e.g. dose arms)."
    >
      {#each effectColors as c, i (i)}
        <ColorField
          label={`Effect ${i + 1}`}
          value={c}
          onchange={(v) => setEffectColor(i, v)}
          {swatches}
        />
      {/each}
    </SettingsSection>
  {/if}

  {#if colors}
    <SettingsSection
      title="Lines"
      description="Stroke colors for viz line elements."
    >
      <ColorField
        label="CI whisker"
        hint="Stroke color for confidence-interval whiskers in forest plots"
        value={colors.intervalLine}
        onchange={(v) => setColor("intervalLine", v)}
        {swatches}
      />
    </SettingsSection>
  {/if}
{/if}

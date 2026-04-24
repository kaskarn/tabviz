<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import NumberField from "./NumberField.svelte";
  import ColorField from "./ColorField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const shapes = $derived(store.spec?.theme?.shapes);

  function setField(field: string, value: unknown) {
    store.setThemeField("shapes", field, value);
  }

  const sizeFields = [
    { key: "pointSize",     label: "Point size",      hint: "Forest plot marker diameter", min: 4,   max: 16, step: 1 },
    { key: "summaryHeight", label: "Summary height",  hint: "Pooled diamond height",       min: 8,   max: 24, step: 1 },
    { key: "lineWidth",     label: "Line width",      hint: "CI whisker stroke",           min: 0.5, max: 4,  step: 0.5 },
    { key: "borderRadius",  label: "Border radius",   hint: "Rounding on bars / boxes",    min: 0,   max: 12, step: 1 },
  ];

  const borderFields = [
    { key: "rowBorderWidth",      label: "Row border",       hint: "Between data rows (0 to hide)", min: 0, max: 6, step: 1 },
    { key: "headerBorderWidth",   label: "Header border",    hint: "Under column headers",          min: 0, max: 6, step: 1 },
    { key: "rowGroupBorderWidth", label: "Group border",     hint: "Under row-group headers (requires a level border toggle on)", min: 0, max: 6, step: 1 },
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

  <SettingsSection
    title="Borders"
    description="Border weights (px). Zero hides the border."
  >
    {#each borderFields as f (f.key)}
      <NumberField
        label={f.label}
        hint={f.hint}
        value={(shapes as Record<string, number>)[f.key] ?? 1}
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
        />
      {/each}
    </SettingsSection>
  {/if}
{/if}

<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import TextField from "./TextField.svelte";
  import NumberField from "./NumberField.svelte";
  import FontFamilyPicker from "./FontFamilyPicker.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const typography = $derived(store.spec?.theme?.typography);

  function setField(field: string, value: unknown) {
    store.setThemeField("typography", field, value);
  }

  const sizeFields: { key: string; label: string; hint: string }[] = [
    { key: "fontSizeSm", label: "Small", hint: "Captions, footnotes" },
    { key: "fontSizeBase", label: "Base", hint: "Body text, table cells" },
    { key: "fontSizeLg", label: "Large", hint: "Headings, emphasis" },
  ];

  const weightFields: { key: string; label: string; hint: string }[] = [
    { key: "fontWeightNormal", label: "Normal", hint: "Default body weight" },
    { key: "fontWeightMedium", label: "Medium", hint: "Active row, highlights" },
    { key: "fontWeightBold", label: "Bold", hint: "Headers, emphasis" },
  ];
</script>

{#if typography}
  <SettingsSection
    title="Font family"
    description="Pick a curated stack or supply your own via Custom. Applies to both the HTML widget and SVG exports."
  >
    <FontFamilyPicker
      label="Family"
      hint="Curated tabular fonts; pick Custom for any CSS stack"
      value={typography.fontFamily}
      onchange={(v) => setField("fontFamily", v)}
    />
  </SettingsSection>

  <SettingsSection
    title="Sizes"
    description="Free-form CSS lengths — rem, em, px, or pt all work."
  >
    {#each sizeFields as f (f.key)}
      <TextField
        label={f.label}
        hint={f.hint}
        value={(typography as Record<string, string>)[f.key]}
        onchange={(v) => setField(f.key, v)}
      />
    {/each}
  </SettingsSection>

  <SettingsSection
    title="Weights"
    description="Numeric weight values (100–900). 400 is normal, 700 is bold."
  >
    {#each weightFields as f (f.key)}
      <NumberField
        label={f.label}
        hint={f.hint}
        value={(typography as Record<string, number>)[f.key]}
        min={100}
        max={900}
        step={100}
        onchange={(v) => setField(f.key, v)}
      />
    {/each}
  </SettingsSection>

  <SettingsSection
    title="Metrics"
    description="Vertical rhythm and header scaling."
  >
    <NumberField
      label="Line height"
      hint="Multiplier of font size — vertical rhythm for all text (titles, headers, body, footers)"
      value={typography.lineHeight}
      min={1.0}
      max={2.0}
      step={0.05}
      onchange={(v) => setField("lineHeight", v)}
    />
    <NumberField
      label="Header scale"
      hint="Header font size = base × this"
      value={typography.headerFontScale}
      min={0.8}
      max={1.5}
      step={0.05}
      onchange={(v) => setField("headerFontScale", v)}
    />
  </SettingsSection>
{/if}

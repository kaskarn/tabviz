<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import NumberField from "./NumberField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const spacing = $derived(store.spec?.theme?.spacing);

  function setField(field: string, value: number) {
    store.setThemeField("spacing", field, value);
  }

  const rowFields = [
    { key: "rowHeight",    label: "Row height",    hint: "Data-row line height", min: 16, max: 60 },
    { key: "headerHeight", label: "Header height", hint: "Column header row",    min: 20, max: 72 },
  ];

  const cellPaddingFields = [
    { key: "cellPaddingX", label: "Horizontal", hint: "Left / right of each cell", min: 0, max: 24 },
    { key: "cellPaddingY", label: "Vertical",   hint: "Top / bottom of each cell", min: 0, max: 20 },
  ];

  const gapFields = [
    { key: "sectionGap",       label: "Section gap",      hint: "Between column-group headers and content",         min: 0, max: 40 },
    { key: "axisGap",          label: "Axis gap",         hint: "Space between rows region and the axis line",      min: 0, max: 40 },
    { key: "columnGap",        label: "Column gap",       hint: "Space between top-level column groups",            min: 0, max: 40 },
    { key: "groupPadding",     label: "Group padding",    hint: "Extra padding on column group headers",            min: 0, max: 40 },
    { key: "padding",          label: "Plot padding",     hint: "Padding inside the SVG plot region",               min: 0, max: 40 },
    { key: "containerPadding", label: "Container padding",hint: "Outer padding around the whole widget",            min: 0, max: 40 },
  ];
</script>

{#if spacing}
  <SettingsSection
    title="Rows"
    description="Vertical size of data and header rows."
  >
    {#each rowFields as f (f.key)}
      <NumberField
        label={f.label}
        hint={f.hint}
        value={(spacing as Record<string, number>)[f.key]}
        min={f.min}
        max={f.max}
        step={1}
        unit="px"
        onchange={(v) => setField(f.key, v)}
      />
    {/each}
  </SettingsSection>

  <SettingsSection
    title="Cell padding"
    description="Inner padding on every table cell."
  >
    {#each cellPaddingFields as f (f.key)}
      <NumberField
        label={f.label}
        hint={f.hint}
        value={(spacing as Record<string, number>)[f.key]}
        min={f.min}
        max={f.max}
        step={1}
        unit="px"
        onchange={(v) => setField(f.key, v)}
      />
    {/each}
  </SettingsSection>

  <SettingsSection
    title="Gaps & container"
    description="Horizontal gaps between groups, plot padding, and the outer container."
  >
    {#each gapFields as f (f.key)}
      <NumberField
        label={f.label}
        hint={f.hint}
        value={(spacing as Record<string, number>)[f.key]}
        min={f.min}
        max={f.max}
        step={1}
        unit="px"
        onchange={(v) => setField(f.key, v)}
      />
    {/each}
  </SettingsSection>
{/if}

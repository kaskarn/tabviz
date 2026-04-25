<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import NumberField from "./NumberField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const spacing = $derived(store.spec?.theme?.spacing);
  const shapes  = $derived(store.spec?.theme?.shapes);

  function setSpacingField(field: string, value: number) {
    store.setThemeField("spacing", field, value);
  }

  function setShapesField(field: string, value: number) {
    store.setThemeField("shapes", field, value);
  }

  // Keep the existing call-site name so the template churn stays minimal.
  const setField = setSpacingField;

  const rowFields = [
    { key: "rowHeight",    label: "Row height",    hint: "Data-row line height", min: 16, max: 60 },
    { key: "headerHeight", label: "Header height", hint: "Column header row",    min: 20, max: 72 },
  ];

  const cellPaddingFields = [
    // Vertical cell padding deprecated in v0.21.x — single-line text is
    // flex-centered regardless and grid-template-rows pinned the row
    // height, so the field could only clip content. Raise `Row height`
    // for breathing room.
    { key: "cellPaddingX", label: "Horizontal", hint: "Left / right of each cell", min: 0, max: 24 },
  ];

  const gapFields = [
    { key: "axisGap",             label: "Axis gap",            hint: "Space between rows region and the axis line",       min: 0, max: 40 },
    { key: "columnGroupPadding",  label: "Column group padding",hint: "Left/right padding on spanning column headers",    min: 0, max: 40 },
    { key: "rowGroupPadding",     label: "Row group padding",   hint: "Extra horizontal padding for row-group header rows",min: 0, max: 40 },
    { key: "footerGap",           label: "Footer gap",          hint: "Vertical space between plot / axis and the caption / footnote band", min: 0, max: 40 },
    { key: "titleSubtitleGap",    label: "Title↔subtitle gap",  hint: "Vertical gap between the title and subtitle when both are shown",    min: 0, max: 40 },
    { key: "bottomMargin",        label: "Bottom margin",       hint: "Trailing space below the last band in SVG exports",                  min: 0, max: 40 },
    { key: "containerPadding",    label: "Container padding",   hint: "Outer padding around the whole widget (interactive + SVG export)", min: 0, max: 40 },
  ];

  // Border-weight knobs (v0.19) — moved from the Viz tab to keep visual
  // spacing concepts grouped in one place.
  const borderFields = [
    { key: "rowBorderWidth",      label: "Row border",    hint: "Between data rows (0 to hide)",                                          min: 0, max: 6, step: 1 },
    { key: "headerBorderWidth",   label: "Header border", hint: "Under column headers",                                                   min: 0, max: 6, step: 1 },
    { key: "rowGroupBorderWidth", label: "Group border",  hint: "Under row-group headers (requires a level border toggle on)",            min: 0, max: 6, step: 1 },
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
    description="Horizontal gaps between groups and the outer container."
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

  {#if shapes}
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
          onchange={(v) => setShapesField(f.key, v)}
        />
      {/each}
    </SettingsSection>
  {/if}
{/if}

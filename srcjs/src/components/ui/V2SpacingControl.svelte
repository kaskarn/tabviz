<script lang="ts">
  // v2 Spacing tab. Per-token overrides on top of the density preset.
  // Tokens grouped into coherent sections instead of a single flat list
  // behind an "Advanced" dropdown — the dropdown was hiding the entire
  // tab body, which made the Spacing tab feel empty.
  //
  // Two density tokens are NOT surfaced here:
  //  * spacing.padding ("Plot padding") — historical export-only knob
  //    that the interactive widget intentionally does not consume
  //    (containerPadding owns the outer-gutter story; padding would
  //    compound and produce two sliders that fight each other).
  //  * spacing.columnGroupPadding ("Column group pad") — only affects
  //    .column-group-header padding-left/right; for typical headers
  //    that fit within their column-group span, the visual effect is
  //    nil. Niche enough not to warrant a top-level slider.
  // Both stay on the SpacingTokens spec so authors can override via
  // set_spacing() in R.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import NumberField from "./NumberField.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  const spacing = $derived(store.spec?.theme?.spacing);

  function set(field: string, value: number) {
    store.setThemeField(["spacing", field], value);
  }

  // Coherent groups instead of one flat list.
  const sections = [
    {
      title: "Row sizing",
      description: "Vertical room for body and header rows; padding inside cells.",
      tokens: [
        { field: "rowHeight",     label: "Row height",     min: 16, max: 60, step: 1 },
        { field: "headerHeight",  label: "Header height",  min: 18, max: 80, step: 1 },
        { field: "cellPaddingX",  label: "Cell padding (X)", min: 0,  max: 40, step: 1 },
      ],
    },
    {
      title: "Outer margins",
      description: "Container gutter and the gap below the plot before captions.",
      tokens: [
        { field: "containerPadding", label: "Container padding", min: 0, max: 40, step: 1 },
        { field: "bottomMargin",     label: "Bottom margin",     min: 0, max: 40, step: 1 },
      ],
    },
    {
      title: "Groups & nesting",
      description: "Spacing between row-groups and indent per nesting level.",
      tokens: [
        { field: "rowGroupPadding", label: "Row group pad",   min: 0, max: 32, step: 1 },
        { field: "indentPerLevel",  label: "Indent per level", min: 0, max: 40, step: 1 },
      ],
    },
    {
      title: "Plot scaffolding",
      description: "Gaps inside and around the plot region — title block to table, between title and subtitle, table to axis, table to footer.",
      tokens: [
        { field: "axisGap",          label: "Axis gap",            min: 0, max: 40, step: 1 },
        { field: "titleSubtitleGap", label: "Title-subtitle gap",  min: 0, max: 40, step: 1 },
        { field: "headerGap",        label: "Header-table gap",    min: 0, max: 40, step: 1 },
        { field: "footerGap",        label: "Footer gap",          min: 0, max: 40, step: 1 },
      ],
    },
  ];
</script>

{#if spacing}
  {#each sections as section (section.title)}
    <SettingsSection title={section.title} description={section.description}>
      {#each section.tokens as t (t.field)}
        <NumberField
          label={t.label}
          value={spacing[t.field] ?? 0}
          min={t.min} max={t.max} step={t.step}
          onchange={(v) => set(t.field, v)}
        />
      {/each}
    </SettingsSection>
  {/each}
{/if}

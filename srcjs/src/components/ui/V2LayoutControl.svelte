<script lang="ts">
  // v2 Layout tab: per-table variants + container border.
  // Banding lives on the Basics tab (BandingControl) — that's the path the
  // renderer reads via store.effectiveBanding. We don't duplicate it here.
  // Density is variant-dispatched in R but the resolved spacing tokens are
  // what the renderer actually reads, so the density picker writes the full
  // SpacingTokens preset client-side too.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import NumberField from "./NumberField.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  const variants = $derived(store.spec?.theme?.variants);
  const layout   = $derived(store.spec?.theme?.layout);

  function setVariant(field: string, value: string) {
    store.setThemeField(["variants", field], value);
  }
  function setLayout(field: string, value: unknown) {
    store.setThemeField(["layout", field], value);
  }
  function setSpacing(field: string, value: number) {
    store.setThemeField(["spacing", field], value);
  }

  // Mirror of R's DENSITY_PRESETS so density-picker edits the same tokens
  // that the renderer reads via theme.spacing.*. Without this, picking a
  // density would only write variants.density (which the renderer ignores
  // — it reads the resolved spacing values directly).
  const DENSITY_PRESETS: Record<string, Record<string, number>> = {
    compact: {
      rowHeight: 20, headerHeight: 26, padding: 8, containerPadding: 0,
      axisGap: 8, columnGroupPadding: 6, rowGroupPadding: 0,
      cellPaddingX: 8, footerGap: 6, titleSubtitleGap: 10,
      bottomMargin: 12, indentPerLevel: 14,
    },
    comfortable: {
      rowHeight: 24, headerHeight: 32, padding: 12, containerPadding: 0,
      axisGap: 12, columnGroupPadding: 8, rowGroupPadding: 0,
      cellPaddingX: 10, footerGap: 8, titleSubtitleGap: 13,
      bottomMargin: 16, indentPerLevel: 16,
    },
    spacious: {
      rowHeight: 30, headerHeight: 40, padding: 16, containerPadding: 0,
      axisGap: 16, columnGroupPadding: 12, rowGroupPadding: 0,
      cellPaddingX: 14, footerGap: 12, titleSubtitleGap: 18,
      bottomMargin: 22, indentPerLevel: 20,
    },
  };

  function changeDensity(value: string) {
    setVariant("density", value);
    const preset = DENSITY_PRESETS[value];
    if (preset) {
      for (const [field, val] of Object.entries(preset)) setSpacing(field, val);
    }
  }
</script>

{#if variants}
  <SettingsSection title="Density" description="Picks a spacing preset. The Spacing tab can override individual tokens on top.">
    <SegmentedField
      label=""
      value={variants.density}
      options={[
        { value: "compact",     label: "Compact" },
        { value: "comfortable", label: "Comfortable" },
        { value: "spacious",    label: "Spacious" },
      ]}
      onchange={changeDensity}
    />
  </SettingsSection>

  <SettingsSection title="Header style" description="Light reads on the muted surface; bold puts the column-header row on a dark fill with inverse text.">
    <SegmentedField
      label=""
      value={variants.headerStyle}
      options={[
        { value: "light", label: "Light" },
        { value: "bold",  label: "Bold" },
      ]}
      onchange={(v) => setVariant("headerStyle", v)}
    />
  </SettingsSection>

  <SettingsSection title="First column" description="Bold gives the first column an Excel-style row-label treatment.">
    <SegmentedField
      label=""
      value={variants.firstColumnStyle}
      options={[
        { value: "default", label: "Default" },
        { value: "bold",    label: "Bold" },
      ]}
      onchange={(v) => setVariant("firstColumnStyle", v)}
    />
  </SettingsSection>
{/if}

{#if layout}
  <SettingsSection title="Container" description="Outer container styling.">
    <BooleanField
      label="Border"
      value={layout.containerBorder}
      onchange={(v) => setLayout("containerBorder", v)}
    />
    <NumberField
      label="Border radius"
      value={layout.containerBorderRadius ?? 8}
      min={0} max={32} step={1}
      onchange={(v) => setLayout("containerBorderRadius", v)}
    />
  </SettingsSection>
{/if}

<script lang="ts">
  // v2 Layout tab: per-table variants + container.
  // Density slider, header_style segmented, first_column_style segmented,
  // banding picker (with level stepper), container border, plot width.
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
  const banding  = $derived(store.spec?.theme?.row?.banding ?? "group");

  function setVariant(field: string, value: string) {
    store.setThemeField(["variants", field], value);
  }

  function setLayout(field: string, value: unknown) {
    store.setThemeField(["layout", field], value);
  }

  function setBanding(value: string) {
    store.setThemeField(["row", "banding"], value);
  }

  // Banding mode + optional group level. Parse "group-N".
  const bandingMode = $derived.by(() => {
    if (banding === "row" || banding === "none") return banding;
    return "group";
  });
  const bandingLevel = $derived.by(() => {
    const m = /^group-(\d+)$/.exec(banding ?? "");
    return m ? parseInt(m[1], 10) : 0;
  });

  function changeBandingMode(mode: string) {
    if (mode === "group" && bandingLevel > 0) {
      setBanding(`group-${bandingLevel}`);
    } else {
      setBanding(mode);
    }
  }
  function changeBandingLevel(n: number) {
    if (bandingMode !== "group") return;
    setBanding(n > 0 ? `group-${n}` : "group");
  }
</script>

{#if variants}
  <SettingsSection title="Density" description="Drives spacing tokens. Per-token overrides live on the Spacing tab.">
    <SegmentedField
      label=""
      value={variants.density}
      options={[
        { value: "compact",     label: "Compact" },
        { value: "comfortable", label: "Comfortable" },
        { value: "spacious",    label: "Spacious" },
      ]}
      onchange={(v) => setVariant("density", v)}
    />
  </SettingsSection>

  <SettingsSection title="Header style" description="Light reads on the table surface; bold puts the column-header row on a dark fill.">
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

  <SettingsSection title="Banding" description="Row striping mode. Group-level uses a numeric depth.">
    <SegmentedField
      label="Mode"
      value={bandingMode}
      options={[
        { value: "none",  label: "None" },
        { value: "row",   label: "Row" },
        { value: "group", label: "Group" },
      ]}
      onchange={changeBandingMode}
    />
    {#if bandingMode === "group"}
      <NumberField
        label="Group level"
        hint="0 = deepest available"
        value={bandingLevel}
        min={0} max={5} step={1}
        onchange={changeBandingLevel}
      />
    {/if}
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

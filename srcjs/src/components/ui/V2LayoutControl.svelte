<script lang="ts">
  // v2 Layout tab: per-table variants + container border + banding.
  // Banding moved here from the Labels tab in C2 — it's a structural
  // choice (alternates rows by group / by index), not an annotation.
  // Density is variant-dispatched in R but the resolved spacing tokens
  // are what the renderer actually reads, so the density picker writes
  // the full SpacingTokens preset client-side too.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import NumberField from "./NumberField.svelte";
  import BandingControl from "./BandingControl.svelte";
  import { oklchDarken, oklchMix, oklchChroma } from "$lib/oklch";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  const variants = $derived(store.spec?.theme?.variants);
  const layout   = $derived(store.spec?.theme?.layout);
  const inputs   = $derived(store.spec?.theme?.inputs);
  const theme    = $derived(store.spec?.theme);

  function setVariant(field: string, value: string) {
    store.setThemeField(["variants", field], value);
  }
  function setInput(field: string, value: unknown) {
    store.setThemeField(["inputs", field], value);
  }
  function setLayout(field: string, value: unknown) {
    store.setThemeField(["layout", field], value);
  }
  function setSpacing(field: string, value: number) {
    store.setThemeField(["spacing", field], value);
  }
  function setDerived(path: (string | number)[], value: unknown) {
    store.setThemeFieldDerived(path, value);
  }

  // Mirror of R's DENSITY_PRESETS so density-picker edits the same tokens
  // that the renderer reads via theme.spacing.*. Without this, picking a
  // density would only write variants.density (which the renderer ignores
  // — it reads the resolved spacing values directly).
  const DENSITY_PRESETS: Record<string, Record<string, number>> = {
    compact: {
      rowHeight: 20, headerHeight: 26, padding: 8, containerPadding: 0,
      axisGap: 8, columnGroupPadding: 6, rowGroupPadding: 0,
      cellPaddingX: 8, footerGap: 6, titleSubtitleGap: 10, headerGap: 8,
      bottomMargin: 12, indentPerLevel: 14,
    },
    comfortable: {
      rowHeight: 24, headerHeight: 32, padding: 12, containerPadding: 0,
      axisGap: 12, columnGroupPadding: 8, rowGroupPadding: 0,
      cellPaddingX: 10, footerGap: 8, titleSubtitleGap: 13, headerGap: 12,
      bottomMargin: 16, indentPerLevel: 16,
    },
    spacious: {
      rowHeight: 30, headerHeight: 40, padding: 16, containerPadding: 0,
      axisGap: 16, columnGroupPadding: 12, rowGroupPadding: 0,
      cellPaddingX: 14, footerGap: 12, titleSubtitleGap: 18, headerGap: 16,
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

  // ── header_style cascade ──────────────────────────────────────────
  // Mirrors R-side resolve_components: header_style gates the row-group
  // L1 bg strength (16% under "light", 24% under "tint"/"bold"). Re-derive
  // the cached L1/L2/L3 bg so the visible band tracks the new variant.
  function surfaceBaseline(): string {
    return theme?.surface?.base ?? "#ffffff";
  }
  function currentSecondaryDeep(): string {
    const sd = inputs?.secondaryDeep as string | undefined;
    if (sd) return sd;
    const pd = inputs?.primaryDeep as string | undefined;
    if (pd) return pd;
    const p = inputs?.primary as string | undefined;
    return p ? oklchDarken(p, 0.15) : "#475569";
  }
  function changeHeaderStyle(value: string) {
    setVariant("headerStyle", value);
    const strength = value === "light" ? 0.16 : 0.24;
    const l1Bg = oklchMix(surfaceBaseline(), currentSecondaryDeep(), strength);
    setDerived(["rowGroup", "L1", "bg"], l1Bg);
    setDerived(["rowGroup", "L2", "bg"], l1Bg);
    setDerived(["rowGroup", "L3", "bg"], l1Bg);
  }

  // ── slot_style cascade ────────────────────────────────────────────
  // Re-derives every series slot bundle under the new fill/stroke pairing
  // convention. Reads the canonical anchor from inputs.seriesAnchors[i]
  // (NOT from the rendered series[i].fill, which under "outlined" is
  // already the surface-mixed lightened value — using it as the anchor
  // would compound the lightening on every click).
  function changeSlotStyle(value: "fill_with_darker_stroke" | "flat_fill" | "outlined") {
    setInput("slotStyle", value);
    const anchors = (inputs?.seriesAnchors as string[] | undefined) ?? [];
    const surface = surfaceBaseline();
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      if (!anchor) continue;
      const fillMuted = oklchMix(anchor, surface, 0.65);
      if (value === "flat_fill") {
        const emphasis = oklchChroma(oklchDarken(anchor, 0.05), 0.04);
        setDerived(["series", i, "fill"],            anchor);
        setDerived(["series", i, "stroke"],          anchor);
        setDerived(["series", i, "fillMuted"],       fillMuted);
        setDerived(["series", i, "strokeMuted"],     fillMuted);
        setDerived(["series", i, "fillEmphasis"],    emphasis);
        setDerived(["series", i, "strokeEmphasis"],  emphasis);
      } else if (value === "outlined") {
        setDerived(["series", i, "fill"],            oklchMix(anchor, surface, 0.15));
        setDerived(["series", i, "stroke"],          anchor);
        setDerived(["series", i, "fillMuted"],       oklchMix(anchor, surface, 0.08));
        setDerived(["series", i, "strokeMuted"],     oklchDarken(fillMuted, 0.10));
        setDerived(["series", i, "fillEmphasis"],    oklchMix(anchor, surface, 0.30));
        setDerived(["series", i, "strokeEmphasis"],  oklchDarken(anchor, 0.20));
      } else {
        setDerived(["series", i, "fill"],            anchor);
        setDerived(["series", i, "stroke"],          oklchDarken(anchor, 0.10));
        setDerived(["series", i, "fillMuted"],       fillMuted);
        setDerived(["series", i, "strokeMuted"],     oklchDarken(fillMuted, 0.10));
        setDerived(["series", i, "fillEmphasis"],    oklchChroma(oklchDarken(anchor, 0.05), 0.04));
        setDerived(["series", i, "strokeEmphasis"],  oklchDarken(anchor, 0.20));
      }
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

  <SettingsSection title="Header style" description="Light = bare surface band; tint = subtle primary-tinted band; bold = full primary_deep band with inverse text. Tint and bold also drive a stronger row-group bar.">
    <SegmentedField
      label=""
      value={variants.headerStyle}
      options={[
        { value: "light", label: "Light" },
        { value: "tint",  label: "Tint" },
        { value: "bold",  label: "Bold" },
      ]}
      onchange={changeHeaderStyle}
    />
  </SettingsSection>

  <SettingsSection title="Slot style" description="How every series mark pairs fill and stroke. Fill + stroke is the publication default; flat reads as a single tone; outlined makes the stroke carry the anchor identity with a near-surface fill.">
    <SegmentedField
      label=""
      value={(inputs?.slotStyle as ("fill_with_darker_stroke" | "flat_fill" | "outlined" | undefined)) ?? "fill_with_darker_stroke"}
      options={[
        { value: "fill_with_darker_stroke", label: "Fill + stroke" },
        { value: "flat_fill",               label: "Flat" },
        { value: "outlined",                label: "Outlined" },
      ]}
      onchange={changeSlotStyle}
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

<BandingControl {store} />

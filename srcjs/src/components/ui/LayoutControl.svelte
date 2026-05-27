<script lang="ts">
  // v2 Layout tab: per-table variants + container border + banding.
  // Banding moved here from the Labels tab in C2 — it's a structural
  // choice (alternates rows by group / by index), not an annotation.
  // Density is variant-dispatched in R but the resolved spacing tokens
  // are what the renderer actually reads, so the density picker writes
  // the full SpacingTokens preset client-side too.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import NumberField from "./NumberField.svelte";
  import ColorField from "./ColorField.svelte";
  import BandingControl from "./BandingControl.svelte";
  import { oklchDarken, oklchMix, oklchChroma } from "$lib/oklch";

  interface Props {
    store: TabvizStore;
  }
  let { store }: Props = $props();

  const variants = $derived(store.spec?.theme?.variants);
  const layout   = $derived(store.spec?.theme?.layout);
  const inputs   = $derived(store.spec?.theme?.inputs);
  const theme    = $derived(store.spec?.theme);
  const borders  = $derived(store.spec?.theme?.borders);

  function setVariant(field: string, value: string) {
    store.setThemeField(["variants", field], value);
  }
  function setInput(field: string, value: unknown) {
    store.setThemeField(["inputs", field], value);
  }
  function setLayout(field: string, value: unknown) {
    store.setThemeField(["layout", field], value);
  }
  function setBordersField(path: (string | number)[], value: unknown) {
    store.setThemeField(["borders", ...path], value);
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

<!--
  Layout tab: density / header style / slot style live as Field rows
  (label-on-left, control-on-right) under a single "Layout" section.
  Each used to be a full section with its own title + description
  paragraph; the per-knob redundancy was visual noise. Now the
  Section acts as the section header and each knob is a Field with a
  hint tooltip carrying the explanation.
-->
{#if variants}
  <Section
    title="Layout"
    hint="Three structural choices applied site-wide. Spacing tab can override individual tokens on top of the density preset."
  >
    <SegmentedField
      label="Density"
      hint="Spacing preset — Compact / Comfortable / Spacious."
      value={variants.density}
      options={[
        { value: "compact",     label: "Compact" },
        { value: "comfortable", label: "Comfy"   },
        { value: "spacious",    label: "Roomy"   },
      ]}
      onchange={changeDensity}
    />
    <SegmentedField
      label="Header"
      hint="Light = bare surface band; tint = subtle primary-tinted band; bold = full primary_deep band with inverse text. Tint and bold also drive a stronger row-group bar."
      value={variants.headerStyle}
      options={[
        { value: "light", label: "Light" },
        { value: "tint",  label: "Tint" },
        { value: "bold",  label: "Bold" },
      ]}
      onchange={changeHeaderStyle}
    />
    <SegmentedField
      label="Slot"
      hint="Series fill/stroke pairing. Fill + stroke is the publication default; flat reads as a single tone; outlined makes the stroke carry the anchor identity with a near-surface fill."
      value={(inputs?.slotStyle as ("fill_with_darker_stroke" | "flat_fill" | "outlined" | undefined)) ?? "fill_with_darker_stroke"}
      options={[
        { value: "fill_with_darker_stroke", label: "F+S"   },
        { value: "flat_fill",               label: "Flat"  },
        { value: "outlined",                label: "Lined" },
      ]}
      onchange={changeSlotStyle}
    />
  </Section>
{/if}

{#if borders}
  <Section
    title="Borders"
    hint="Layout × type model. Layout picks which dividers paint (horizontal rows, vertical columns, grid = both, none); the three types control thickness, single/double, and color."
  >
    <SegmentedField
      label="Layout"
      hint="Where dividers paint. Default is horizontal (row dividers only); grid adds column dividers; vertical removes row dividers; none disables all."
      value={borders.layout}
      options={[
        { value: "horizontal", label: "Rows" },
        { value: "vertical",   label: "Cols" },
        { value: "grid",       label: "Grid" },
        { value: "none",       label: "None" },
      ]}
      onchange={(v: string) => setBordersField(["layout"], v)}
    />
    <!-- Minor: data row + column dividers. Most user feedback wants this
         knob, so it's first. -->
    <NumberField
      label="Minor thickness"
      hint="Row + column data divider thickness in px."
      value={borders.minor.thickness}
      min={0} max={4} step={1} unit="px"
      onchange={(v: number) => setBordersField(["minor", "thickness"], v)}
    />
    <SegmentedField
      label="Minor style"
      hint="Single hairline or paired-hairline (engraved) style."
      value={borders.minor.style}
      options={[
        { value: "single", label: "Single" },
        { value: "double", label: "Double" },
      ]}
      onchange={(v: string) => setBordersField(["minor", "style"], v)}
    />
    <ColorField
      label="Minor color"
      value={borders.minor.color}
      onchange={(v: string) => setBordersField(["minor", "color"], v)}
    />
    <!-- Major: header bottom + group / summary breaks. -->
    <NumberField
      label="Major thickness"
      hint="Header bottom + group / summary divider thickness in px."
      value={borders.major.thickness}
      min={0} max={6} step={1} unit="px"
      onchange={(v: number) => setBordersField(["major", "thickness"], v)}
    />
    <SegmentedField
      label="Major style"
      hint="Single hairline or paired-hairline (engraved) style."
      value={borders.major.style}
      options={[
        { value: "single", label: "Single" },
        { value: "double", label: "Double" },
      ]}
      onchange={(v: string) => setBordersField(["major", "style"], v)}
    />
    <ColorField
      label="Major color"
      value={borders.major.color}
      onchange={(v: string) => setBordersField(["major", "color"], v)}
    />
    <!-- Table: outer edge. Paints regardless of layout (except "none"). -->
    <NumberField
      label="Table thickness"
      hint="Outer edge thickness in px. Set to 0 to drop the outer frame."
      value={borders.table.thickness}
      min={0} max={6} step={1} unit="px"
      onchange={(v: number) => setBordersField(["table", "thickness"], v)}
    />
    <SegmentedField
      label="Table style"
      hint="Single hairline or paired-hairline (engraved) style."
      value={borders.table.style}
      options={[
        { value: "single", label: "Single" },
        { value: "double", label: "Double" },
      ]}
      onchange={(v: string) => setBordersField(["table", "style"], v)}
    />
    <ColorField
      label="Table color"
      value={borders.table.color}
      onchange={(v: string) => setBordersField(["table", "color"], v)}
    />
  </Section>
{/if}

<BandingControl {store} />

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
    glyph="section.layout"
    hint="Three structural choices applied site-wide. Spacing tab can override individual tokens on top of the density preset."
  >
    <!-- Density preview: three tiny mock-row stacks at the proportional
         row heights (compact 8 / comfy 11 / roomy 14). Active option's
         frame thickens. Diagrammatic — eliminates having to imagine
         what "Comfy" means before clicking. -->
    <div class="density-preview" aria-hidden="true">
      {#each [
        { value: "compact",     label: "Compact", h: 4 },
        { value: "comfortable", label: "Comfy",   h: 5 },
        { value: "spacious",    label: "Roomy",   h: 7 },
      ] as opt}
        <button
          type="button"
          class="density-card"
          class:active={variants.density === opt.value}
          onclick={() => changeDensity(opt.value)}
          aria-label={`Set density to ${opt.label}`}
        >
          <svg viewBox="0 0 30 22" width="30" height="22">
            <rect x="2" y="2"            width="26" height={opt.h} fill="var(--v2-paper-2, #f3efe5)"/>
            <rect x="2" y={4 + opt.h}    width="26" height={opt.h} fill="var(--v2-paper-2, #f3efe5)"/>
            <rect x="2" y={6 + 2*opt.h}  width="26" height={opt.h} fill="var(--v2-paper-2, #f3efe5)"/>
          </svg>
          <span class="density-label">{opt.label}</span>
        </button>
      {/each}
    </div>
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
    glyph="section.borders"
    hint="Layout × type model. Layout picks where dividers paint; the three types control thickness, single/double, and color."
  >
    <!-- Diagram preview: a tiny table mockup with major/minor/table
         labels annotated. Self-documenting — eliminates the need to
         explain in prose what each divider type does. -->
    <div class="borders-diagram" aria-hidden="true">
      <svg viewBox="0 0 160 70" width="100%" preserveAspectRatio="xMidYMid meet">
        <!-- Table edge (outer rect) -->
        <rect x="6" y="6" width="148" height="58" fill="none"
              stroke={borders.table.color} stroke-width="1.4"/>
        <!-- Header bottom — MAJOR -->
        <line x1="6" y1="22" x2="154" y2="22"
              stroke={borders.major.color}
              stroke-width={borders.major.style === "double" ? "0.8" : "1.4"}/>
        {#if borders.major.style === "double"}
          <line x1="6" y1="24" x2="154" y2="24" stroke={borders.major.color} stroke-width="0.8"/>
        {/if}
        <!-- Row dividers — MINOR (only when layout includes horizontal) -->
        {#if borders.layout === "horizontal" || borders.layout === "grid"}
          <line x1="6" y1="36" x2="154" y2="36" stroke={borders.minor.color} stroke-width="0.7"/>
          <line x1="6" y1="50" x2="154" y2="50" stroke={borders.minor.color} stroke-width="0.7"/>
        {/if}
        <!-- Column dividers — MINOR (only when layout includes vertical) -->
        {#if borders.layout === "vertical" || borders.layout === "grid"}
          <line x1="60" y1="6" x2="60" y2="64" stroke={borders.minor.color} stroke-width="0.7"/>
          <line x1="108" y1="6" x2="108" y2="64" stroke={borders.minor.color} stroke-width="0.7"/>
        {/if}
        <!-- Annotation labels — each sits on the row where its line
             paints so the eye traces label → diagram naturally. -->
        <text x="158" y="9"  class="anno" text-anchor="start">table</text>
        <text x="158" y="25" class="anno" text-anchor="start">major</text>
        <text x="158" y="39" class="anno" text-anchor="start">minor</text>
      </svg>
    </div>
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

<style>
  /* Density preview row — three mock-row stacks. Click selects. */
  .density-preview {
    display: flex;
    gap: 6px;
    padding: 4px 8px 8px 28px;
  }
  .density-card {
    appearance: none;
    border: 0;
    padding: 4px 6px 5px;
    background: var(--v2-paper-edge, #fff);
    border-radius: var(--v2-r-soft, 3px);
    box-shadow: inset 0 0 0 1px var(--v2-rule-soft, #e6e0d1);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition:
      box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease),
      transform var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .density-card:hover {
    transform: translateY(-1px);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
  }
  .density-card.active {
    box-shadow: inset 0 0 0 1.5px var(--v2-ink, #15140e);
  }
  .density-label {
    font-family: var(--v2-font-sans, system-ui);
    font-size: 9.5px;
    color: var(--v2-ink-2, #4a463c);
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: 0.1em;
    line-height: 1;
  }
  .density-card.active .density-label { color: var(--v2-ink, #15140e); }

  /* Borders section diagram — a small annotated table mockup that
     visualizes which divider goes where. Updates live as the user
     edits borders.layout / borders.{major,minor,table}.{color,style}. */
  .borders-diagram {
    margin: 4px 8px 6px 28px;
    padding: 8px 56px 8px 8px;
    background: var(--v2-paper-edge, #ffffff);
    border-radius: var(--v2-r-soft, 3px);
    box-shadow: inset 0 0 0 1px var(--v2-rule-soft, #e6e0d1);
  }
  .borders-diagram :global(text.anno) {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 7px;
    fill: var(--v2-ink-3, #8a8478);
    letter-spacing: 0.08em;
  }
</style>

<script lang="ts">
  // v2 Layout tab: per-table variants + container border + banding.
  // Banding moved here from the Labels tab in C2 — it's a structural
  // choice (alternates rows by group / by index), not an annotation.
  // Density is variant-dispatched in R but the resolved spacing tokens
  // are what the renderer actually reads, so the density picker writes
  // the full SpacingTokens preset client-side too.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import ColorField from "./ColorField.svelte";
  import BandingControl from "./BandingControl.svelte";
  import { oklchDarken, oklchMix, oklchChroma } from "$lib/oklch";
  import {
    getCssVars, readAccentDefault, readSurfaceBg,
    readSeriesAnchors, readSlotStyle,
  } from "$lib/theme/consumer-bridge";

  interface Props {
    store: TabvizStore;
  }
  const { store }: Props = $props();

  const variants = $derived(store.spec?.theme?.variants);
  const layout   = $derived(store.spec?.theme?.layout);
  const theme    = $derived(store.spec?.theme);
  const borders  = $derived(store.spec?.theme?.borders);

  function setVariant(field: string, value: string) {
    store.setThemeField(["variants", field], value);
  }
  function setInput(field: string, value: unknown) {
    // V4: slot_style lives on authoringInputs (Tier-1 input), not on the
    // v3 ResolvedInputs compat shim. Other "inputs.X" setter paths in
    // this file were already migrated away; this is the last one.
    store.setThemeField(["authoringInputs", field], value);
  }
  function setLayout(field: string, value: unknown) {
    store.setThemeField(["layout", field], value);
  }
  function setBordersField(path: (string | number)[], value: unknown) {
    store.setThemeField(["borders", ...path], value);
  }

  // ── Border layout axis decoupling ─────────────────────────────────
  // The UI exposes H and V as independent axis cyclers, but the wire
  // model keeps the existing `borders.layout` 4-state field. These
  // helpers translate between the two views so the UI feels axis-
  // decoupled without a wire-shape change.
  type LayoutState = "horizontal" | "vertical" | "grid" | "none";
  function layoutHasH(l: LayoutState) { return l === "horizontal" || l === "grid"; }
  function layoutHasV(l: LayoutState) { return l === "vertical"   || l === "grid"; }
  function withH(l: LayoutState, on: boolean): LayoutState {
    const v = layoutHasV(l); if (on && v) return "grid"; if (on) return "horizontal";
    return v ? "vertical" : "none";
  }
  function withV(l: LayoutState, on: boolean): LayoutState {
    const h = layoutHasH(l); if (on && h) return "grid"; if (on) return "vertical";
    return h ? "horizontal" : "none";
  }
  function cycleThickness(cur: number, max: number): number {
    return cur >= max ? 1 : (cur < 1 ? 1 : cur + 1);
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
    return theme ? readSurfaceBg(getCssVars(theme)) : "#ffffff";
  }
  function currentSecondaryDeep(): string {
    // V4: brand routes through accent for layered emphasis; identity-
    // secondary cascade dropped. Darken the accent to recover the
    // "deeper than identity" feel the v3 cascade used to pick.
    if (!theme) return "#475569";
    const accent = readAccentDefault(getCssVars(theme));
    return oklchDarken(accent, 0.15);
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
  // convention. Reads the canonical anchor from readSeriesAnchors(theme)
  // (NOT from the rendered series[i].fill, which under "outlined" is
  // already the surface-mixed lightened value — using it as the anchor
  // would compound the lightening on every click).
  function changeSlotStyle(value: "fill_with_darker_stroke" | "flat_fill" | "outlined") {
    setInput("slot_style", value);
    const anchors = readSeriesAnchors(theme);
    const surface = surfaceBaseline();
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      if (!anchor) continue;
      const fillDim = oklchMix(anchor, surface, 0.65);
      if (value === "flat_fill") {
        const hot = oklchChroma(oklchDarken(anchor, 0.05), 0.04);
        setDerived(["series", i, "fill"],       anchor);
        setDerived(["series", i, "stroke"],     anchor);
        setDerived(["series", i, "fillDim"],    fillDim);
        setDerived(["series", i, "strokeDim"],  fillDim);
        setDerived(["series", i, "fillHot"],    hot);
        setDerived(["series", i, "strokeHot"],  hot);
      } else if (value === "outlined") {
        setDerived(["series", i, "fill"],       oklchMix(anchor, surface, 0.15));
        setDerived(["series", i, "stroke"],     anchor);
        setDerived(["series", i, "fillDim"],    oklchMix(anchor, surface, 0.08));
        setDerived(["series", i, "strokeDim"],  oklchDarken(fillDim, 0.10));
        setDerived(["series", i, "fillHot"],    oklchMix(anchor, surface, 0.30));
        setDerived(["series", i, "strokeHot"],  oklchDarken(anchor, 0.20));
      } else {
        setDerived(["series", i, "fill"],       anchor);
        setDerived(["series", i, "stroke"],     oklchDarken(anchor, 0.10));
        setDerived(["series", i, "fillDim"],    fillDim);
        setDerived(["series", i, "strokeDim"],  oklchDarken(fillDim, 0.10));
        setDerived(["series", i, "fillHot"],    oklchChroma(oklchDarken(anchor, 0.05), 0.04));
        setDerived(["series", i, "strokeHot"],  oklchDarken(anchor, 0.20));
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
    <!-- Density / Header / Marks pickers now wrapped in Field so each
         picker-row's content aligns to the panel's control spine —
         same x as Primary/Secondary swatches above. Three card-strips
         use a 3-column 1fr grid with shared SVG viewBox so cards are
         strictly equal-width and pixel-rhythmic. Density uses the
         line-stack glyph-segment (agents flagged it doesn't need card
         footprint). -->
    {@const accent = theme ? readAccentDefault(getCssVars(theme)) : "#0891B2"}
    {@const primary = accent}
    {@const primaryDeep = theme ? oklchDarken(accent, 0.15) : "#1F2937"}

    <Field label="Density">
      <div class="layout-pickers" role="radiogroup" aria-label="Density">
        {#each [
          { value: "compact",     label: "Compact", h: 4 },
          { value: "comfortable", label: "Comfy",   h: 5 },
          { value: "spacious",    label: "Roomy",   h: 7 },
        ] as opt}
          <button
            type="button"
            class="layout-card glyph-only"
            class:active={variants.density === opt.value}
            onclick={() => changeDensity(opt.value)}
            aria-label={`Set density to ${opt.label}`}
            aria-pressed={variants.density === opt.value}
            title={opt.label}
          >
            <svg viewBox="0 0 36 22" width="100%" height="22" preserveAspectRatio="xMidYMid meet">
              <rect x="3" y="2"            width="30" height={opt.h} fill="var(--v2-ink-2, #4a463c)" opacity="0.7"/>
              <rect x="3" y={4 + opt.h}    width="30" height={opt.h} fill="var(--v2-ink-2, #4a463c)" opacity="0.7"/>
              <rect x="3" y={6 + 2*opt.h}  width="30" height={opt.h} fill="var(--v2-ink-2, #4a463c)" opacity="0.7"/>
            </svg>
          </button>
        {/each}
      </div>
    </Field>

    <Field label="Header">
      <div class="layout-pickers" role="radiogroup" aria-label="Header style">
        {#each [
          { value: "light", label: "Light", bg: "#faf7f0", fg: "#15140e", rule: "#d6d0c1" },
          { value: "tint",  label: "Tint",  bg: `color-mix(in srgb, ${primary} 12%, #faf7f0)`, fg: "#15140e", rule: primary },
          { value: "bold",  label: "Bold",  bg: primaryDeep, fg: "#faf7f0", rule: primaryDeep },
        ] as opt}
          <button
            type="button"
            class="layout-card"
            class:active={variants.headerStyle === opt.value}
            onclick={() => changeHeaderStyle(opt.value)}
            aria-label={`Set header style to ${opt.label}`}
            aria-pressed={variants.headerStyle === opt.value}
          >
            <svg viewBox="0 0 36 22" width="100%" height="22" preserveAspectRatio="xMidYMid meet">
              <rect x="3" y="2" width="30" height="10" fill={opt.bg} stroke={opt.rule} stroke-width="0.5"/>
              <text x="18" y="9.5" font-size="6" font-weight="600" text-anchor="middle"
                    font-family="system-ui" fill={opt.fg}>Aa</text>
              <rect x="3" y="14" width="30" height="3" fill="var(--v2-paper-2, #f3efe5)"/>
              <rect x="3" y="18" width="30" height="3" fill="var(--v2-paper-2, #f3efe5)"/>
            </svg>
            <span class="card-label">{opt.label}</span>
          </button>
        {/each}
      </div>
    </Field>

    {@const slotStroke = primaryDeep}
    <Field label="Marks">
      <div class="layout-pickers" role="radiogroup" aria-label="Slot style">
        {#each [
          { value: "fill_with_darker_stroke", label: "F+Ring", fill: primary, stroke: slotStroke, sw: 1.5 },
          { value: "flat_fill",               label: "Flat",   fill: primary, stroke: primary, sw: 0.5 },
          { value: "outlined",                label: "Lined",  fill: `color-mix(in srgb, ${primary} 15%, #faf7f0)`, stroke: primary, sw: 1.5 },
        ] as opt}
          <button
            type="button"
            class="layout-card"
            class:active={readSlotStyle(theme) === opt.value}
            onclick={() => changeSlotStyle(opt.value as "fill_with_darker_stroke" | "flat_fill" | "outlined")}
            aria-label={`Set slot style to ${opt.label}`}
            aria-pressed={readSlotStyle(theme) === opt.value}
          >
            <svg viewBox="0 0 36 22" width="100%" height="22" preserveAspectRatio="xMidYMid meet">
              <line x1="6" y1="11" x2="30" y2="11" stroke={opt.stroke} stroke-width={opt.sw}/>
              <circle cx="18" cy="11" r="5" fill={opt.fill} stroke={opt.stroke} stroke-width={opt.sw}/>
            </svg>
            <span class="card-label">{opt.label}</span>
          </button>
        {/each}
      </div>
    </Field>
    <!-- Hidden SegmentedFields kept for a11y-fallback + native picker
         affordance. These don't render visibly; the cards above are
         the visible controls. Could remove if a11y review allows. -->
    <span class="sr-only">
    <SegmentedField
      label="Header"
      hint="Light = bare surface band; tint = subtle primary-tinted band; bold = full primary_deep band with inverse text."
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
      hint="Series fill/stroke pairing."
      value={readSlotStyle(theme)}
      options={[
        { value: "fill_with_darker_stroke", label: "F+S"   },
        { value: "flat_fill",               label: "Flat"  },
        { value: "outlined",                label: "Lined" },
      ]}
      onchange={changeSlotStyle}
    />
    </span>
  </Section>
{/if}

<!-- Banding sits between Layout and Borders per the locked
     ordering (layout → banding → borders → labels → watermark). -->
<BandingControl {store} />

<!-- Border control snippets — defined at component scope so the
     Borders Section body can render them via {@render foo(...)}. -->
{#snippet axisCycler(active: boolean, axis: "h" | "v", onclick: () => void)}
  <button
    type="button"
    class="axis-cycler"
    class:active
    {onclick}
    aria-label={`Toggle ${axis === "h" ? "horizontal" : "vertical"} dividers`}
    aria-pressed={active}
    title={axis === "h" ? "Horizontal (row) dividers" : "Vertical (column) dividers"}
  >
    <svg viewBox="0 0 22 22" width="22" height="22">
      <rect x="3" y="3" width="16" height="16" fill="none"
            stroke="var(--v2-ink-3, #8a8478)" stroke-width="0.7" opacity="0.6"/>
      {#if axis === "h"}
        <line x1="3" y1="11" x2="19" y2="11"
              stroke={active ? "var(--v2-ink, #15140e)" : "var(--v2-ink-3, #8a8478)"}
              stroke-width={active ? "1.4" : "0.7"}
              opacity={active ? "1" : "0.4"}/>
      {:else}
        <line x1="11" y1="3" x2="11" y2="19"
              stroke={active ? "var(--v2-ink, #15140e)" : "var(--v2-ink-3, #8a8478)"}
              stroke-width={active ? "1.4" : "0.7"}
              opacity={active ? "1" : "0.4"}/>
      {/if}
    </svg>
  </button>
{/snippet}

{#snippet styleCycler(curStyle: "single" | "double", onclick: () => void)}
  <button
    type="button"
    class="style-cycler"
    {onclick}
    aria-label="Toggle single/double divider"
    title={curStyle === "double" ? "Double — ═" : "Single — ─"}
  >
    <svg viewBox="0 0 22 22" width="22" height="22">
      {#if curStyle === "double"}
        <line x1="3" y1="9"  x2="19" y2="9"  stroke="var(--v2-ink, #15140e)" stroke-width="1.2"/>
        <line x1="3" y1="13" x2="19" y2="13" stroke="var(--v2-ink, #15140e)" stroke-width="1.2"/>
      {:else}
        <line x1="3" y1="11" x2="19" y2="11" stroke="var(--v2-ink, #15140e)" stroke-width="1.6"/>
      {/if}
    </svg>
  </button>
{/snippet}

{#snippet thicknessCycler(thickness: number, max: number, onclick: () => void)}
  <button
    type="button"
    class="thickness-cycler"
    {onclick}
    aria-label={`Thickness ${thickness}px — click to cycle`}
    title={`${thickness}px (click to cycle 1..${max})`}
  >
    <span class="thk-num">{thickness}</span>
  </button>
{/snippet}

{#if borders}
  <Section
    title="Borders"
    glyph="section.borders"
    hint="H and V axes independently toggle row + column dividers; each type sets its own thickness, single/double, and color."
  >

    <!-- Axes row — drives which AXES paint (H = row dividers, V =
         column dividers). Applies to all three border types. -->
    {@const layoutState = borders.layout as LayoutState}
    <Field label="Axes">
      <div class="border-controls">
        {@render axisCycler(layoutHasH(layoutState), "h",
          () => setBordersField(["layout"], withH(layoutState, !layoutHasH(layoutState))))}
        {@render axisCycler(layoutHasV(layoutState), "v",
          () => setBordersField(["layout"], withV(layoutState, !layoutHasV(layoutState))))}
      </div>
    </Field>

    <!-- Per-type rows wrapped in Field so they share the panel spine.
         Control area: line preview (click cycles single ↔ double) +
         slider for thickness (0..max) + color chip. Type identity is
         in the Field label. -->
    {#each [
      { key: "minor" as const, label: "Minor", maxThk: 4, hint: "Row + column data dividers" },
      { key: "major" as const, label: "Major", maxThk: 6, hint: "Header bottom + group/summary breaks" },
      { key: "table" as const, label: "Table", maxThk: 6, hint: "Top + bottom frame around the data table" },
    ] as t (t.key)}
      {@const spec = borders[t.key]}
      {@const off = spec.thickness <= 0}
      <Field label={t.label} hint={t.hint}>
        <div class="border-controls" class:off>
          <button type="button" class="border-line-btn"
                  disabled={off}
                  title={off ? `${t.label} off (drag thickness to enable)` : `${t.label} · click line to toggle single ↔ double`}
                  aria-label={`Toggle ${t.label} style — currently ${spec.style}`}
                  onclick={() => setBordersField([t.key, "style"], spec.style === "double" ? "single" : "double")}>
            <svg viewBox="0 0 120 12" width="100%" height="12" preserveAspectRatio="none">
              {#if off}
                <line x1="2" y1="6" x2="118" y2="6"
                      stroke="var(--v2-ink-3, #8a8478)" stroke-width="0.7"
                      stroke-dasharray="3 2" opacity="0.5"/>
              {:else if spec.style === "double"}
                <line x1="2" y1="4" x2="118" y2="4" stroke={spec.color}
                      stroke-width={Math.max(0.7, Math.min(2, spec.thickness * 0.6))}/>
                <line x1="2" y1="8" x2="118" y2="8" stroke={spec.color}
                      stroke-width={Math.max(0.7, Math.min(2, spec.thickness * 0.6))}/>
              {:else}
                <line x1="2" y1="6" x2="118" y2="6" stroke={spec.color}
                      stroke-width={Math.max(0.8, Math.min(3, spec.thickness * 1.0))}/>
              {/if}
            </svg>
          </button>
          <div class="border-thk-slider">
            <Slider
              value={spec.thickness}
              min={0} max={t.maxThk} step={1}
              suffix="px"
              valueWidth={3}
              ariaLabel={`${t.label} thickness`}
              onchange={(v) => setBordersField([t.key, "thickness"], v)}
            />
          </div>
          <div class="border-swatch-host" class:off>
            <ColorField
              label=""
              value={spec.color}
              onchange={(v: string) => setBordersField([t.key, "color"], v)}
            />
          </div>
        </div>
      </Field>
    {/each}
  </Section>
{/if}

<style>
  /* Layout-tab three-card picker rows (Density / Header / Marks).
     Lives inside Field's control slot, so it starts at the panel
     spine — same x as Primary/Secondary swatches in Theme. Strict
     equal-width via 3-column grid; SVG previews share the same
     viewBox dimensions for uniform internal rhythm. */
  .layout-pickers {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    width: 100%;
    align-items: stretch;
  }
  .layout-card {
    appearance: none;
    border: 1px solid var(--v2-rule-soft, #e6e0d1);
    background: var(--v2-paper-edge, #fff);
    border-radius: var(--v2-r-hair, 2px);
    padding: 4px 2px 3px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    transition:
      border-color var(--v2-dur-snap, 80ms) var(--v2-ease),
      box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .layout-card:hover {
    border-color: var(--v2-rule, #d6d0c1);
  }
  .layout-card.active {
    border-color: var(--v2-ink, #15140e);
    box-shadow: inset 0 0 0 0.5px var(--v2-ink, #15140e);
  }
  .layout-card.glyph-only { padding: 3px 2px; }
  .layout-card.glyph-only.active rect { fill: var(--v2-ink, #15140e); opacity: 1; }
  .card-label {
    font-family: var(--v2-font-sans, system-ui);
    font-size: 9.5px;
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: 0.08em;
    color: var(--v2-ink-3, #8a8478);
    line-height: 1;
  }
  .layout-card.active .card-label { color: var(--v2-ink, #15140e); }

  /* Screen-reader-only fallback for the hidden SegmentedField pickers
     beneath the card-strip variants. Kept off-screen but addressable. */
  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0);
    white-space: nowrap; border: 0;
  }

  /* Axis / style / thickness cyclers — all use the same 22x22 chassis. */
  .axis-cycler,
  .style-cycler,
  .style-cycler,
  .thickness-cycler {
    appearance: none;
    border: 0;
    padding: 0;
    width: 22px;
    height: 22px;
    background: transparent;
    border-radius: var(--v2-r-hair, 2px);
    box-shadow: inset 0 0 0 1px var(--v2-rule-soft, #e6e0d1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
    flex: none;
  }
  .axis-cycler:hover,
  .style-cycler:hover,
  .thickness-cycler:hover {
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
  }
  .axis-cycler.active {
    box-shadow: inset 0 0 0 1.5px var(--v2-ink, #15140e);
  }
  .thickness-cycler {
    width: 26px;
  }
  .thk-num {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 11px;
    color: var(--v2-ink-2, #4a463c);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  /* Border type row content — sits inside Field's control slot
     so the row aligns to the panel spine. Inline composition:
       [LINE PREVIEW][SLIDER thk][SWATCH chip]
     Label is provided by Field. */
  .border-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
  }
  .border-controls.off { opacity: 0.55; }
  .border-thk-slider {
    flex: 0 0 70px;
    min-width: 0;
    display: flex;
    align-items: center;
  }
  .border-line-btn {
    appearance: none;
    border: 0;
    padding: 0;
    background: transparent;
    flex: 1 1 auto;
    min-width: 0;
    height: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    border-radius: 2px;
    transition: background var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .border-line-btn:hover:not(:disabled) {
    background: var(--v2-hover-tint, rgba(21, 20, 14, 0.05));
  }
  .border-line-btn:disabled { cursor: default; }
  .border-swatch-host {
    flex: 0 0 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    /* Hide the hex input on these compact rows — the chip alone is
       enough; users click it to open the native picker / palette.
       The chip stays clickable. */
  }
  .border-swatch-host :global(.swatch .hex),
  .border-swatch-host :global(.swatch .palette-row) {
    display: none;
  }
  .border-swatch-host :global(.swatch) {
    grid-template-columns: max-content !important;
  }
  .border-swatch-host :global(.swatch .primary-row) {
    height: 16px;
    gap: 0;
  }
  .border-swatch-host :global(.chip) {
    width: 16px !important;
    height: 16px !important;
  }

  /* (Diagram styles retired — per-type line previews on each row
     carry the demonstration the diagram used to provide.) */
</style>

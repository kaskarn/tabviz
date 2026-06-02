<script lang="ts">
  // v2 Viz tab (renamed from "Marks"). Series slot bundles + plot mark
  // sizes + per-series marker shape.
  //
  // Each series row: anchor color + a SegmentedField shape picker +
  // expandable color-bundle (fill, stroke, muted, emphasis, text_fg).
  // Shape rides on the SlotRole now (theme.series[i].shape) — null
  // falls through to the renderer's default 4-shape rotation.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import ColorField from "./ColorField.svelte";
  import NumberField from "./NumberField.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import Accordion from "$components/primitives/v2/Accordion.svelte";
  import { SERIES_SWATCHES, colors } from "./swatch-palettes";

  interface Props {
    store: TabvizStore;
  }
  const { store }: Props = $props();

  const series = $derived(store.spec?.theme?.series ?? []);
  const plot = $derived(store.spec?.theme?.plot);

  let expanded = $state<Record<number, boolean>>({});

  function toggle(idx: number) {
    expanded = { ...expanded, [idx]: !expanded[idx] };
  }

  function setSlot(idx: number, field: string, value: unknown) {
    store.setThemeField(["series", idx, field], value);
  }
  function setPlot(field: string, value: number) {
    store.setThemeField(["plot", field], value);
  }

  // The renderer's default rotation cycles square / circle / diamond /
  // triangle in that order. The picker exposes the same four; "auto"
  // means "let the renderer pick from the rotation" and is encoded as
  // null on the wire.
  const SHAPE_OPTIONS = [
    { value: "auto",     label: "Auto" },
    { value: "square",   label: "Sq" },
    { value: "circle",   label: "Ci" },
    { value: "diamond",  label: "Di" },
    { value: "triangle", label: "Tr" },
  ];

  function shapeValue(slot: { shape?: string | null }): string {
    return slot?.shape ?? "auto";
  }
  function setShape(idx: number, value: string) {
    setSlot(idx, "shape", value === "auto" ? null : value);
  }

  const slotFields = [
    { field: "fill",       label: "Fill" },
    { field: "stroke",     label: "Stroke" },
    { field: "fillDim",    label: "Fill (dim)" },
    { field: "strokeDim",  label: "Stroke (dim)" },
    { field: "fillHot",    label: "Fill (hot)" },
    { field: "strokeHot",  label: "Stroke (hot)" },
    { field: "textFg",     label: "Text fg" },
  ];
</script>

 <Section title="Series" glyph="section.marks" hint="Per-effect slot bundles. Pick a shape and the anchor color (Fill) for the simple case; expand for the full color bundle.">
  <div data-tv-v2>
    {#each series as slot, i (i)}
      <Accordion
        title={`Series ${i + 1}`}
        open={expanded[i] ?? false}
      >
        {#snippet summary()}
          <span class="anchor-swatch"
                style:background={slot.fill}
                style:width="14px"
                style:height="14px"
                style:display="inline-block"
                style:border-radius="3px"
                style:box-shadow="inset 0 0 0 1px var(--v2-rule, #d6d0c1)">
          </span>
          {#if slot.shape}
            <span class="shape-mark" style:color={slot.stroke ?? slot.fill}>
              {slot.shape === "circle" ? "●"
                : slot.shape === "square" ? "■"
                : slot.shape === "diamond" ? "◆"
                : slot.shape === "triangle" ? "▲"
                : ""}
            </span>
          {/if}
        {/snippet}
        <SegmentedField
          label="Shape"
          value={shapeValue(slot)}
          options={SHAPE_OPTIONS}
          onchange={(v) => setShape(i, v)}
        />
        {#each slotFields as sf (sf.field)}
          <ColorField
            label={sf.label}
            value={(slot as unknown as Record<string, string>)[sf.field] ?? ""}
            onchange={(v) => setSlot(i, sf.field, v)}
            swatches={colors(SERIES_SWATCHES)}
          />
        {/each}
      </Accordion>
    {/each}
  </div>
</Section>

{#if plot}
   <Section title="Marks" glyph="section.marks" hint="Plot mark sizes.">
    <NumberField label="Point size"      value={plot.pointSize}      min={2}  max={20} step={1}   onchange={(v) => setPlot("pointSize", v)} />
    <NumberField label="Line width"      value={plot.lineWidth}      min={0.5} max={5} step={0.25} onchange={(v) => setPlot("lineWidth", v)} />
    <NumberField label="Tick mark length" value={plot.tickMarkLength} min={0}  max={12} step={1}  onchange={(v) => setPlot("tickMarkLength", v)} />
  </Section>
{/if}

<style>
  /* Anchor-swatch styling is inlined on the element (see summary
     snippet) — that's the only way to defeat Svelte's scope hashing
     across the Accordion snippet boundary, which kept the old
     `:global([data-tv-v2]) .anchor-swatch` rule from binding. */
  .shape-mark {
    font-size: 11px;
    line-height: 1;
    color: var(--v2-ink-2, #4a463c);
  }
</style>

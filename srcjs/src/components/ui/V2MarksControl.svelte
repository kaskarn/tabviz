<script lang="ts">
  // v2 Viz tab (renamed from "Marks"). Series slot bundles + plot mark
  // sizes + per-series marker shape.
  //
  // Each series row: anchor color + a SegmentedField shape picker +
  // expandable color-bundle (fill, stroke, muted, emphasis, text_fg).
  // Shape rides on the SlotBundle now (theme.series[i].shape) — null
  // falls through to the renderer's default 4-shape rotation.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import ColorField from "./ColorField.svelte";
  import NumberField from "./NumberField.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import Accordion from "$components/primitives/v2/Accordion.svelte";

  interface Props {
    store: TabvizStore;
  }
  let { store }: Props = $props();

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
    { field: "fill",            label: "Fill" },
    { field: "stroke",          label: "Stroke" },
    { field: "fillMuted",       label: "Fill (muted)" },
    { field: "strokeMuted",     label: "Stroke (muted)" },
    { field: "fillEmphasis",    label: "Fill (emphasis)" },
    { field: "strokeEmphasis",  label: "Stroke (emphasis)" },
    { field: "textFg",          label: "Text fg" },
  ];
</script>

<SettingsSection title="Series" description="Per-effect slot bundles. Pick a shape and the anchor color (Fill) for the simple case; expand for the full color bundle.">
  <div data-tv-v2>
    {#each series as slot, i (i)}
      <Accordion
        title={`Series ${i + 1}`}
        open={expanded[i] ?? false}
      >
        {#snippet summary()}
          <span class="anchor-swatch" style:background={slot.fill}></span>
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
          />
        {/each}
      </Accordion>
    {/each}
  </div>
</SettingsSection>

{#if plot}
  <SettingsSection title="Marks" description="Plot mark sizes.">
    <NumberField label="Point size"      value={plot.pointSize}      min={2}  max={20} step={1}   onchange={(v) => setPlot("pointSize", v)} />
    <NumberField label="Line width"      value={plot.lineWidth}      min={0.5} max={5} step={0.25} onchange={(v) => setPlot("lineWidth", v)} />
    <NumberField label="Tick mark length" value={plot.tickMarkLength} min={0}  max={12} step={1}  onchange={(v) => setPlot("tickMarkLength", v)} />
  </SettingsSection>
{/if}

<style>
  /* Bespoke .slot toggle gone — Accordion + summary snippet own the
     collapsible row. Only the anchor-color chip styling remains. */
  :global([data-tv-v2]) .anchor-swatch {
    display: inline-block;
    width: 14px;
    height: 14px;
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    border-radius: 3px;
  }
</style>

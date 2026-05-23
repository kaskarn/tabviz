<!--
  v2 Picker scenario — column-type picker, field picker, and a long
  searchable list. Three modes side-by-side.
-->
<script lang="ts">
  import Picker from "../../../../src/components/primitives/v2/Picker.svelte";
  import type { PickerItem } from "../../../../src/components/primitives/v2/types";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  // Column type picker — small, grouped, glyph-led.
  const typeItems: PickerItem<string>[] = [
    { value: "text",      label: "Text",      glyph: "type.text",     group: "Data" },
    { value: "numeric",   label: "Numeric",   glyph: "type.numeric",  group: "Data" },
    { value: "percent",   label: "Percent",   glyph: "type.percent",  group: "Data" },
    { value: "interval",  label: "Interval",  glyph: "type.interval", group: "Data" },
    { value: "pvalue",    label: "P-value",   glyph: "type.pvalue",   group: "Data" },
    { value: "events",    label: "Events",    glyph: "type.events",   group: "Data" },
    { value: "forest",    label: "Forest",    glyph: "type.forest",   group: "Viz" },
    { value: "bar",       label: "Bar",       glyph: "type.bar",      group: "Viz" },
    { value: "sparkline", label: "Sparkline", glyph: "type.sparkline",group: "Viz" },
    { value: "pictogram", label: "Pictogram", glyph: "type.pictogram",group: "Viz" },
    { value: "ring",      label: "Ring",      glyph: "type.ring",     group: "Viz" },
    { value: "stars",     label: "Stars",     glyph: "type.stars",    group: "Viz" },
  ];
  let typeValue: string | null = $state("numeric");

  // Field picker — secondary shows field type abbreviation.
  const fieldItems: PickerItem<string>[] = [
    { value: "study_id",       label: "study_id",       secondary: "str", glyph: "field.string"  },
    { value: "estimate",       label: "estimate",       secondary: "num", glyph: "field.numeric" },
    { value: "lower",          label: "lower",          secondary: "num", glyph: "field.numeric" },
    { value: "upper",          label: "upper",          secondary: "num", glyph: "field.numeric" },
    { value: "n_events",       label: "n_events",       secondary: "int", glyph: "field.integer" },
    { value: "n_total",        label: "n_total",        secondary: "int", glyph: "field.integer" },
    { value: "is_significant", label: "is_significant", secondary: "bool",glyph: "field.logical" },
    { value: "publication_date",label: "publication_date",secondary:"date",glyph: "field.date" },
    { value: "country",        label: "country",        secondary: "str", glyph: "field.string"  },
    { value: "subgroup",       label: "subgroup",       secondary: "fac", glyph: "field.factor"  },
  ];
  let fieldValue: string | null = $state("estimate");

  // Long enum — alignment with many subdivisions to demo search.
  const longItems: PickerItem<string>[] = Array.from({ length: 24 }, (_, i) => ({
    value: `theme_${i + 1}`,
    label: `Theme ${i + 1}`,
    secondary: ["light", "dark", "warm", "cool"][i % 4],
  }));
  let longValue: string | null = $state(null);

  $effect(() => {
    const b = harnessState.type;
    if (b !== typeValue) { harnessState.type = typeValue; recordChange("type", b, typeValue, "picker"); }
  });
  $effect(() => {
    const b = harnessState.field;
    if (b !== fieldValue) { harnessState.field = fieldValue; recordChange("field", b, fieldValue, "picker"); }
  });
  $effect(() => {
    const b = harnessState.theme;
    if (b !== longValue) { harnessState.theme = longValue; recordChange("theme", b, longValue, "picker"); }
  });
</script>

<div class="sheet">
  <div class="row">
    <span class="flag">column type</span>
    <div class="ctl"><Picker bind:value={typeValue} items={typeItems} placeholder="Pick a column type" ariaLabel="Column type" /></div>
    <span class="note">grouped + glyph-led</span>
  </div>

  <div class="row">
    <span class="flag">data field</span>
    <div class="ctl"><Picker bind:value={fieldValue} items={fieldItems} placeholder="Pick a field" ariaLabel="Data field" /></div>
    <span class="note">type glyph + suffix hint</span>
  </div>

  <div class="row">
    <span class="flag">long list</span>
    <div class="ctl"><Picker bind:value={longValue} items={longItems} placeholder="Pick a theme" ariaLabel="Theme" /></div>
    <span class="note">24 items · search appears</span>
  </div>

  <div class="row">
    <span class="flag">disabled</span>
    <div class="ctl"><Picker value="estimate" items={fieldItems} disabled ariaLabel="Disabled" /></div>
    <span class="note">read-only</span>
  </div>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 580px;
  }
  .row {
    display: grid;
    grid-template-columns: 120px 200px 1fr;
    align-items: center;
    gap: 16px;
  }
  .ctl { width: 200px; }
  .flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .note {
    font-family: var(--v2-font-sans, system-ui);
    font-size: 10.5px;
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }
</style>

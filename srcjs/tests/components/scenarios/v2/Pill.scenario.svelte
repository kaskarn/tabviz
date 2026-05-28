<!--
  v2 Pill scenario — boolean, words, glyphs, icon-only.
  Validates the four modes on a single sheet.
-->
<script lang="ts">
  import Pill from "../../../../src/components/primitives/v2/Pill.svelte";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  type Align = "left" | "center" | "right";
  type Density = "compact" | "comfortable" | "spacious";

  let on: boolean = $state(false);
  let align: Align = $state("left");
  let alignG: Align = $state("center");
  let density: Density = $state("comfortable");

  $effect(() => {
    const b = harnessState.on;
    if (b !== on) { harnessState.on = on; recordChange("on", b, on, "pill"); }
  });
  $effect(() => {
    const b = harnessState.align;
    if (b !== align) { harnessState.align = align; recordChange("align", b, align, "pill"); }
  });
  $effect(() => {
    const b = harnessState.alignG;
    if (b !== alignG) { harnessState.alignG = alignG; recordChange("alignG", b, alignG, "pill"); }
  });
  $effect(() => {
    const b = harnessState.density;
    if (b !== density) { harnessState.density = density; recordChange("density", b, density, "pill"); }
  });
</script>

<div class="sheet">
  <div class="row">
    <span class="flag">boolean</span>
    <Pill
      bind:value={on}
      segments={[
        { value: false, label: "off" },
        { value: true,  label: "on" },
      ]}
      ariaLabel="boolean"
    />
  </div>

  <div class="row">
    <span class="flag">labels</span>
    <Pill
      bind:value={align}
      segments={[
        { value: "left",   label: "Left" },
        { value: "center", label: "Center" },
        { value: "right",  label: "Right" },
      ]}
      ariaLabel="align"
    />
  </div>

  <div class="row">
    <span class="flag">label + glyph</span>
    <Pill
      bind:value={alignG}
      segments={[
        { value: "left",   label: "L", glyph: "align.left",   title: "Left" },
        { value: "center", label: "C", glyph: "align.center", title: "Center" },
        { value: "right",  label: "R", glyph: "align.right",  title: "Right" },
      ]}
      ariaLabel="align (label+glyph)"
    />
  </div>

  <div class="row">
    <span class="flag">icon-only</span>
    <Pill
      bind:value={density}
      segments={[
        { value: "compact",     glyph: "density.compact",     title: "Compact" },
        { value: "comfortable", glyph: "density.comfortable", title: "Comfortable" },
        { value: "spacious",    glyph: "density.spacious",    title: "Spacious" },
      ]}
      ariaLabel="density"
    />
  </div>

  <div class="row">
    <span class="flag">disabled</span>
    <Pill
      value={alignG}
      segments={[
        { value: "left",   label: "L" },
        { value: "center", label: "C" },
        { value: "right",  label: "R" },
      ]}
      disabled
      ariaLabel="disabled"
    />
  </div>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 460px;
  }
  .row {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 16px;
  }
  .flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
</style>

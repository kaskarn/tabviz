<!--
  Segmented scenario — enum-picker buttons row. Includes both word
  labels and glyph labels in the same scenario so the harness covers
  both rendering modes side-by-side.
-->
<script lang="ts">
  import Segmented from "../../../src/components/primitives/Segmented.svelte";
  import { harnessState, recordChange } from "../harness-store.svelte";

  type Align = "left" | "center" | "right";
  type Density = "compact" | "comfortable" | "spacious";

  let align: Align = $state("left");
  let density: Density = $state("comfortable");

  $effect(() => {
    const before = harnessState.align;
    if (before !== align) {
      harnessState.align = align;
      recordChange("align", before, align, "segmented");
    }
  });
  $effect(() => {
    const before = harnessState.density;
    if (before !== density) {
      harnessState.density = density;
      recordChange("density", before, density, "segmented");
    }
  });
</script>

<div class="rows">
  <div class="row">
    <span class="lbl">Align (words)</span>
    <Segmented
      bind:value={align}
      segments={[
        { value: "left",   label: "Left" },
        { value: "center", label: "Center" },
        { value: "right",  label: "Right" },
      ]}
      ariaLabel="Align"
    />
  </div>

  <div class="row">
    <span class="lbl">Align (glyphs)</span>
    <Segmented
      bind:value={align}
      segments={[
        { value: "left",   label: "L" },
        { value: "center", label: "C" },
        { value: "right",  label: "R" },
      ]}
      ariaLabel="Align (glyphs)"
    />
  </div>

  <div class="row">
    <span class="lbl">Density</span>
    <Segmented
      bind:value={density}
      segments={[
        { value: "compact",     label: "⫶" },
        { value: "comfortable", label: "⫶⫶" },
        { value: "spacious",    label: "⫶⫶⫶" },
      ]}
      ariaLabel="Density"
    />
  </div>
</div>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .row {
    display: grid;
    grid-template-columns: 120px 1fr;
    align-items: center;
    gap: 12px;
  }
  .lbl {
    font-size: 11px;
    color: var(--tv-text-muted, #7a7466);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
</style>

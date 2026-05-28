<!--
  FieldRow scenario — the layout-only grid that anchors every editor
  row. Not interactive; this scenario validates the typographic
  rhythm and the label/control alignment against a variety of
  control widths.
-->
<script lang="ts">
  import FieldRow from "../../../src/components/primitives/FieldRow.svelte";
  import Toggle from "../../../src/components/primitives/Toggle.svelte";
  import Segmented from "../../../src/components/primitives/Segmented.svelte";
  import { harnessState, recordChange } from "../harness-store.svelte";

  type Align = "left" | "center" | "right";

  let sortable = $state(true);
  let align: Align = $state("left");

  $effect(() => {
    if (harnessState.sortable !== sortable) {
      const before = harnessState.sortable;
      harnessState.sortable = sortable;
      recordChange("sortable", before, sortable, "toggle");
    }
  });
  $effect(() => {
    if (harnessState.align !== align) {
      const before = harnessState.align;
      harnessState.align = align;
      recordChange("align", before, align, "segmented");
    }
  });
</script>

<div class="rows">
  <FieldRow label="Sortable">
    <Toggle bind:value={sortable} ariaLabel="Sortable" />
  </FieldRow>
  <FieldRow label="Header align" hint="follows column align if unset">
    <Segmented
      bind:value={align}
      segments={[
        { value: "left",   label: "L" },
        { value: "center", label: "C" },
        { value: "right",  label: "R" },
      ]}
      ariaLabel="Header align"
    />
  </FieldRow>
  <FieldRow label="A long label that wraps so we see the grid hold">
    <Toggle ariaLabel="Long-label demo" />
  </FieldRow>
</div>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 360px;
  }
</style>

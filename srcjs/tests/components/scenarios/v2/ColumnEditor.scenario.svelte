<!--
  v2 ColumnEditor scenario — mounts the flagship editor with three
  representative schemas side-by-side so the cascade depth, slot
  count, and accordion stacking can be audited at a glance.
-->
<script lang="ts">
  import ColumnEditorV2 from "../../../../src/components/column-editor-v2/ColumnEditorV2.svelte";
  import { SCHEMA_REGISTRY } from "../../../../src/schema/columns";
  import type { AvailableField, ColumnSpec } from "../../../../src/types";
  import type { ThemeSwatch } from "../../../../src/components/primitives/v2/types";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  const available: AvailableField[] = [
    { field: "study_id",       label: "study_id",       category: "string" },
    { field: "estimate",       label: "estimate",       category: "numeric" },
    { field: "lower",          label: "lower",          category: "numeric" },
    { field: "upper",          label: "upper",          category: "numeric" },
    { field: "n_events",       label: "n_events",       category: "integer" },
    { field: "n_total",        label: "n_total",        category: "integer" },
    { field: "is_significant", label: "is_significant", category: "logical" },
    { field: "publication_date",label:"publication_date",category: "date" },
    { field: "country",        label: "country",        category: "string" },
  ];

  const swatches: ThemeSwatch[] = [
    { color: "#15140e", token: "ink" },
    { color: "#b53a1f", token: "accent" },
    { color: "#3d6e8e", token: "blue" },
    { color: "#69806b", token: "moss" },
    { color: "#a07b3d", token: "olive" },
    { color: "#8a8478", token: "muted" },
  ];

  // Three columns side-by-side to validate different schema depths.
  // Slot field selections are left empty so the field-pickers render
  // their placeholders — interact with the editor to bind fields.
  let numericCol = $state<Partial<ColumnSpec>>({
    type: "numeric",
    header: "Estimate",
    options: { numeric: { decimals: 2 } },
  });
  let intervalCol = $state<Partial<ColumnSpec>>({
    type: "interval",
    header: "Effect (95% CI)",
  });
  let textCol = $state<Partial<ColumnSpec>>({
    type: "text",
    header: "Study",
    align: "left",
  });

  $effect(() => {
    const b = harnessState.numericCol;
    if (JSON.stringify(b) !== JSON.stringify(numericCol)) {
      harnessState.numericCol = numericCol;
      recordChange("numericCol", b, numericCol, "edit");
    }
  });
  $effect(() => {
    const b = harnessState.intervalCol;
    if (JSON.stringify(b) !== JSON.stringify(intervalCol)) {
      harnessState.intervalCol = intervalCol;
      recordChange("intervalCol", b, intervalCol, "edit");
    }
  });
</script>

<div class="sheet">
  <div class="card">
    <h3 class="card-h">Numeric</h3>
    <ColumnEditorV2
      schema={SCHEMA_REGISTRY.numeric}
      bind:column={numericCol}
      {available}
      {swatches}
      oncommit={(c) => { numericCol = c; }}
    />
  </div>

  <div class="card">
    <h3 class="card-h">Interval (3 slots)</h3>
    <ColumnEditorV2
      schema={SCHEMA_REGISTRY.interval}
      bind:column={intervalCol}
      {available}
      {swatches}
      oncommit={(c) => { intervalCol = c; }}
    />
  </div>

  <div class="card">
    <h3 class="card-h">Text (minimal cascade)</h3>
    <ColumnEditorV2
      schema={SCHEMA_REGISTRY.text}
      bind:column={textCol}
      {available}
      {swatches}
      oncommit={(c) => { textCol = c; }}
    />
  </div>
</div>

<style>
  .sheet {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    align-items: flex-start;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card-h {
    margin: 0;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--v2-ink-3, #8a8478);
  }
</style>

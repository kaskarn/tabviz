<!--
  SparklineOptionsEditor — option-editing UI for sparkline columns.
  Phase 0c-C3 per-type extraction. See ForestOptionsEditor for the
  pattern.
-->
<script lang="ts">
  import { createSparklineOptionsSlice } from "./option-slices/sparkline-options.svelte";
  import type { ColumnSpec } from "$types";

  const slice = createSparklineOptionsSlice();

  export function reset(): void { slice.reset(); }
  export function hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void { slice.hydrateFromSpec(o); }
  export function build(): { type: "line" | "bar" | "area" } { return slice.buildOptions(); }
</script>

<label class="editor-field">
  <span>Chart type</span>
  <select bind:value={slice.chartType}>
    <option value="line">Line</option>
    <option value="bar">Bar</option>
    <option value="area">Area</option>
  </select>
</label>

<style>
  .editor-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px 0;
  }
  .editor-field > span {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tv-text-muted, #64748b);
  }
  .editor-field select {
    padding: 4px 8px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    font: inherit;
    font-size: 0.85rem;
    color: var(--tv-fg, #1a1a1a);
    background: var(--tv-bg, #fff);
  }
</style>

<!--
  NumericDomainOptionsEditor — shared option UI for bar / progress /
  heatmap columns. Phase 0c-C3 per-type extraction.

  All three column types take a numeric value field and render it
  scaled by `maxValue` and `scale`. heatmap doesn't expose maxValue
  (its domain comes from data); bar + progress do.
-->
<script lang="ts">
  import { createNumericDomainOptionsSlice, type NumericDomainColumnType } from "./option-slices/numeric-domain-options.svelte";
  import type { ColumnSpec } from "$types";

  interface Props {
    type: NumericDomainColumnType;
  }
  let { type }: Props = $props();

  const slice = createNumericDomainOptionsSlice();

  export function reset(): void { slice.reset(); }
  export function hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void {
    slice.hydrateFromSpec(o, type);
  }
  export function build():
    | NonNullable<NonNullable<ColumnSpec["options"]>["bar"]>
    | NonNullable<NonNullable<ColumnSpec["options"]>["progress"]>
    | NonNullable<NonNullable<ColumnSpec["options"]>["heatmap"]> {
    return slice.buildOptions(type);
  }
</script>

{#if type === "bar" || type === "progress"}
  <label class="editor-field">
    <span>Max value</span>
    <input
      type="number"
      bind:value={slice.maxValue}
      placeholder={type === "progress" ? "100" : "auto"}
    />
  </label>
{/if}

<label class="editor-field">
  <span>Scale</span>
  <select bind:value={slice.scale}>
    <option value="linear">Linear</option>
    <option value="log">Log</option>
    <option value="sqrt">Sqrt</option>
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
  .editor-field input,
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

<!-- NumericOptionsEditor — Phase 0c-C3. -->
<script lang="ts">
  import { createNumericOptionsSlice } from "./option-slices/numeric-options.svelte";
  import type { ColumnSpec } from "$types";

  const slice = createNumericOptionsSlice();
  export function reset(): void { slice.reset(); }
  export function hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void { slice.hydrateFromSpec(o); }
  export function build(): NonNullable<NonNullable<ColumnSpec["options"]>["numeric"]> { return slice.buildOptions(); }
</script>

<label class="editor-field">
  <span>Decimals</span>
  <input type="number" min="0" max="10" bind:value={slice.decimals} placeholder="auto" />
</label>
<div class="editor-row">
  <label class="editor-field">
    <span>Prefix</span>
    <input type="text" bind:value={slice.prefix} placeholder="e.g. $" maxlength="4" />
  </label>
  <label class="editor-field">
    <span>Suffix</span>
    <input type="text" bind:value={slice.suffix} placeholder="e.g. %" maxlength="4" />
  </label>
</div>
<label class="editor-check">
  <input type="checkbox" bind:checked={slice.thousandsSep} />
  <span>Group thousands (1,000)</span>
</label>

<style>
  .editor-row { display: flex; gap: 8px; align-items: flex-end; }
  .editor-row .editor-field { flex: 1; min-width: 0; }
  .editor-field {
    display: flex; flex-direction: column; gap: 3px; padding: 4px 0;
  }
  .editor-field > span {
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--tv-text-muted, #64748b);
  }
  .editor-field input {
    padding: 4px 8px; border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px; font: inherit; font-size: 0.85rem;
    color: var(--tv-fg, #1a1a1a); background: var(--tv-bg, #fff);
  }
  .editor-check {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.8rem; color: var(--tv-fg, #1a1a1a); cursor: pointer;
  }
</style>

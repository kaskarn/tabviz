<!-- StarsOptionsEditor — Phase 0c-C3 per-type extraction. -->
<script lang="ts">
  import { createStarsOptionsSlice } from "./option-slices/stars-options.svelte";
  import type { ColumnSpec } from "$types";

  const slice = createStarsOptionsSlice();
  export function reset(): void { slice.reset(); }
  export function hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void { slice.hydrateFromSpec(o); }
  export function build(): NonNullable<NonNullable<ColumnSpec["options"]>["stars"]> { return slice.buildOptions(); }
</script>

<label class="editor-field">
  <span>Max stars</span>
  <input type="number" min="1" max="20" bind:value={slice.maxStars} placeholder="5" />
</label>
<div class="editor-row">
  <label class="editor-field">
    <span>Domain min</span>
    <input type="number" bind:value={slice.domainMin} placeholder="optional" />
  </label>
  <label class="editor-field">
    <span>Domain max</span>
    <input type="number" bind:value={slice.domainMax} placeholder="optional" />
  </label>
</div>

<style>
  .editor-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  .editor-row .editor-field {
    flex: 1;
    min-width: 0;
  }
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
  .editor-field input {
    padding: 4px 8px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    font: inherit;
    font-size: 0.85rem;
    color: var(--tv-fg, #1a1a1a);
    background: var(--tv-bg, #fff);
  }
</style>

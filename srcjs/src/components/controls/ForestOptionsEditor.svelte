<!--
  ForestOptionsEditor — option-editing UI for forest columns.

  Owned state (`scale`, `nullValue`, axis label / range / ticks / show /
  gridlines) lives in the forest-options.svelte.ts slice. The component
  renders the form controls and exposes three methods via `bind:this`
  to the parent ColumnEditorPopover:

    reset()             — restore all forest-option state to defaults
    hydrateFromSpec(o)  — load values from an existing ColumnSpec.options
    build({point,lower,upper}) — emit the options.forest bundle for buildSpec()

  Plus a `scale` getter so the parent can read scale at commit time
  without going through `build()` (used by the slot-resolution path).

  Phase 0c-C3, first per-type extraction. The same pattern (slice +
  sub-component + parent bind:this) repeats for viz_*, bar, sparkline,
  badge, icon, stars, pictogram, ring, heatmap, progress.
-->
<script lang="ts">
  import { createForestOptionsSlice } from "./option-slices/forest-options.svelte";
  import type { ColumnSpec } from "$types";

  const slice = createForestOptionsSlice();

  // Public API for the parent. Methods are stable references to the
  // slice's so `bind:this` consumers can call them directly.
  export function reset(): void { slice.reset(); }
  export function hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void { slice.hydrateFromSpec(o); }
  export function build(args: {
    point: string;
    lower: string;
    upper: string;
  }): NonNullable<NonNullable<ColumnSpec["options"]>["forest"]> {
    return slice.buildOptions(args);
  }
  export function getScale(): "linear" | "log" { return slice.scale; }
</script>

<!-- Format zone: highest-impact knobs always visible. -->
<div class="editor-row">
  <label class="editor-field">
    <span>Scale</span>
    <select bind:value={slice.scale}>
      <option value="linear">Linear</option>
      <option value="log">Log</option>
    </select>
  </label>
  <label class="editor-field">
    <span>Null value</span>
    <input
      type="number"
      step="any"
      bind:value={slice.nullValue}
      placeholder={slice.scale === "log" ? "1" : "0"}
    />
  </label>
</div>
<label class="editor-field">
  <span>Axis label</span>
  <input type="text" bind:value={slice.axisLabel} placeholder="Effect" />
</label>
<!-- Advanced zone: range, ticks, gridlines, axis visibility. -->
<details class="editor-advanced">
  <summary>Advanced</summary>
  <div class="editor-row">
    <label class="editor-field">
      <span>Axis min</span>
      <input type="number" step="any" bind:value={slice.axisRangeMin} placeholder="auto" />
    </label>
    <label class="editor-field">
      <span>Axis max</span>
      <input type="number" step="any" bind:value={slice.axisRangeMax} placeholder="auto" />
    </label>
  </div>
  <label class="editor-field">
    <span>Axis ticks</span>
    <input
      type="text"
      bind:value={slice.axisTicks}
      placeholder="auto, or e.g. 0.5, 1, 2"
    />
  </label>
  <div class="check-row">
    <label class="editor-check">
      <input type="checkbox" bind:checked={slice.showAxis} />
      <span>Show axis</span>
    </label>
    <label class="editor-check">
      <input type="checkbox" bind:checked={slice.axisGridlines} />
      <span>Gridlines</span>
    </label>
  </div>
</details>

<style>
  /*
    Mirrors the parent ColumnEditorPopover's editor-* styling. Duplicated
    rather than shared because Svelte 5 scopes styles per-component; the
    parent's selectors don't reach the child's DOM. Once all per-type
    blocks are extracted as sibling components (Phase 0c-C3 follow-ups),
    consider lifting these into a shared CSS file imported by each.
  */
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
  .check-row {
    display: flex;
    gap: 14px;
  }
  .editor-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--tv-fg, #1a1a1a);
    cursor: pointer;
  }
  .editor-advanced {
    margin-top: 6px;
    border-top: 1px dashed color-mix(in srgb, var(--tv-border, #e2e8f0) 80%, transparent);
    padding-top: 6px;
  }
  .editor-advanced > summary {
    cursor: pointer;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tv-text-muted, #64748b);
    list-style: none;
    padding: 2px 0;
    user-select: none;
  }
  .editor-advanced > summary::-webkit-details-marker {
    display: none;
  }
  .editor-advanced > summary::before {
    content: "▸ ";
    display: inline-block;
    transition: transform 0.15s ease;
    color: color-mix(in srgb, var(--tv-text-muted, #64748b) 70%, transparent);
  }
  .editor-advanced[open] > summary::before {
    transform: rotate(90deg);
  }
  .editor-advanced > summary:hover {
    color: var(--tv-fg, #1a1a1a);
  }
  .editor-advanced > *:not(summary) {
    margin-top: 6px;
  }
</style>

<!--
  FieldRow — labeled-control row, the unit of one option in the editor.

  Grid: 84px label column + flex control. min-height 26px so single-line
  controls don't get crushed below the visual baseline. Hint (optional)
  renders as small italic text aligned right of the control. Mirrors
  rgc-design Row (controls.jsx:18-25, styles.css:205-217).
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    /** Trailing hint text aligned right of the control. */
    hint?: string;
    /** Optional id for label `for=`. */
    forId?: string;
    children?: Snippet;
  }

  const { label, hint, forId, children }: Props = $props();
</script>

<div class="field-row">
  <label class="field-label" for={forId}>{label}</label>
  <div class="field-ctl">
    {@render children?.()}
    {#if hint}
      <span class="field-hint">{hint}</span>
    {/if}
  </div>
</div>

<style>
  .field-row {
    display: grid;
    grid-template-columns: 84px 1fr;
    gap: 8px;
    align-items: center;
    min-height: 26px;
  }
  .field-label {
    padding-left: 4px;
    font-size: 11px;
    color: var(--tv-text-muted, #7a7466);
    line-height: 1.2;
  }
  .field-ctl {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .field-hint {
    font-size: 10px;
    font-style: italic;
    color: var(--tv-muted, #aaa39a);
    white-space: nowrap;
  }
</style>

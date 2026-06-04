<!--
  SliderValue — range input + monospace value display in a single row.
  Modeled on rgc-design slider (controls.jsx:27-35, styles.css:225-235).
-->
<script lang="ts">
  interface Props {
    value?: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    disabled?: boolean;
    id?: string;
  }

  let {
    value = $bindable(0),
    min,
    max,
    step = 1,
    suffix,
    disabled = false,
    id,
  }: Props = $props();
</script>

<div class="slider-wrap">
  <input
    type="range"
    bind:value
    {min}
    {max}
    {step}
    {disabled}
    {id}
  />
  <span class="value">
    {value}{#if suffix}<span class="suffix">{suffix}</span>{/if}
  </span>
</div>

<style>
  .slider-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  input[type="range"] {
    flex: 1;
    accent-color: var(--tv-accent, #b53a1f);
  }
  .value {
    min-width: 48px;
    text-align: right;
    font-family: var(--tv-text-numeric-family, ui-monospace, "IBM Plex Mono", monospace);
    font-size: 11px;
    color: var(--tv-text, #1f1f1f);
    font-variant-numeric: tabular-nums;
  }
  .suffix {
    color: var(--tv-text-muted, #7a7466);
    margin-left: 1px;
  }
</style>

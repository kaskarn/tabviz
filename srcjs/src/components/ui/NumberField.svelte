<script lang="ts">
  interface Props {
    /** Visible label for the field. */
    label: string;
    /** Optional secondary hint shown under the label. */
    hint?: string;
    /** Current numeric value. */
    value: number;
    /** Slider minimum. */
    min: number;
    /** Slider maximum. */
    max: number;
    /** Slider step. Defaults to 1 (integer sliders). */
    step?: number;
    /** Unit label rendered next to the value (e.g. "px", "rem"). */
    unit?: string;
    /** Fired on every `input` event from the slider. */
    onchange: (value: number) => void;
  }

  let { label, hint, value, min, max, step = 1, unit, onchange }: Props = $props();

  function handleInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isNaN(v)) onchange(v);
  }
</script>

<div class="number-field" title={hint}>
  <span class="label">{label}</span>
  <div class="controls">
    <input
      class="range"
      type="range"
      {min}
      {max}
      {step}
      {value}
      oninput={handleInput}
      aria-label={label}
    />
    <span class="value-display" aria-live="polite">
      {value}{#if unit}<span class="unit">{unit}</span>{/if}
    </span>
  </div>
</div>

<style>
  .number-field {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .label {
    font-size: 0.75rem;
    color: var(--wf-fg, #1a1a1a);
    font-weight: 500;
    line-height: 1.2;
    min-width: 0;
  }

  .controls {
    display: grid;
    grid-template-columns: 100px auto;
    align-items: center;
    gap: 6px;
  }

  .range {
    width: 100%;
    accent-color: var(--wf-primary, #2563eb);
  }

  .value-display {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.7rem;
    color: var(--wf-fg, #1a1a1a);
    font-variant-numeric: tabular-nums;
    min-width: 3em;
    text-align: right;
  }

  .unit {
    color: var(--wf-secondary, #64748b);
    margin-left: 2px;
  }
</style>

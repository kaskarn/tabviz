<script lang="ts" generics="T extends string | number | boolean | null">
  interface Props {
    /** Visible label for the field. */
    label: string;
    /** Optional secondary hint shown under the label. */
    hint?: string;
    /** Current selected value. */
    value: T;
    /** Options to display, in order. `label` is shown; `value` is what's emitted. */
    options: { label: string; value: T }[];
    /** Fired when the user picks a different option. */
    onchange: (value: T) => void;
  }

  let { label, hint, value, options, onchange }: Props = $props();
</script>

<div class="segmented-field" title={hint}>
  <span class="label">{label}</span>
  <div class="segmented" role="radiogroup" aria-label={label}>
    {#each options as opt (String(opt.value))}
      <button
        type="button"
        role="radio"
        aria-checked={value === opt.value}
        class:selected={value === opt.value}
        onclick={() => onchange(opt.value)}
      >{opt.label}</button>
    {/each}
  </div>
</div>

<style>
  .segmented-field {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .label {
    font-size: 0.75rem;
    color: var(--tv-fg, #1a1a1a);
    font-weight: 500;
    line-height: 1.2;
    min-width: 0;
  }

  .segmented {
    display: flex;
    border: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 15%, var(--tv-border, #e2e8f0));
    border-radius: 6px;
    overflow: hidden;
    background: var(--tv-bg, #ffffff);
  }

  .segmented button {
    padding: 2px 8px;
    font-size: 0.7rem;
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--tv-fg, #1a1a1a);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
    white-space: nowrap;
  }

  .segmented button + button {
    border-left: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 10%, var(--tv-border, #e2e8f0));
  }

  .segmented button:hover:not(.selected) {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 8%, transparent);
  }

  .segmented button.selected {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 92%, transparent);
    color: var(--tv-bg, #ffffff);
  }
</style>

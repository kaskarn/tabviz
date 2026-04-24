<script lang="ts">
  interface Props {
    /** Visible label for the field. */
    label: string;
    /** Optional secondary hint shown under the label. */
    hint?: string;
    /** Current value. */
    value: string;
    /** Placeholder shown when the input is empty. */
    placeholder?: string;
    /**
     * Live preview on each keystroke. Prefer this for visual updates that
     * shouldn't be recorded in the op-log (e.g., watermark / title edits
     * while the user is still typing).
     */
    oninput?: (value: string) => void;
    /**
     * Fires on blur OR Enter — commit the finished edit. This is the one
     * whose side effects should record an op (so one keypress session
     * produces one log entry).
     */
    onchange?: (value: string) => void;
  }

  let { label, hint, value, placeholder, oninput, onchange }: Props = $props();

  function handleInput(e: Event) {
    oninput?.((e.target as HTMLInputElement).value);
  }

  function handleBlurOrChange(e: Event) {
    onchange?.((e.target as HTMLInputElement).value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      onchange?.((e.target as HTMLInputElement).value);
    }
  }
</script>

<div class="text-field" title={hint}>
  <span class="label">{label}</span>
  <input
    class="text"
    type="text"
    {value}
    {placeholder}
    oninput={handleInput}
    onchange={handleBlurOrChange}
    onblur={handleBlurOrChange}
    onkeydown={handleKeydown}
    spellcheck="false"
    aria-label={label}
  />
</div>

<style>
  .text-field {
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

  .text {
    width: 140px;
    padding: 3px 6px;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 12%, var(--wf-border, #e2e8f0));
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.7rem;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .text:focus {
    border-color: var(--wf-primary, #2563eb);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--wf-primary, #2563eb) 15%, transparent);
  }
</style>

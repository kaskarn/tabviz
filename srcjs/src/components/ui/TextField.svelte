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
    /** Fired on every `input` event. */
    onchange: (value: string) => void;
  }

  let { label, hint, value, placeholder, onchange }: Props = $props();

  function handleInput(e: Event) {
    onchange((e.target as HTMLInputElement).value);
  }
</script>

<div class="text-field">
  <div class="meta">
    <span class="label">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </div>
  <input
    class="text"
    type="text"
    {value}
    {placeholder}
    oninput={handleInput}
    spellcheck="false"
    aria-label={label}
  />
</div>

<style>
  .text-field {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  }

  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .label {
    font-size: 0.8125rem;
    color: var(--wf-fg, #1a1a1a);
    font-weight: 500;
    line-height: 1.2;
  }

  .hint {
    font-size: 0.7rem;
    color: var(--wf-secondary, #64748b);
    line-height: 1.3;
  }

  .text {
    width: 168px;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 12%, var(--wf-border, #e2e8f0));
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
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

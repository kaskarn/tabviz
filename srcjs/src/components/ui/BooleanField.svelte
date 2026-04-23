<script lang="ts">
  interface Props {
    /** Visible label for the field. */
    label: string;
    /** Optional secondary hint shown under the label. */
    hint?: string;
    /** Current value. */
    value: boolean;
    /** Fired on click / keypress toggle. */
    onchange: (value: boolean) => void;
  }

  let { label, hint, value, onchange }: Props = $props();
</script>

<div class="boolean-field">
  <div class="meta">
    <span class="label">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </div>
  <button
    type="button"
    class="toggle"
    class:on={value}
    role="switch"
    aria-checked={value}
    aria-label={label}
    onclick={() => onchange(!value)}
  >
    <span class="thumb"></span>
  </button>
</div>

<style>
  .boolean-field {
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

  .toggle {
    position: relative;
    width: 32px;
    height: 18px;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 80%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--wf-border, #e2e8f0) 40%, transparent);
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .toggle.on {
    background: var(--wf-primary, #2563eb);
    border-color: var(--wf-primary, #2563eb);
  }

  .thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--wf-bg, #ffffff);
    box-shadow: 0 1px 2px color-mix(in srgb, #0f172a 15%, transparent);
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .toggle.on .thumb {
    transform: translateX(14px);
  }

  .toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--wf-primary, #2563eb) 40%, transparent);
    outline-offset: 2px;
  }
</style>

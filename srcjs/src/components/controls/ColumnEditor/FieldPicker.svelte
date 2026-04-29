<script lang="ts">
  import type { AvailableField, FieldCategory } from "$types";

  interface Props {
    label: string;
    value: string;
    /** The set of fields available in the current dataset. */
    available: AvailableField[];
    /** Filter to fields whose category is in this list. Empty/undefined ⇒ no filter. */
    accepts?: FieldCategory[];
    /** Marker text trailing the label, e.g. "optional". */
    suffix?: string;
    placeholder?: string;
    onchange: (value: string) => void;
    disabled?: boolean;
  }

  let {
    label,
    value,
    available,
    accepts,
    suffix,
    placeholder = "Select a field…",
    onchange,
    disabled = false,
  }: Props = $props();

  const choices = $derived(
    accepts && accepts.length > 0
      ? available.filter((f) => accepts.includes(f.category))
      : available,
  );
</script>

<div class="field-picker">
  <span class="label">
    {label}{#if suffix}<span class="suffix"> {suffix}</span>{/if}
  </span>
  <select
    {disabled}
    {value}
    onchange={(e) => onchange((e.currentTarget as HTMLSelectElement).value)}
  >
    <option value="" disabled>{placeholder}</option>
    {#each choices as f (f.field)}
      <option value={f.field}>{f.label}</option>
    {/each}
  </select>
</div>

<style>
  .field-picker {
    display: grid;
    grid-template-columns: 84px 1fr;
    align-items: center;
    gap: 8px;
    padding: 1px 0;
  }

  .label {
    font-size: 11px;
    color: var(--tv-text-muted, #64748b);
    font-weight: 500;
  }

  .suffix {
    font-weight: 400;
    opacity: 0.7;
    font-size: 10px;
  }

  select {
    width: 100%;
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 12px;
    font-family: inherit;
    box-sizing: border-box;
  }

  select:focus {
    outline: none;
    border-color: var(--tv-accent, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  select:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>

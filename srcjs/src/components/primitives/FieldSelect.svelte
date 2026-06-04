<!--
  FieldSelect — dropdown of data fields, optionally filtered by
  FieldCategory[]. Used by the editor's slot fillers and by any
  option with `control: "field"`.
-->
<script lang="ts">
  import type { AvailableField, FieldCategory } from "$types";

  interface Props {
    value?: string | null;
    available: AvailableField[];
    accepts?: FieldCategory[];
    placeholder?: string;
    disabled?: boolean;
    id?: string;
  }

  let {
    value = $bindable(null),
    available,
    accepts,
    placeholder = "Pick a field…",
    disabled = false,
    id,
  }: Props = $props();

  const options = $derived(
    accepts && accepts.length > 0
      ? available.filter((f) => accepts.includes(f.category))
      : available,
  );
</script>

<select
  class="field-select"
  bind:value
  {disabled}
  {id}
>
  <option value={null}>{placeholder}</option>
  {#each options as f (f.field)}
    <option value={f.field}>{f.label}</option>
  {/each}
</select>

<style>
  .field-select {
    flex: 1;
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #d6d2c6);
    border-radius: 3px;
    background: var(--tv-surface-bg, #fff);
    font-family: inherit;
    font-size: 11px;
    color: var(--tv-text, #1f1f1f);
  }
  .field-select:focus {
    outline: none;
    border-color: var(--tv-accent, #b53a1f);
    box-shadow: 0 0 0 2px var(--tv-hover-bg, rgba(0, 0, 0, 0.06));
  }
  .field-select:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

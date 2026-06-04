<!--
  TextInput — single-line text field. Bindable. Width fills the
  control column by default.
-->
<script lang="ts">
  interface Props {
    value?: string | null;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    /** Optional explicit width in px; otherwise flex-grows. */
    width?: number;
  }

  let {
    value = $bindable(null),
    placeholder = "",
    disabled = false,
    id,
    width,
  }: Props = $props();

  let raw = $state(value ?? "");
  $effect(() => {
    const next = value ?? "";
    if (next !== raw) raw = next;
  });

  function commit() {
    value = raw === "" ? null : raw;
  }
</script>

<input
  type="text"
  class="text-input"
  bind:value={raw}
  onchange={commit}
  {placeholder}
  {disabled}
  {id}
  style:width={width ? `${width}px` : undefined}
/>

<style>
  .text-input {
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
  .text-input:focus {
    outline: none;
    border-color: var(--tv-accent, #b53a1f);
    box-shadow: 0 0 0 2px var(--tv-hover-bg, rgba(0, 0, 0, 0.06));
  }
  .text-input::placeholder {
    color: var(--tv-text-subtle, #aaa39a);
    font-style: italic;
  }
  .text-input:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

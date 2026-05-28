<!--
  NumberInput — right-aligned monospace number input. Optional placeholder
  hint (e.g. "auto" for blank-means-content-driven). Empty string maps to
  null (no value set). Bindable.
-->
<script lang="ts">
  interface Props {
    value?: number | null;
    placeholder?: string;
    integer?: boolean;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    disabled?: boolean;
    id?: string;
  }

  let {
    value = $bindable(null),
    placeholder = "",
    integer = false,
    min,
    max,
    step,
    suffix,
    disabled = false,
    id,
  }: Props = $props();

  let raw = $state(value == null ? "" : String(value));
  // Keep `raw` in sync if parent flips value externally.
  $effect(() => {
    const next = value == null ? "" : String(value);
    if (next !== raw) raw = next;
  });

  function commit(s: string) {
    if (s === "") {
      value = null;
      return;
    }
    const n = integer ? parseInt(s, 10) : Number(s);
    if (Number.isFinite(n)) value = n;
  }
</script>

<span class="num-wrap">
  <input
    type={integer ? "number" : "number"}
    bind:value={raw}
    onchange={() => commit(raw)}
    {placeholder}
    {min}
    {max}
    {step}
    {disabled}
    {id}
    inputmode={integer ? "numeric" : "decimal"}
  />
  {#if suffix}
    <span class="suffix">{suffix}</span>
  {/if}
</span>

<style>
  .num-wrap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  input {
    width: 64px;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #d6d2c6);
    border-radius: 3px;
    background: var(--tv-bg, #fff);
    font-family: var(--tv-font-mono, ui-monospace, "IBM Plex Mono", monospace);
    font-size: 11px;
    color: var(--tv-fg, #1f1f1f);
    text-align: right;
  }
  input:focus {
    outline: none;
    border-color: var(--tv-accent, #b53a1f);
    box-shadow: 0 0 0 2px var(--tv-hover-bg, rgba(0, 0, 0, 0.06));
  }
  input::placeholder {
    color: var(--tv-muted, #aaa39a);
    font-style: italic;
  }
  input:disabled { opacity: 0.5; cursor: not-allowed; }
  /* Hide native spinner — they're ugly and we want consistent presentation. */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .suffix {
    font-family: var(--tv-font-mono, ui-monospace, "IBM Plex Mono", monospace);
    font-size: 10px;
    color: var(--tv-text-muted, #7a7466);
  }
</style>

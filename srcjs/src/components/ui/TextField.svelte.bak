<!--
  TextField — settings-panel single-line text row. v2-skinned: Field
  wraps a raw input styled like the v2 chip. Caller API unchanged.
  Two events: oninput (every keystroke, for live preview) + onchange
  (blur/Enter, for one op-log entry per edit session).
-->
<script lang="ts">
  import Field from "$components/primitives/v2/Field.svelte";

  interface Props {
    label: string;
    hint?: string;
    value: string;
    placeholder?: string;
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
  }

  let { label, hint, value, placeholder, oninput, onchange }: Props = $props();

  function handleInput(e: Event) {
    oninput?.((e.target as HTMLInputElement).value);
  }
  function commit(e: Event) {
    onchange?.((e.target as HTMLInputElement).value);
  }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") onchange?.((e.target as HTMLInputElement).value);
  }
</script>

<div class="tf-row" data-tv-v2>
  <Field {label} {hint}>
    <input
      class="tf-input"
      type="text"
      {value}
      {placeholder}
      oninput={handleInput}
      onchange={commit}
      onblur={commit}
      onkeydown={handleKeydown}
      spellcheck="false"
      aria-label={label}
    />
  </Field>
</div>

<style>
  .tf-row { display: contents; }
  .tf-input {
    flex: 1;
    min-width: 0;
    height: var(--v2-control-h, 22px);
    padding: 0 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    outline: none;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .tf-input:hover  { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .tf-input:focus  { box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e); }
  .tf-input::placeholder {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }
</style>

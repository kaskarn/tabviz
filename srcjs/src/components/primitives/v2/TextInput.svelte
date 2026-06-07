<!--
  TextInput — the mono inset input chassis, promoted out of Swatch's
  `.hex` field (settings-overhaul P1) so every panel text entry (hex,
  watermark text, search) shares ONE input shape instead of each control
  hand-rolling its own.

  Commit semantics match the hex field: value commits on Enter / blur
  (`oncommit`), with `oninput` available for live-preview hosts. Escape
  restores the last committed value.
-->
<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    /** Left-align (prose) instead of the hex field's right-align. */
    alignLeft?: boolean;
    ariaLabel?: string;
    ariaDescribedby?: string;
    ariaInvalid?: boolean;
    oninput?: (next: string) => void;
    oncommit?: (next: string) => void;
  }

  let {
    value = $bindable(""),
    placeholder,
    disabled = false,
    id,
    alignLeft = false,
    ariaLabel,
    ariaDescribedby,
    ariaInvalid = false,
    oninput,
    oncommit,
  }: Props = $props();

  let committed = value;

  function handleInput(e: Event): void {
    value = (e.currentTarget as HTMLInputElement).value;
    oninput?.(value);
  }
  function commit(): void {
    if (value !== committed) {
      committed = value;
      oncommit?.(value);
    }
  }
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      commit();
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      value = committed;
      (e.currentTarget as HTMLInputElement).blur();
    }
  }
</script>

<input
  type="text"
  class="ti"
  class:left={alignLeft}
  {id}
  {placeholder}
  {disabled}
  {value}
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedby}
  aria-invalid={ariaInvalid || undefined}
  oninput={handleInput}
  onblur={commit}
  onkeydown={handleKeydown}
/>

<style>
  .ti {
    flex: 1 1 auto;
    min-width: 56px;
    height: var(--v2-control-h, 22px);
    padding: 0 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    color: var(--v2-ink, #15140e);
    text-align: right;
  }
  .ti.left { text-align: left; }
  .ti:hover { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .ti:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e);
  }
  .ti:disabled { opacity: 0.4; }
  .ti::placeholder { color: var(--v2-ink-3, #8a8478); }
</style>

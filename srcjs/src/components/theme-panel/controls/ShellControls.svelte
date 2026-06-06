<!--
  ShellControls — Stage 2 §2 shell/paper two-surface model.
  flush / raised / float / transparent.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";

  const {
    inputs,
    onchange,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
  } = $props();

  const SHELL_MODES = ["flush", "raised", "float", "transparent"] as const;
  // Header chrome is a STRUCTURAL VARIANT, so it lives here with the
  // other surface pickers — it moved out of the Effects tab when
  // effects.header_style was retired (R2 decision).
  const HEADER_STYLES = ["light", "tint", "bold"] as const;
  const shellMode = $derived(inputs.shell_mode ?? "flush");
  const headerStyle = $derived(inputs.header_style ?? "light");

  function setShellMode(v: (typeof SHELL_MODES)[number]): void {
    onchange({ ...inputs, shell_mode: v });
  }
  function setHeaderStyle(v: (typeof HEADER_STYLES)[number]): void {
    onchange({ ...inputs, header_style: v });
  }
</script>

<div class="rows">
  <div class="row">
    <span class="label">Shell</span>
    <div class="seg" role="radiogroup" aria-label="Shell mode">
      {#each SHELL_MODES as m (m)}
        <button type="button" class:on={shellMode === m} onclick={() => setShellMode(m)}>{m}</button>
      {/each}
    </div>
  </div>
  <div class="row">
    <span class="label">Header</span>
    <div class="seg" role="radiogroup" aria-label="Header style">
      {#each HEADER_STYLES as h (h)}
        <button type="button" class:on={headerStyle === h} onclick={() => setHeaderStyle(h)}>{h}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .rows { display: flex; flex-direction: column; gap: 6px; padding: 4px 18px 10px; }
  .row {
    display: grid;
    grid-template-columns: 70px 1fr;
    align-items: center;
    gap: 10px;
  }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--tp-muted, #6b6760); }
  .seg {
    display: inline-flex;
    border: 1px solid var(--tp-rule, #d8d4cc);
    border-radius: 4px;
    overflow: hidden;
    background: var(--tp-input-bg, #ffffff);
  }
  .seg button {
    flex: 1;
    border: 0;
    border-right: 1px solid var(--tp-rule, #e8e6e1);
    background: transparent;
    color: var(--tp-fg, #1c1a17);
    padding: 6px 8px;
    font-size: 11px;
    cursor: pointer;
    text-transform: capitalize;
  }
  .seg button:last-child { border-right: 0; }
  .seg button.on { background: var(--tp-fg, #1c1a17); color: var(--tp-input-bg, #ffffff); }
</style>

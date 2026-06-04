<!--
  ColorChip — chip + hex text input + optional theme-anchored swatches.
  Swatches are quick-picks driven by the active theme's tokens.
  Modeled on rgc-design Color (controls.jsx:61-80, styles.css:263-285).
-->
<script lang="ts">
  interface Props {
    value?: string | null;
    /** Optional row of hex swatches for quick-pick. */
    swatches?: string[];
    placeholder?: string;
    disabled?: boolean;
    id?: string;
  }

  let {
    value = $bindable(null),
    swatches,
    placeholder = "#…",
    disabled = false,
    id,
  }: Props = $props();

  let raw = $state(value ?? "");
  $effect(() => {
    const next = value ?? "";
    if (next !== raw) raw = next;
  });

  function commit() {
    value = raw === "" ? null : raw;
  }

  function pick(c: string) {
    raw = c;
    value = c;
  }
</script>

<div class="color-row">
  <span class="chip" style:background={value ?? "transparent"} aria-hidden="true"></span>
  <input
    type="text"
    class="hex"
    bind:value={raw}
    onchange={commit}
    {placeholder}
    {disabled}
    {id}
    spellcheck="false"
  />
  {#if swatches && swatches.length > 0}
    <div class="swatches">
      {#each swatches as c}
        <button
          type="button"
          class="swatch"
          style:background={c}
          aria-label={`Set color ${c}`}
          {disabled}
          onclick={() => pick(c)}
        ></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .color-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }
  .chip {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid var(--tv-border, #d6d2c6);
    flex-shrink: 0;
  }
  .hex {
    width: 88px;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #d6d2c6);
    border-radius: 3px;
    background: var(--tv-surface-bg, #fff);
    font-family: var(--tv-text-numeric-family, ui-monospace, "IBM Plex Mono", monospace);
    font-size: 11px;
    color: var(--tv-text, #1f1f1f);
  }
  .hex:focus {
    outline: none;
    border-color: var(--tv-accent, #b53a1f);
    box-shadow: 0 0 0 2px var(--tv-hover-bg, rgba(0, 0, 0, 0.06));
  }
  .swatches { display: flex; gap: 2px; }
  .swatch {
    width: 12px;
    height: 12px;
    padding: 0;
    border-radius: 2px;
    border: 1px solid var(--tv-border, #d6d2c6);
    cursor: pointer;
    transition: transform 80ms ease;
  }
  .swatch:hover { transform: scale(1.15); }
  .swatch:focus-visible {
    outline: 2px solid var(--tv-accent, #b53a1f);
    outline-offset: 1px;
  }
</style>

<!--
  Swatch — color input. Replaces v1 ColorChip.

  Anatomy:
    │ chip │  #b53a1f  │  ▾  │      ← collapsed
    └──────┴───────────┴─────┘
                  │
         palette below (when open):
         ┌────────────────────┐
         │ theme tokens row   │
         │ recent uses row    │
         │ native eye-dropper │
         └────────────────────┘

  The chip on the left is itself a button that opens a native color
  input via the EyeDropper-style hidden <input type="color">. Behind
  that, the palette dropdown shows theme-token swatches (when supplied)
  in a tracked-row plus optional recent-uses.

  Bold touches:
  - Hex input always lives in mono — `#b53a1f` is the canonical form
  - Theme swatches show their token name beneath on hover (tooltip)
  - "Unset" is a first-class palette entry — a diagonal-stripe chip
    that resolves to null, signaling "inherit cascade"
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { ThemeSwatch } from "./types";

  interface Props {
    value?: string | null;
    /** Theme-anchored palette swatches. */
    swatches?: ThemeSwatch[];
    /** Recent colors used elsewhere in the spec. */
    recents?: string[];
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    /** Show the "unset" diagonal-stripe swatch. */
    allowUnset?: boolean;
  }

  let {
    value = $bindable(null),
    swatches = [],
    recents = [],
    placeholder = "#…",
    disabled = false,
    id,
    allowUnset = true,
  }: Props = $props();

  let open = $state(false);
  let trigger: HTMLDivElement | undefined = $state();
  let menu: HTMLDivElement | undefined = $state();
  let hexInput: HTMLInputElement | undefined = $state();
  let nativeColor: HTMLInputElement | undefined = $state();

  // In-flight hex string for typing. Commits on blur/Enter.
  let raw = $state(value ?? "");
  $effect(() => {
    const next = value ?? "";
    if (next !== raw) raw = next;
  });

  function isValidHex(s: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
  }
  function commit() {
    const t = raw.trim();
    if (t === "") { value = null; return; }
    if (isValidHex(t)) value = t.startsWith("#") ? t : `#${t}`;
    else raw = value ?? ""; // reject invalid; revert
  }
  function pick(c: string | null) {
    value = c;
    raw = c ?? "";
    open = false;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
  }
  function openNativePicker() {
    nativeColor?.click();
  }
  function onNativeChange(e: Event) {
    const c = (e.target as HTMLInputElement).value;
    pick(c);
  }

  // ── Outside-click close ────────────────────────────────────
  function onDocClick(e: MouseEvent) {
    if (!open) return;
    const t = e.target as Node | null;
    if (!t) return;
    if (trigger?.contains(t)) return;
    if (menu?.contains(t)) return;
    open = false;
  }
  onMount(() => {
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  });

  const displayed = $derived(isValidHex(value ?? "") ? value : null);
</script>

<div class="swatch" class:disabled bind:this={trigger}>
  <!-- The chip itself is a click target for the native picker -->
  <button
    type="button"
    class="chip"
    class:unset={!displayed}
    style:background={displayed ?? "transparent"}
    {disabled}
    aria-label="open color picker"
    onclick={openNativePicker}
  ></button>

  <input
    type="text"
    class="hex"
    bind:value={raw}
    onblur={commit}
    onkeydown={onKey}
    {placeholder}
    {disabled}
    {id}
    spellcheck="false"
    bind:this={hexInput}
  />

  <button
    type="button"
    class="more"
    aria-label="open color palette"
    aria-expanded={open}
    {disabled}
    onclick={() => (open = !open)}
  >▾</button>

  <!-- Hidden native color input — opened by the chip button -->
  <input
    type="color"
    class="native"
    bind:this={nativeColor}
    value={displayed ?? "#000000"}
    onchange={onNativeChange}
    tabindex="-1"
    aria-hidden="true"
  />

  {#if open}
    <div class="palette" bind:this={menu}>
      {#if swatches.length > 0}
        <div class="pal-group">
          <div class="pal-flag">theme</div>
          <div class="pal-row">
            {#each swatches as s (s.token)}
              <button
                type="button"
                class="pal-chip"
                class:active={value === s.color}
                style:background={s.color}
                title={s.token}
                onclick={() => pick(s.color)}
                aria-label={s.token}
              ></button>
            {/each}
            {#if allowUnset}
              <button
                type="button"
                class="pal-chip unset-chip"
                class:active={value == null}
                title="unset — inherit"
                onclick={() => pick(null)}
                aria-label="unset"
              ></button>
            {/if}
          </div>
        </div>
      {/if}

      {#if recents.length > 0}
        <div class="pal-group">
          <div class="pal-flag">recent</div>
          <div class="pal-row">
            {#each recents as c, i (`${c}-${i}`)}
              <button
                type="button"
                class="pal-chip"
                class:active={value === c}
                style:background={c}
                title={c}
                onclick={() => pick(c)}
                aria-label={c}
              ></button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="pal-foot">
        <button type="button" class="pal-foot-btn" onclick={openNativePicker}>
          <span class="pal-foot-glyph">◉</span>
          <span>color picker</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .swatch {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: var(--v2-control-h, 22px);
  }
  .swatch.disabled { opacity: 0.4; pointer-events: none; }

  /* ── Trigger row: chip / hex / more ─────────────────────── */
  .chip {
    appearance: none;
    border: 0;
    padding: 0;
    width: 22px;
    height: var(--v2-control-h, 22px);
    border-radius: var(--v2-r-soft, 3px);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    cursor: pointer;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .chip:hover { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .chip.unset {
    /* Diagonal-stripe pattern for "no color set". */
    background-image: repeating-linear-gradient(
      45deg,
      var(--v2-paper-edge, #fff) 0 4px,
      var(--v2-paper-2, #f3efe5) 4px 8px
    ) !important;
  }

  .hex {
    appearance: none;
    width: 80px;
    height: var(--v2-control-h, 22px);
    padding: 0 7px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    outline: none;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .hex:hover { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .hex:focus { box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e); }
  .hex::placeholder {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }

  .more {
    appearance: none;
    height: var(--v2-control-h, 22px);
    width: 18px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink-3, #8a8478);
    font-size: 9px;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .more:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .more[aria-expanded="true"] {
    background: var(--v2-paper-2, #f3efe5);
    color: var(--v2-ink, #15140e);
  }

  .native {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  /* ── Palette dropdown ──────────────────────────────────── */
  .palette {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 180px;
    background: var(--v2-paper-edge, #fff);
    border-radius: var(--v2-r-large, 6px);
    box-shadow:
      0 0 0 1px var(--v2-rule, #d6d0c1),
      0 8px 24px rgba(21, 20, 14, 0.10);
    overflow: hidden;
    z-index: 1000;
    padding: 4px 0;
  }
  .pal-group { padding: 4px 8px; }
  .pal-flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 9px;
    color: var(--v2-ink-3, #8a8478);
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    margin-bottom: 4px;
  }
  .pal-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .pal-chip {
    appearance: none;
    border: 0;
    padding: 0;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    cursor: pointer;
    transition:
      transform var(--v2-dur-snap, 80ms) var(--v2-ease),
      box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .pal-chip:hover { transform: scale(1.12); }
  .pal-chip.active {
    box-shadow: inset 0 0 0 1px var(--v2-ink, #15140e),
                0 0 0 2px var(--v2-paper-edge, #fff),
                0 0 0 3px var(--v2-ink, #15140e);
  }
  .unset-chip {
    background-image: repeating-linear-gradient(
      45deg,
      var(--v2-paper-edge, #fff) 0 3px,
      var(--v2-paper-2, #f3efe5) 3px 6px
    );
  }

  .pal-foot {
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
    padding: 4px;
  }
  .pal-foot-btn {
    appearance: none;
    border: 0;
    background: transparent;
    width: 100%;
    padding: 4px 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: var(--v2-r-soft, 3px);
    cursor: pointer;
    font: inherit;
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-2, #4a463c);
    text-align: left;
  }
  .pal-foot-btn:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .pal-foot-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 12px;
    line-height: 1;
    width: 14px;
    text-align: center;
  }
</style>

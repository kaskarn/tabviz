<script lang="ts">
  interface Props {
    /** Visible label for the field. */
    label: string;
    /** Optional secondary hint shown under the label. */
    hint?: string;
    /** Current color as a CSS color string (any form). */
    value: string;
    /** Fired whenever the value changes — either swatch picker or hex input. */
    onchange: (value: string) => void;
    /**
     * Optional 8-color theme palette. When provided, renders a small
     * "Theme / Custom" tab control above the input row. Click a theme
     * swatch to apply that color; switch to Custom for the free-form
     * hex picker. When absent (the historical behaviour), the picker
     * stays purely free-form — no tabs.
     */
    swatches?: string[];
    /**
     * When true, renders an "overridden" indicator (small dot) plus a
     * reset button that calls `onreset`. Used by Theme tab fields that
     * participate in Brand-cascade defaults — the dot signals that the
     * field has been hand-edited and won't be touched by future Brand
     * multi-writes; the reset reverts to the brand-derived value.
     */
    overridden?: boolean;
    /** Called when the user clicks the reset icon. */
    onreset?: () => void;
  }

  let { label, hint, value, onchange, swatches, overridden, onreset }: Props = $props();

  /**
   * The native `<input type="color">` only accepts 6-digit hex. The theme
   * colors in the wild are usually hex already but can occasionally be
   * rgba()/color-mix()/named — we normalize for the picker only, while the
   * free-form text input stays as the source of truth.
   */
  function normalizeForPicker(v: string): string {
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    // 3-digit hex → 6-digit
    const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
    if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
    // Fallback: black, picker will still work, user can type in free field.
    return "#000000";
  }

  const pickerValue = $derived(normalizeForPicker(value));

  const hasSwatches = $derived(Array.isArray(swatches) && swatches.length > 0);

  // Default tab is always "Custom" (v0.25.0+). Users explicitly opt
  // into the Theme palette by clicking the tab. Per user feedback the
  // earlier "auto-pick Theme when value matches a swatch" behaviour
  // surprised authors who expected the free-form picker on first open.
  let tab = $state<"theme" | "custom">("custom");

  function handlePicker(e: Event) {
    onchange((e.target as HTMLInputElement).value);
  }

  function handleText(e: Event) {
    onchange((e.target as HTMLInputElement).value);
  }

  function pickSwatch(c: string) {
    onchange(c);
  }
</script>

<div class="color-field" title={hint}>
  <span class="label">
    {label}
    {#if overridden}
      <span class="override-dot" aria-hidden="true" title="Overridden — won't follow Brand">●</span>
      {#if onreset}
        <button
          type="button"
          class="reset-btn"
          onclick={onreset}
          title="Reset to default"
          aria-label="Reset {label} to default"
        >⤺</button>
      {/if}
    {/if}
  </span>
  <div class="controls">
    {#if hasSwatches}
      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab"
          class:active={tab === "theme"}
          aria-selected={tab === "theme"}
          onclick={() => (tab = "theme")}
        >Theme</button>
        <button
          type="button"
          role="tab"
          class="tab"
          class:active={tab === "custom"}
          aria-selected={tab === "custom"}
          onclick={() => (tab = "custom")}
        >Custom</button>
      </div>
    {/if}

    {#if hasSwatches && tab === "theme"}
      <div class="swatches" role="group" aria-label="{label} theme swatches">
        {#each swatches ?? [] as c, i (i)}
          <button
            type="button"
            class="theme-swatch"
            class:selected={c.toLowerCase() === value?.toLowerCase()}
            style:background={c}
            title={c}
            aria-label="Apply {c}"
            onclick={() => pickSwatch(c)}
          ></button>
        {/each}
      </div>
    {:else}
      <div class="custom-row">
        <!-- The swatch IS the color picker — clicking it opens the native
             color dialog. Overlay the current value as a background so it
             always reads as "a swatch" even before the user interacts. -->
        <label class="swatch" style:background={value}>
          <input
            class="picker"
            type="color"
            value={pickerValue}
            oninput={handlePicker}
            aria-label="{label} color picker"
          />
        </label>
        <input
          class="hex"
          type="text"
          {value}
          oninput={handleText}
          spellcheck="false"
          aria-label="{label} color value"
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .color-field {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .label {
    font-size: 0.75rem;
    color: var(--tv-fg, #1a1a1a);
    font-weight: 500;
    line-height: 1.2;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .override-dot {
    color: var(--tv-primary, #2563eb);
    font-size: 0.55rem;
    line-height: 1;
  }

  .reset-btn {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--tv-secondary, #64748b);
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1;
    padding: 0 2px;
    border-radius: 3px;
  }
  .reset-btn:hover {
    color: var(--tv-primary, #2563eb);
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 8%, transparent);
  }

  .controls {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .custom-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .tabs {
    display: inline-flex;
    border: 1px solid color-mix(in srgb, var(--tv-fg, #1a1a1a) 12%, transparent);
    border-radius: 4px;
    overflow: hidden;
    height: 18px;
  }

  .tab {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--tv-fg, #1a1a1a);
    font-size: 0.65rem;
    font-weight: 500;
    padding: 0 8px;
    line-height: 1;
    cursor: pointer;
  }

  .tab.active {
    background: var(--tv-primary, #2563eb);
    color: var(--tv-bg, #ffffff);
  }

  .tab + .tab {
    border-left: 1px solid color-mix(in srgb, var(--tv-fg, #1a1a1a) 12%, transparent);
  }

  .swatches {
    display: inline-grid;
    grid-template-columns: repeat(8, 16px);
    gap: 4px;
  }

  .theme-swatch {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--tv-fg, #1a1a1a) 25%, transparent);
    padding: 0;
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }

  .theme-swatch:hover {
    transform: scale(1.15);
  }

  .theme-swatch.selected {
    box-shadow: 0 0 0 2px var(--tv-bg, #ffffff),
                0 0 0 3px var(--tv-primary, #2563eb);
  }

  .swatch {
    position: relative;
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, var(--tv-fg, #1a1a1a) 15%, transparent);
    /* Checkerboard peeks through when color has transparency. */
    background-image:
      linear-gradient(45deg, #eee 25%, transparent 25%),
      linear-gradient(-45deg, #eee 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #eee 75%),
      linear-gradient(-45deg, transparent 75%, #eee 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
    cursor: pointer;
    overflow: hidden;
  }

  .swatch::after {
    content: "";
    position: absolute;
    inset: 0;
    background: inherit;
    background-image: none;
  }

  .picker {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .hex {
    width: 78px;
    padding: 2px 4px;
    border: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 12%, var(--tv-border, #e2e8f0));
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.7rem;
    text-align: center;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .hex:focus {
    border-color: var(--tv-primary, #2563eb);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--tv-primary, #2563eb) 15%, transparent);
  }
</style>

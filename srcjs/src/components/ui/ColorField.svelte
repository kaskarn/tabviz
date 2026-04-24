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
  }

  let { label, hint, value, onchange }: Props = $props();

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

  function handlePicker(e: Event) {
    onchange((e.target as HTMLInputElement).value);
  }

  function handleText(e: Event) {
    onchange((e.target as HTMLInputElement).value);
  }
</script>

<div class="color-field" title={hint}>
  <span class="label">{label}</span>
  <div class="controls">
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
    color: var(--wf-fg, #1a1a1a);
    font-weight: 500;
    line-height: 1.2;
    min-width: 0;
  }

  .controls {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .swatch {
    position: relative;
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, var(--wf-fg, #1a1a1a) 15%, transparent);
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
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 12%, var(--wf-border, #e2e8f0));
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.7rem;
    text-align: center;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .hex:focus {
    border-color: var(--wf-primary, #2563eb);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--wf-primary, #2563eb) 15%, transparent);
  }
</style>

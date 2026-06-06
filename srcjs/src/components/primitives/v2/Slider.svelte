<!--
  Slider — continuous-numeric control modeled on rgc-design. Distinct
  from Knob: Knob is for editing values (chip-style input + drag-scrub
  for ranges); Slider is for browsing a range (font size, padding,
  tracking, row height) where the affordance is "drag the thumb to
  pick from a continuous spectrum."

  Anatomy:
    [───────●─────────────]   12.5 px
       2px track + 12px thumb       mono value + muted suffix

  No chip, no input field. Track is hairline, thumb is an ink dot.
  Value display sits right of the track in mono with tabular nums and
  an optional muted suffix. The whole control fills the available
  width of its row.

  Use `Knob` when the user needs to TYPE a value; `Slider` when the
  domain is continuous + bounded and the value can be visually picked.
-->
<script lang="ts">
  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    /** Mono suffix shown after the value display (e.g. "px", "%", "‰"). */
    suffix?: string;
    /** Tabular value width in characters. Default 4 ("12.5"). */
    valueWidth?: number;
    disabled?: boolean;
    ariaLabel?: string;
    onchange?: (next: number) => void;
  }

  let {
    value = $bindable(),
    min,
    max,
    step = 1,
    suffix,
    valueWidth = 4,
    disabled = false,
    ariaLabel,
    onchange,
  }: Props = $props();

  function handleInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(v)) {
      value = v;
      onchange?.(v);
    }
  }
</script>

<span class="slider" class:disabled>
  <input
    type="range"
    {min}
    {max}
    {step}
    {value}
    {disabled}
    aria-label={ariaLabel}
    aria-valuetext={suffix ? `${value}${suffix}` : undefined}
    oninput={handleInput}
  />
  <span class="val" style:width="{valueWidth + 1}ch">
    {value}{#if suffix}<span class="suf">{suffix}</span>{/if}
  </span>
</span>

<style>
  .slider {
    display: inline-flex;
    align-items: center;
    gap: var(--v2-gap-mid, 8px);
    flex: 1;
    min-width: 0;
  }
  .slider.disabled { opacity: 0.4; pointer-events: none; }

  input[type="range"] {
    flex: 1;
    min-width: 0;
    appearance: none;
    -webkit-appearance: none;
    /* 24px hit area (WCAG 2.5.8, chrome D); the painted track stays the
       2px hairline via the explicit track pseudo-elements below. */
    height: 24px;
    background: transparent;
    cursor: pointer;
    padding: 0;
    margin: 0;
  }
  /* Track + thumb: 2px hairline + 12px ink dot. Webkit + Firefox each
     need their own rule — the pseudo-element selectors don't merge. */
  input[type="range"]::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--v2-paper-2, #f3efe5);
    border-radius: 2px;
  }
  input[type="range"]::-moz-range-track {
    height: 2px;
    background: var(--v2-paper-2, #f3efe5);
    border-radius: 2px;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -5px; /* center the 12px dot on the 2px track */
    border-radius: 50%;
    background: var(--v2-ink, #15140e);
    cursor: pointer;
    border: 0;
    transition: transform var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--v2-ink, #15140e);
    cursor: pointer;
    border: 0;
  }
  input[type="range"]:hover::-webkit-slider-thumb,
  input[type="range"]:focus::-webkit-slider-thumb { transform: scale(1.15); }
  input[type="range"]:focus-visible { outline: 1px solid var(--v2-focus-ring, #15140e); outline-offset: 4px; }
  @media (prefers-reduced-motion: reduce) {
    input[type="range"]::-webkit-slider-thumb { transition: none; }
  }

  .val {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink, #15140e);
    font-variant-numeric: tabular-nums;
    text-align: right;
    flex: none;
  }
  .suf {
    color: var(--v2-ink-3, #8a8478);
    margin-left: 1px;
  }
</style>

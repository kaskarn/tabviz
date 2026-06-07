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
    /** Override the value display (e.g. "28°", "×1.20"). Defaults to
     *  `${value}${suffix}`. Also used as aria-valuetext. */
    valueText?: string;
    /** CSS background for the track — e.g. a hue-wheel or axis gradient
     *  (AnchorRow's LCH sliders). Default: the hairline paper-2 fill. */
    track?: string;
    /** CSS color for the thumb dot. Default: ink. */
    thumbColor?: string;
    /** Fired on every input tick (drag) — the C53 preview channel.
     *  `onchange` then fires once on commit (release). When `oncommit`
     *  is absent, `onchange` fires per-tick (legacy behavior). */
    oncommit?: (next: number) => void;
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
    valueText,
    track,
    thumbColor,
    oncommit,
    onchange,
  }: Props = $props();

  function handleInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(v)) {
      value = v;
      onchange?.(v);
    }
  }

  function handleCommit(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(v)) {
      value = v;
      oncommit?.(v);
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
    aria-valuetext={valueText ?? (suffix ? `${value}${suffix}` : undefined)}
    style:--slider-track={track}
    style:--slider-thumb={thumbColor}
    oninput={handleInput}
    onchange={handleCommit}
  />
  <span class="val" style:width="{valueWidth + 1}ch">
    {#if valueText}{valueText}{:else}{value}{#if suffix}<span class="suf">{suffix}</span>{/if}{/if}
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
    /* `--slider-track` lets callers paint a meaning-bearing track (the
       AnchorRow hue wheel / axis gradients); taller when custom so the
       gradient reads. Default stays the 2px hairline. */
    height: var(--slider-track-h, 2px);
    background: var(--slider-track, var(--v2-paper-2, #f3efe5));
    border-radius: 999px;
  }
  input[type="range"]::-moz-range-track {
    height: var(--slider-track-h, 2px);
    background: var(--slider-track, var(--v2-paper-2, #f3efe5));
    border-radius: 999px;
  }
  input[type="range"][style*="--slider-track:"] {
    --slider-track-h: 10px;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    /* center the 12px dot: (track-h - 12)/2 */
    margin-top: calc((var(--slider-track-h, 2px) - 12px) / 2);
    border-radius: 50%;
    background: var(--slider-thumb, var(--v2-ink, #15140e));
    cursor: pointer;
    border: 0;
    box-shadow: 0 0 0 1.5px var(--v2-paper, #faf7f0);
    transition: transform var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--slider-thumb, var(--v2-ink, #15140e));
    cursor: pointer;
    border: 0;
    box-shadow: 0 0 0 1.5px var(--v2-paper, #faf7f0);
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

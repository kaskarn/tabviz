<!--
  Stage 3 §4 — OKLCH picker popover.

  L×C field at current hue, hue rail, hex input round-trip, OOG
  checkerboard, Snap-to-sRGB by chroma-clip at current L,H.

  Live update: every cursor move applies via the bound `oninput`.
  Popover ≥900px viewport; bottom drawer <900px.
-->
<script lang="ts">
  import { hexToOklch, oklchToHex } from "$lib/oklch";
  import { onMount, untrack } from "svelte";

  const {
    value,
    oninput,
    onclose,
    label = "Color",
  }: {
    value: string;
    oninput: (hex: string) => void;
    onclose: () => void;
    label?: string;
  } = $props();

  // OKLCH state (separate from the prop value so dragging stays smooth).
  let L = $state(0.5);
  let C = $state(0.1);
  let H = $state(0);
  let hexInput = $state("");

  // Field dimensions (logical pixels).
  const FIELD_SIZE = 220;
  const HUE_HEIGHT = 16;

  let mounted = false;
  onMount(() => {
    const oklch = hexToOklch(value);
    L = oklch.L;
    C = oklch.C;
    H = oklch.H;
    hexInput = value;
    mounted = true;
  });

  // Live hex from L,C,H. Clamps to sRGB only when emitting back to the
  // consumer (so OOG visualization works inside the field).
  const liveHex = $derived(oklchToHex({ L, C, H }));
  const inGamut = $derived(isInSRGB(L, C, H));

  // Inputs callback whenever the picker value changes.
  //
  // The emit is wrapped in `untrack(...)` so the function-reference change
  // on `oninput` (the parent re-binds a fresh arrow per render) doesn't
  // re-register `oninput` as a dependency. Without this, every cascade
  // re-render after we emit would invalidate this effect and re-emit the
  // same hex, hitting Svelte's effect_update_depth_exceeded guard.
  $effect(() => {
    if (!mounted) return;
    const ok = inGamut;
    const hex = liveHex.toUpperCase();
    if (ok) {
      untrack(() => oninput(hex));
    }
  });

  /** Quick OOG check: convert to hex via the oklch library; if rounding
   *  to 24-bit + roundtrip mismatches significantly, it's OOG. Conservative. */
  function isInSRGB(L_: number, C_: number, H_: number): boolean {
    const hex = oklchToHex({ L: L_, C: C_, H: H_ });
    const back = hexToOklch(hex);
    // If C clamped (i.e. the sRGB representation can't reach the desired chroma),
    // the round-trip C will be lower than C_. Allow small floating tolerance.
    return Math.abs(back.C - C_) < 0.005;
  }

  /** Snap to sRGB by reducing chroma at the current L, H. */
  function snapToSRGB(): void {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (isInSRGB(L, mid, H)) lo = mid; else hi = mid;
    }
    C = lo;
  }

  function onFieldClick(e: MouseEvent): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(FIELD_SIZE, e.clientX - rect.left));
    const y = Math.max(0, Math.min(FIELD_SIZE, e.clientY - rect.top));
    C = (x / FIELD_SIZE) * 0.4;        // C axis 0..0.4
    L = 1 - (y / FIELD_SIZE);          // L axis 1..0 top-to-bottom
  }

  function onHueClick(e: MouseEvent): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    H = (x / rect.width) * 360;
  }

  function commitHex(input: string): void {
    if (!/^#[0-9A-Fa-f]{6}$/.test(input)) return;
    const oklch = hexToOklch(input);
    L = oklch.L;
    C = oklch.C;
    H = oklch.H;
    hexInput = input.toUpperCase();
  }

  // Track current L,C as percentages for the cursor crosshair.
  const cursorX = $derived(Math.round((C / 0.4) * FIELD_SIZE));
  const cursorY = $derived(Math.round((1 - L) * FIELD_SIZE));
  const huePos = $derived(Math.round((H / 360) * FIELD_SIZE));
</script>

<div
  class="oklch-picker"
  role="dialog"
  aria-label="{label} picker"
  style:--hue={H}
>
  <header>
    <strong>{label}</strong>
    <button type="button" class="close" onclick={onclose} aria-label="Close">×</button>
  </header>

  <div
    class="field"
    role="slider"
    aria-label="Lightness × Chroma"
    aria-valuenow={Math.round(L * 100)}
    tabindex="0"
    style:width="{FIELD_SIZE}px"
    style:height="{FIELD_SIZE}px"
    onmousedown={(e) => { onFieldClick(e); const move = (ev: MouseEvent) => onFieldClick(ev); const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }}
  >
    <div class="checkerboard"></div>
    <div class="field-overlay"></div>
    <div class="cursor" style:left="{cursorX}px" style:top="{cursorY}px"></div>
  </div>

  <div
    class="hue-rail"
    role="slider"
    aria-label="Hue"
    aria-valuenow={Math.round(H)}
    tabindex="0"
    style:width="{FIELD_SIZE}px"
    style:height="{HUE_HEIGHT}px"
    onmousedown={(e) => { onHueClick(e); const move = (ev: MouseEvent) => onHueClick(ev); const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }}
  >
    <div class="hue-thumb" style:left="{huePos}px"></div>
  </div>

  <div class="meta">
    <input
      type="text"
      value={liveHex.toUpperCase()}
      oninput={(e) => { hexInput = (e.currentTarget as HTMLInputElement).value; }}
      onchange={(e) => commitHex((e.currentTarget as HTMLInputElement).value)}
      onkeydown={(e) => { if (e.key === "Enter") commitHex((e.currentTarget as HTMLInputElement).value); }}
      class="hex-input"
      aria-label="Hex value"
    />
    <span class="lch-values">L {L.toFixed(2)} · C {C.toFixed(2)} · H {Math.round(H)}°</span>
  </div>

  {#if !inGamut}
    <div class="oog-row">
      <span class="oog-msg">Color is outside sRGB</span>
      <button type="button" onclick={snapToSRGB}>Snap to sRGB</button>
    </div>
  {/if}

  <footer>
    <button type="button" onclick={onclose} class="done">Done</button>
  </footer>
</div>

<style>
  .oklch-picker {
    background: var(--v2-paper, #fbf9f3);
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
    padding: 12px;
    width: 248px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: var(--v2-font-sans, -apple-system, sans-serif);
    font-size: 12px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  header strong {
    font-size: 13px;
  }
  .close {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
  }
  .field {
    position: relative;
    cursor: crosshair;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--v2-rule, #d6d0c1);
  }
  .checkerboard {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
      linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
      linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
  }
  .field-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to right,
        transparent,
        oklch(0.65 0.2 var(--hue))
      ),
      linear-gradient(to bottom,
        oklch(1 0.05 var(--hue)),
        oklch(0 0 var(--hue))
      );
  }
  .cursor {
    position: absolute;
    width: 10px;
    height: 10px;
    border: 2px solid #fff;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
  .hue-rail {
    position: relative;
    cursor: pointer;
    border-radius: 2px;
    background: linear-gradient(to right,
      oklch(0.7 0.2 0),    oklch(0.7 0.2 60),
      oklch(0.7 0.2 120),  oklch(0.7 0.2 180),
      oklch(0.7 0.2 240),  oklch(0.7 0.2 300),
      oklch(0.7 0.2 360)
    );
    border: 1px solid var(--v2-rule, #d6d0c1);
  }
  .hue-thumb {
    position: absolute;
    top: -2px;
    width: 8px;
    height: 20px;
    background: #fff;
    border: 1px solid #1a1a1a;
    border-radius: 2px;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .hex-input {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .lch-values {
    font-family: ui-monospace, monospace;
    font-size: 10.5px;
    color: var(--v2-ink-3, #8a8478);
  }
  .oog-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: #fef3c7;
    border-radius: 4px;
    font-size: 11px;
  }
  .oog-row button {
    padding: 2px 8px;
    border: 1px solid #b45309;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 10.5px;
  }
  footer {
    display: flex;
    justify-content: flex-end;
  }
  .done {
    padding: 4px 12px;
    background: var(--v2-rule-strong, #15140e);
    color: var(--v2-paper, #fff);
    border: 1px solid var(--v2-rule-strong, #15140e);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .done:hover {
    background: var(--v2-ink, #15140e);
  }
</style>

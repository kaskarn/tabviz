<!--
  Knob — unified numeric input. Replaces v1 NumberInput + SliderValue.

  Three rendering modes (auto-detected by props):

  1. PLAIN          — no min/max given. Bare numeric field, optional
                      suffix. Drag-to-scrub disabled.
  2. SCRUB          — min/max present, no `track` prop. Looks plain
                      but the value chip drag-scrubs horizontally
                      across the range. Cursor: ew-resize on hover.
  3. TRACK          — min/max + `track=true`. Renders the full slider
                      track inline with the value chip on its right.

  Bold UX:
  - Mono tabular-nums everywhere for value display
  - Drag-to-scrub gives a 22px-tall control the dynamic range of a 200px
    slider — densest possible interaction
  - Scroll-wheel adjust by step when focused (with shift = ×10)
  - Type-to-set is always available, even in track mode (the chip is
    a real input)
  - Suffix unit chip rides snug as a muted tabular suffix
  - Pinned override appears as a 3px hot dot to the left of the chip

  Wheel + drag handlers are intentionally minimal; debouncing the
  value is the parent's job if it matters.
-->
<script lang="ts">
  import { untrack } from "svelte";

  interface Props {
    value?: number | null;
    /** Optional range — enables scrub / track modes. */
    min?: number;
    max?: number;
    step?: number;
    /** Render the full slider track inline. Only meaningful with min/max. */
    track?: boolean;
    /** Integer-only mode. Suppresses decimal entry. */
    integer?: boolean;
    /** Mono suffix unit (e.g. "px", "%", "em"). */
    suffix?: string;
    placeholder?: string;
    /** Pinned-override indicator — small hot dot in gutter. */
    pinned?: boolean;
    disabled?: boolean;
    id?: string;
    /** Explicit chip width in px. Default 56 for every mode. */
    width?: number;
    /** Fires whenever the committed value changes — drag end, type+blur,
     *  Enter, or palette pick. Parents that don't use `bind:value` MUST
     *  pass this; otherwise the chip looks live but the change is lost. */
    onchange?: (next: number | null) => void;
  }

  let {
    value = $bindable(null),
    min,
    max,
    step = 1,
    track = false,
    integer = false,
    suffix,
    placeholder = "",
    pinned = false,
    disabled = false,
    id,
    width,
    onchange,
  }: Props = $props();

  // Helper — set value AND fire onchange. Called only from user-action
  // mutation sites (text commit, scrub, +/- buttons, slider drag).
  // Doing it via a $effect-watcher instead would also fire when the
  // parent reassigns `value`, causing onchange→commit→prop-update
  // feedback loops at call sites that don't `bind:` (which is most of
  // them now). The Pill primitive uses this same explicit pattern.
  function emit(next: number | null) {
    if (next === value) return;
    value = next;
    onchange?.(next);
  }

  const hasRange = $derived(min != null && max != null);
  const mode = $derived<"plain" | "scrub" | "track">(
    hasRange ? (track ? "track" : "scrub") : "plain",
  );
  const chipWidth = $derived(width ?? 56);

  // Local raw value for in-flight typing (committed on blur/Enter).
  // CRITICAL: the sync effect must NOT track `raw`. If it does, the
  // user-typed character immediately tracks the effect again, the
  // String(value)!==raw check fires, and raw gets clobbered back to
  // the prop value — typing appears to silently no-op. `untrack` reads
  // raw without registering a dependency, breaking the loop.
  let raw = $state(value == null ? "" : String(value));
  $effect(() => {
    const next = value == null ? "" : String(value);
    untrack(() => {
      if (next !== raw) raw = next;
    });
  });

  function commit(s: string) {
    if (s === "") { emit(null); return; }
    const n = integer ? parseInt(s, 10) : Number(s);
    if (!Number.isFinite(n)) return;
    emit(clamp(n));
  }
  function clamp(n: number): number {
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  }
  function snapToStep(n: number): number {
    if (!step) return n;
    const base = min ?? 0;
    const snapped = Math.round((n - base) / step) * step + base;
    return integer ? Math.round(snapped) : snapped;
  }

  // ── Scrub: pointer drag on the chip (or track) ────────────────
  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartV = 0;
  function onPointerDown(e: PointerEvent) {
    if (!hasRange || disabled) return;
    if (mode === "plain") return;
    // Only initiate scrub if user clicks the chip background, not
    // the input itself — typing must remain primary.
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT") return;
    e.preventDefault();
    dragging = true;
    dragStartX = e.clientX;
    dragStartV = value ?? min ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const span = (max as number) - (min as number);
    // 200px sweep == full range. Holding shift slows to ×0.1.
    const scale = e.shiftKey ? 2000 : 200;
    const next = dragStartV + (dx / scale) * span;
    emit(snapToStep(clamp(next)));
  }
  function onPointerUp(e: PointerEvent) {
    dragging = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* capture already released */ }
  }

  // ── Wheel adjust on chip focus ───────────────────────────────
  function onWheel(e: WheelEvent) {
    if (disabled) return;
    const cur = value ?? min ?? 0;
    const delta = (e.deltaY < 0 ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
    e.preventDefault();
    emit(snapToStep(clamp(cur + delta)));
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  }

  // Compute track-fill width for visual feedback.
  const trackPct = $derived.by(() => {
    if (!hasRange || value == null) return 0;
    const span = (max as number) - (min as number);
    if (span <= 0) return 0;
    return Math.max(0, Math.min(100, ((value - (min as number)) / span) * 100));
  });
</script>

<div
  class="knob"
  class:mode-plain={mode === "plain"}
  class:mode-scrub={mode === "scrub"}
  class:mode-track={mode === "track"}
  class:disabled
  class:dragging
>
  {#if pinned}
    <span class="pin" aria-hidden="true"></span>
  {/if}

  {#if mode === "track"}
    <button
      type="button"
      class="track"
      {disabled}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      aria-label="scrub"
    >
      <span class="track-fill" style:width="{trackPct}%"></span>
    </button>
  {/if}

  <span
    class="chip"
    style:width="{chipWidth}px"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
  >
    <input
      type="text"
      bind:value={raw}
      onblur={() => commit(raw)}
      onkeydown={onKey}
      {placeholder}
      {disabled}
      {id}
      inputmode={integer ? "numeric" : "decimal"}
      spellcheck="false"
      aria-label="value"
    />
    {#if suffix}
      <span class="suffix" aria-hidden="true">{suffix}</span>
    {/if}
  </span>
</div>

<style>
  .knob {
    display: inline-flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    height: var(--v2-control-h, 22px);
    position: relative;
  }
  .knob.disabled { opacity: 0.4; pointer-events: none; }

  /* ── Override dot in gutter ──────────────────────────── */
  .pin {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--v2-hot, #b53a1f);
    flex: none;
  }

  /* ── Track (mode-track only) ────────────────────────── */
  .track {
    appearance: none;
    border: 0;
    padding: 0;
    background: var(--v2-paper-2, #f3efe5);
    box-shadow: inset 0 0 0 1px var(--v2-rule-soft, #e6e0d1);
    border-radius: var(--v2-r-pill, 11px);
    height: 6px;
    flex: 1;
    position: relative;
    cursor: ew-resize;
    overflow: hidden;
  }
  .track:hover { box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1); }
  .track:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 2px;
  }
  .track-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--v2-active-bg, #15140e);
    transition: width var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .knob.dragging .track-fill { transition: none; }

  /* ── Chip (the value display + input) ───────────────── */
  .chip {
    display: inline-flex;
    align-items: center;
    height: var(--v2-control-h, 22px);
    padding: 0 7px;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #ffffff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    cursor: text;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .knob.mode-scrub .chip:hover { cursor: ew-resize; }
  .chip:hover {
    box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c);
  }
  .chip:focus-within {
    box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e);
    background: var(--v2-paper-edge, #fff);
  }

  .chip input {
    flex: 1;
    min-width: 0;
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    font-variant-numeric: tabular-nums;
    color: var(--v2-ink, #15140e);
    text-align: right;
    outline: none;
  }
  .chip input::placeholder {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }
  /* Kill the native spin buttons — we own the scrub/wheel UX. */
  .chip input::-webkit-outer-spin-button,
  .chip input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .chip input { -moz-appearance: textfield; appearance: textfield; }

  .suffix {
    margin-left: 3px;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
  }
</style>

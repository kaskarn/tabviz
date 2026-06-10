<script lang="ts">
  /**
   * Drag-to-resize affordance for negative-space spacing knobs (gaps,
   * paddings, row heights). Sits on a horizontal seam, shows a
   * resize cursor on hover, and pipes pointer drags into a live
   * preview + commit pair on the parent.
   *
   * THE SEAM GRAMMAR (interactivity-UX arc P2 — every resize surface in
   * the widget follows this contract):
   *   - drag        → live preview per pointermove, ONE commit on release
   *   - Escape      → CANCEL: restore the drag-start value, no commit
   *   - double-click→ reset to auto/default (when the caller passes onreset)
   *   - readout     → a live px label rides the seam while dragging/focused
   *   - keyboard    → when armed, the seam is focusable; ArrowUp/Down nudge
   *                   by 1px (Shift = 10px), committing per keypress
   *
   * The component is purely the strip — placement is the caller's
   * responsibility (position: absolute on the seam, full width). `armed`
   * (the arrange tool) makes the seam visible without hover; the resting
   * un-armed state stays invisible so readers see no chrome.
   */

  interface Props {
    /** Current value of the spacing knob (e.g. theme.spacing.footerGap). */
    value: number;
    /** Lower bound; the drag clamps below this. Defaults to 0. */
    min?: number;
    /** Upper bound; the drag clamps above this. Defaults to 400. */
    max?: number;
    /**
     * Sign that the gap *grows* when the cursor moves in: positive
     * means dragging DOWN grows the gap (e.g. headerHeight, footerGap),
     * negative means dragging UP grows it (e.g. bottomMargin where the
     * widget extends downward already, or padding above an element).
     * Defaults to +1.
     */
    direction?: 1 | -1;
    /** Live update on each pointermove. Must not record / re-measure. */
    onpreview: (value: number) => void;
    /** Final value at pointerup. Records + re-measures via setThemeField. */
    oncommit: (value: number) => void;
    /** Double-click: reset the knob to its auto/default value. Optional —
     *  seams without a meaningful default simply don't reset. */
    onreset?: () => void;
    /** Accessible name for the handle (e.g. "Resize header height"). */
    label: string;
    /**
     * Optional explicit top offset (CSS length). When omitted the
     * handle uses `top: 0` so the caller's `position: relative`
     * wrapper places it on the seam directly. When set the handle
     * lands at this Y inside its `position: relative` ancestor.
     */
    top?: string;
    /** Arrange-tool state: the seam renders visibly (faint bar) without
     *  hover and becomes keyboard-focusable. Default false. */
    armed?: boolean;
  }

  const {
    value,
    min = 0,
    max = 400,
    direction = 1,
    onpreview,
    oncommit,
    onreset,
    label,
    top,
    armed = false,
  }: Props = $props();

  let dragging = $state(false);
  let focused = $state(false);
  let startY = 0;
  let startValue = 0;
  let lastValue = $state(0);
  let activePointerId: number | null = null;
  let activeEl: HTMLElement | null = null;

  const showReadout = $derived(dragging || (armed && focused));

  // Belt-and-braces drag teardown. setPointerCapture covers the common
  // path (cursor wanders out of the strip during drag), but several
  // edge cases drop the pointerup that would normally end the gesture:
  //   - User releases over a child element with its own onpointerdown
  //     that calls stopPropagation (CSS-target shadowing).
  //   - Window loses focus (alt-tab during drag).
  //   - pointercancel fires instead of pointerup (touch interruption,
  //     stylus lift in some browsers).
  // Without cleanup, `dragging` stays true forever and the ns-resize
  // cursor "sticks" to the page. We attach window-level fallbacks
  // while dragging so any of these paths still settles the gesture.
  function endDrag(commit: boolean) {
    if (!dragging) return;
    dragging = false;
    if (activeEl && activePointerId != null) {
      try { activeEl.releasePointerCapture(activePointerId); } catch {}
    }
    activeEl = null;
    activePointerId = null;
    if (commit) {
      oncommit(lastValue);
    } else {
      // Escape = cancel: restore the drag-start value, no commit (and no
      // op-log entry — the gesture never happened).
      lastValue = startValue;
      onpreview(startValue);
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    startY = e.clientY;
    startValue = value;
    lastValue = value;
    activeEl = e.currentTarget as HTMLElement;
    activePointerId = e.pointerId;
    activeEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const next = clamp(startValue + dy * direction, min, max);
    if (next !== lastValue) {
      lastValue = next;
      onpreview(next);
    }
  }

  function handlePointerUp(_e: PointerEvent) { endDrag(true); }
  function handlePointerCancel(_e: PointerEvent) { endDrag(true); }
  function handleDblClick(e: MouseEvent) {
    if (!onreset) return;
    e.preventDefault();
    e.stopPropagation();
    onreset();
  }
  // Keyboard nudge (armed seams only — tabindex gates reachability).
  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    e.stopPropagation();
    const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowDown" ? 1 : -1) * direction;
    const next = clamp(value + step, min, max);
    if (next === value) return;
    lastValue = next;
    onpreview(next);
    oncommit(next);
  }
  // Window-level fallbacks: only attached while dragging.
  function onWindowPointerUp(_e: PointerEvent) { endDrag(true); }
  function onWindowBlur() { endDrag(true); }
  function onWindowKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      endDrag(false);
    }
  }
  $effect(() => {
    if (!dragging) return;
    window.addEventListener("pointerup", onWindowPointerUp, true);
    window.addEventListener("pointercancel", onWindowPointerUp, true);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("keydown", onWindowKey, true);
    return () => {
      window.removeEventListener("pointerup", onWindowPointerUp, true);
      window.removeEventListener("pointercancel", onWindowPointerUp, true);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("keydown", onWindowKey, true);
    };
  });

  function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
  }
</script>

<!-- A focusable role="separator" IS valid interactive ARIA (a movable
     splitter); the linter doesn't model that pattern. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="edge-resize"
  class:dragging
  class:armed
  role="separator"
  aria-orientation="horizontal"
  aria-label={label}
  aria-valuenow={dragging ? Math.round(lastValue) : Math.round(value)}
  aria-valuemin={min}
  aria-valuemax={max}
  title={label}
  tabindex={armed ? 0 : -1}
  style:top={top}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
  ondblclick={handleDblClick}
  onkeydown={armed ? handleKeydown : undefined}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
>
  {#if showReadout}
    <span class="edge-readout" aria-hidden="true">
      {label} · {Math.round(dragging ? lastValue : value)}px
    </span>
  {/if}
</div>

<style>
  .edge-resize {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    transform: translateY(-50%);
    height: 6px;
    /* The strip sits centered on the seam; visual feedback is just a
       cursor + a faint horizontal bar that fades in on hover/drag.
       Keeps the resting state invisible so non-editors don't see UI
       chrome they didn't ask for. */
    cursor: ns-resize;
    background: transparent;
    transition: background 0.12s ease;
    z-index: 5;
    /* Pointer events on the strip itself; the underlying content stays
       interactive when the cursor is outside the 6 px band. */
    touch-action: none;
    outline: none;
  }
  /* Armed (arrange tool): a roomier hit zone — the gesture is the point. */
  .edge-resize.armed {
    height: 10px;
  }

  .edge-resize::before {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    background: var(--tv-accent, #2563eb);
    opacity: 0;
    border-radius: 1px;
    transition: opacity 0.12s ease;
    pointer-events: none;
  }

  .edge-resize:hover::before,
  .edge-resize.dragging::before {
    opacity: 0.5;
  }
  /* Armed seams stay faintly visible without hover (the arrange tool's
     whole job is making every draggable seam discoverable at a glance). */
  .edge-resize.armed::before {
    opacity: 0.22;
  }
  .edge-resize.armed:hover::before,
  .edge-resize.armed.dragging::before,
  .edge-resize.armed:focus-visible::before {
    opacity: 0.6;
  }
  .edge-resize.armed:focus-visible {
    outline: none; /* the ::before bar carries focus visibility */
  }

  .edge-readout {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(calc(-50% - 12px));
    padding: 1px 6px;
    font-family: var(--tv-text-body-family, system-ui);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--tv-surface-bg, #fff);
    background: var(--tv-accent, #2563eb);
    border-radius: 3px;
    pointer-events: none;
    z-index: 6;
  }
</style>

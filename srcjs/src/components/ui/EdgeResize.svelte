<script lang="ts">
  /**
   * Drag-to-resize affordance for negative-space spacing knobs (gaps,
   * paddings, row heights). Sits on a horizontal seam, shows a
   * resize cursor on hover, and pipes pointer drags into a live
   * preview + commit pair on the parent.
   *
   * The component is purely the strip — placement is the caller's
   * responsibility (position: absolute on the seam, full width,
   * `--edge-resize-thickness` tall). Hot zone is intentionally narrow
   * (4 px) so it doesn't shadow row hover or column resize.
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
    /** Accessible name for the handle (e.g. "Resize header height"). */
    label: string;
    /**
     * Optional explicit top offset (CSS length). When omitted the
     * handle uses `top: 0` so the caller's `position: relative`
     * wrapper places it on the seam directly. When set the handle
     * lands at this Y inside its `position: relative` ancestor.
     */
    top?: string;
  }

  const {
    value,
    min = 0,
    max = 400,
    direction = 1,
    onpreview,
    oncommit,
    label,
    top,
  }: Props = $props();

  let dragging = $state(false);
  let startY = 0;
  let startValue = 0;
  let lastValue = 0;
  let activePointerId: number | null = null;
  let activeEl: HTMLElement | null = null;

  // Belt-and-braces drag teardown. setPointerCapture covers the common
  // path (cursor wanders out of the strip during drag), but several
  // edge cases drop the pointerup that would normally end the gesture:
  //   - User releases over a child element with its own onpointerdown
  //     that calls stopPropagation (CSS-target shadowing).
  //   - Window loses focus (alt-tab during drag).
  //   - pointercancel fires instead of pointerup (touch interruption,
  //     stylus lift in some browsers).
  //   - User scrolls or right-clicks during the drag (browsers may
  //     synthesize cancel rather than up).
  // Without cleanup, `dragging` stays true forever and the ns-resize
  // cursor "sticks" to the page. We attach window-level fallbacks
  // while dragging so any of these paths still settles the gesture.
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (activeEl && activePointerId != null) {
      try { activeEl.releasePointerCapture(activePointerId); } catch {}
    }
    activeEl = null;
    activePointerId = null;
    oncommit(lastValue);
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

  function handlePointerUp(_e: PointerEvent) { endDrag(); }
  function handlePointerCancel(_e: PointerEvent) { endDrag(); }
  // Window-level fallbacks: only attached while dragging.
  function onWindowPointerUp(_e: PointerEvent) { endDrag(); }
  function onWindowBlur() { endDrag(); }
  function onWindowKey(e: KeyboardEvent) {
    if (e.key === "Escape") endDrag();
  }
  $effect(() => {
    if (!dragging) return;
    window.addEventListener("pointerup", onWindowPointerUp, true);
    window.addEventListener("pointercancel", onWindowPointerUp, true);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("keydown", onWindowKey);
    return () => {
      window.removeEventListener("pointerup", onWindowPointerUp, true);
      window.removeEventListener("pointercancel", onWindowPointerUp, true);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("keydown", onWindowKey);
    };
  });

  function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="edge-resize"
  class:dragging
  role="separator"
  aria-orientation="horizontal"
  aria-label={label}
  aria-valuenow={value}
  aria-valuemin={min}
  aria-valuemax={max}
  title={label}
  style:top={top}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
></div>

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
</style>

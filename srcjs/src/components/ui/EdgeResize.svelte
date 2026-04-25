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

  let {
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

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    startY = e.clientY;
    startValue = value;
    lastValue = value;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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

  function handlePointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    oncommit(lastValue);
  }

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
    background: var(--wf-primary, #2563eb);
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

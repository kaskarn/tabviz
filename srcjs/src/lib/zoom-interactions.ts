// Svelte action providing wheel zoom + drag pan + double-click reset for a
// viz column's x-axis. The action is deliberately scale-agnostic: callers
// supply `getDomain` / `getPixelRange` / `onChange` / `onReset` and whether
// the axis is log-scaled. The action does not itself talk to the store — the
// caller decides how the new domain is applied.

// Pixel anchor → domain value, honoring linear vs log space.
function pixelToDomain(
  px: number,
  pixelStart: number,
  pixelEnd: number,
  domain: [number, number],
  isLog: boolean,
): number {
  const pixelSpan = pixelEnd - pixelStart;
  if (pixelSpan <= 0) return domain[0];
  const frac = (px - pixelStart) / pixelSpan;
  if (isLog) {
    const lo = Math.log(Math.max(domain[0], 1e-9));
    const hi = Math.log(Math.max(domain[1], 1e-9));
    return Math.exp(lo + frac * (hi - lo));
  }
  return domain[0] + frac * (domain[1] - domain[0]);
}

function zoomAroundAnchor(
  domain: [number, number],
  anchor: number,
  factor: number,
  isLog: boolean,
): [number, number] {
  // factor > 1 zooms in (shrinks domain), factor < 1 zooms out.
  if (isLog) {
    const lo = Math.log(Math.max(domain[0], 1e-9));
    const hi = Math.log(Math.max(domain[1], 1e-9));
    const a = Math.log(Math.max(anchor, 1e-9));
    const newLo = a - (a - lo) / factor;
    const newHi = a + (hi - a) / factor;
    return [Math.exp(newLo), Math.exp(newHi)];
  }
  const newLo = anchor - (anchor - domain[0]) / factor;
  const newHi = anchor + (domain[1] - anchor) / factor;
  return [newLo, newHi];
}

function panByPixels(
  domain: [number, number],
  pixelDx: number,
  pixelSpan: number,
  isLog: boolean,
): [number, number] {
  if (pixelSpan <= 0) return domain;
  const frac = pixelDx / pixelSpan;
  if (isLog) {
    const lo = Math.log(Math.max(domain[0], 1e-9));
    const hi = Math.log(Math.max(domain[1], 1e-9));
    const shift = frac * (hi - lo);
    return [Math.exp(lo - shift), Math.exp(hi - shift)];
  }
  const shift = frac * (domain[1] - domain[0]);
  return [domain[0] - shift, domain[1] - shift];
}

export interface ZoomableParams {
  // Identifier (kept in params mainly for debugging; the action itself is stateless)
  columnId: string;
  isLog: boolean;
  // Current effective domain (may be an override or the default).
  getDomain: () => [number, number];
  // Node-local pixel range spanned by the axis. For a cell containing the
  // whole viz, this is usually [0, node.clientWidth].
  getPixelRange: () => [number, number];
  onChange: (domain: [number, number]) => void;
  onReset: () => void;
  enabled?: boolean;
}

const WHEEL_FACTOR_PER_PIXEL = 1 / 300; // ~ 1.2× per 60px of wheel delta

// A pointerdown/up that travels less than this many pixels is treated as a
// click, not a drag — the click is forwarded through the overlay to whatever
// is under the cursor (the `.plot-cell`) so the always-on painter can commit
// on viz cells. Anything past the threshold counts as a pan and the click is
// suppressed.
const CLICK_DRAG_THRESHOLD_PX = 3;

export function zoomable(node: HTMLElement, initial: ZoomableParams) {
  let params = initial;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let dragStartDomain: [number, number] | null = null;
  let dragPointerId: number | null = null;
  let dragMoved = false;

  function nodeLocalX(clientX: number): number {
    return clientX - node.getBoundingClientRect().left;
  }

  // Click-vs-drag passthrough: when pointerup fires with no meaningful
  // movement, locate the first element under the cursor that's NOT the
  // overlay (or a descendant) and dispatch a click on it. This restores
  // the always-on painter's "click anywhere paints the row" promise on
  // forest / viz_bar / viz_boxplot / viz_violin cells while preserving
  // wheel/drag pan + dblclick reset on those same overlays.
  function forwardClickThrough(clientX: number, clientY: number) {
    if (typeof document === "undefined") return;
    const stack = document.elementsFromPoint(clientX, clientY);
    const target = stack.find(el => el !== node && !node.contains(el));
    if (target instanceof HTMLElement) {
      target.click();
    }
  }

  function onWheel(e: WheelEvent) {
    if (!params.enabled) return;
    // Avoid hijacking vertical page scroll unless the user is inside the viz
    // area and the gesture is mostly vertical wheel input. Always prevent
    // default so wheel-zoom doesn't double as a scroll.
    e.preventDefault();
    const [rangeStart, rangeEnd] = params.getPixelRange();
    const domain = params.getDomain();
    const anchor = pixelToDomain(nodeLocalX(e.clientX), rangeStart, rangeEnd, domain, params.isLog);
    const factor = Math.exp(-e.deltaY * WHEEL_FACTOR_PER_PIXEL);
    const next = zoomAroundAnchor(domain, anchor, factor, params.isLog);
    if (!Number.isFinite(next[0]) || !Number.isFinite(next[1]) || next[0] >= next[1]) return;
    if (params.isLog && next[0] <= 0) return;
    params.onChange(next);
  }

  function onPointerDown(e: PointerEvent) {
    if (!params.enabled) return;
    // Only left-button drags pan. Leave middle/right for context menus etc.
    if (e.button !== 0) return;
    // Ignore drags that start on an interactive control (resize handles,
    // buttons, links) so we don't fight existing affordances.
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-zoom-ignore], button, a, input, [role='button']")) return;
    dragStartClientX = e.clientX;
    dragStartClientY = e.clientY;
    dragStartDomain = params.getDomain();
    dragPointerId = e.pointerId;
    dragMoved = false;
    try {
      node.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can throw if the node isn't focusable — ignore.
    }
    node.style.cursor = "grabbing";
  }

  function onPointerMove(e: PointerEvent) {
    if (dragStartDomain == null || dragPointerId !== e.pointerId) return;
    const dx = e.clientX - dragStartClientX;
    const dy = e.clientY - dragStartClientY;
    if (!dragMoved && Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) {
      dragMoved = true;
    }
    if (!dragMoved) return;
    const [rangeStart, rangeEnd] = params.getPixelRange();
    const pixelSpan = rangeEnd - rangeStart;
    const next = panByPixels(dragStartDomain, dx, pixelSpan, params.isLog);
    if (!Number.isFinite(next[0]) || !Number.isFinite(next[1]) || next[0] >= next[1]) return;
    if (params.isLog && next[0] <= 0) return;
    params.onChange(next);
  }

  function endDrag(e: PointerEvent) {
    if (dragPointerId !== e.pointerId) return;
    const wasClick = !dragMoved;
    const upX = e.clientX;
    const upY = e.clientY;
    dragStartDomain = null;
    dragPointerId = null;
    dragMoved = false;
    try {
      node.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    node.style.cursor = "";
    if (wasClick) forwardClickThrough(upX, upY);
  }

  function onDblClick(e: MouseEvent) {
    if (!params.enabled) return;
    e.preventDefault();
    params.onReset();
  }

  node.addEventListener("wheel", onWheel, { passive: false });
  node.addEventListener("pointerdown", onPointerDown);
  node.addEventListener("pointermove", onPointerMove);
  node.addEventListener("pointerup", endDrag);
  node.addEventListener("pointercancel", endDrag);
  node.addEventListener("dblclick", onDblClick);

  return {
    update(next: ZoomableParams) {
      params = next;
    },
    destroy() {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", endDrag);
      node.removeEventListener("pointercancel", endDrag);
      node.removeEventListener("dblclick", onDblClick);
    },
  };
}

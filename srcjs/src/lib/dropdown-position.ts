/**
 * Dropdown positioning utility for viewport-aware placement
 *
 * Uses fixed positioning relative to the viewport to escape
 * clipping containers with overflow:hidden.
 */

export interface DropdownPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  maxHeight?: number;
}

export interface PositionOptions {
  /** Gap between trigger and dropdown (default: 4) */
  gap?: number;
  /** Minimum space to keep from viewport edge (default: 8) */
  viewportPadding?: number;
  /** Preferred position - will use opposite if not enough space */
  preferredPosition?: 'below' | 'above';
  /** Alignment relative to trigger */
  align?: 'start' | 'end';
}

/**
 * Calculate optimal dropdown position based on trigger element and viewport.
 * Returns absolute pixel positions relative to viewport (for position: fixed).
 */
export function calculateDropdownPosition(
  triggerRect: DOMRect,
  dropdownSize: { width: number; height: number },
  options: PositionOptions = {}
): DropdownPosition {
  const {
    gap = 4,
    viewportPadding = 8,
    preferredPosition = 'below',
    align = 'end'
  } = options;

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Calculate available space above and below
  const spaceBelow = viewportHeight - triggerRect.bottom - gap - viewportPadding;
  const spaceAbove = triggerRect.top - gap - viewportPadding;

  // Determine vertical position
  let position: 'below' | 'above';
  let maxHeight: number | undefined;

  if (preferredPosition === 'below') {
    if (spaceBelow >= dropdownSize.height) {
      position = 'below';
    } else if (spaceAbove >= dropdownSize.height) {
      position = 'above';
    } else {
      // Not enough space either way - use the one with more space
      position = spaceBelow >= spaceAbove ? 'below' : 'above';
      maxHeight = Math.max(position === 'below' ? spaceBelow : spaceAbove, 100);
    }
  } else {
    if (spaceAbove >= dropdownSize.height) {
      position = 'above';
    } else if (spaceBelow >= dropdownSize.height) {
      position = 'below';
    } else {
      position = spaceAbove >= spaceBelow ? 'above' : 'below';
      maxHeight = Math.max(position === 'above' ? spaceAbove : spaceBelow, 100);
    }
  }

  // Calculate result with fixed positioning coordinates
  const result: DropdownPosition = {};

  // Vertical position
  if (position === 'below') {
    result.top = triggerRect.bottom + gap;
  } else {
    result.bottom = viewportHeight - triggerRect.top + gap;
  }

  // Horizontal position
  if (align === 'end') {
    // Align right edge of dropdown with right edge of trigger
    const rightEdge = triggerRect.right;
    const leftEdge = rightEdge - dropdownSize.width;

    if (leftEdge < viewportPadding) {
      // Would overflow left - align to left edge of trigger instead
      result.left = Math.max(triggerRect.left, viewportPadding);
    } else {
      result.right = viewportWidth - triggerRect.right;
    }
  } else {
    // Align left edge
    const leftEdge = triggerRect.left;
    const rightEdge = leftEdge + dropdownSize.width;

    if (rightEdge > viewportWidth - viewportPadding) {
      // Would overflow right - align to right edge of trigger instead
      result.right = Math.max(viewportWidth - triggerRect.right, viewportPadding);
    } else {
      result.left = triggerRect.left;
    }
  }

  if (maxHeight) {
    result.maxHeight = maxHeight;
  }

  return result;
}

/**
 * Compute a viewport-clamp adjustment for an already-positioned rect.
 * Returns the style overrides needed to keep the rect inside the
 * viewport by `padding` on each side; empty object if the rect is
 * already in-bounds.
 *
 * Pure function — extracted so the second-pass safety net in
 * `autoPosition` is unit-testable without a DOM (GH #5).
 *
 * Style overrides use the same axis-pair contract as
 * `calculateDropdownPosition`: setting `left` clears `right` on that
 * axis (and vice versa); same for top/bottom.
 */
export interface ClampOverride {
  top?: number | "";
  bottom?: number | "";
  left?: number | "";
  right?: number | "";
}

export function computeViewportClamp(
  rect: { left: number; right: number; top: number; bottom: number; width: number; height: number },
  viewport: { width: number; height: number },
  padding: number = 8,
): ClampOverride {
  const out: ClampOverride = {};

  // Horizontal axis.
  if (rect.right > viewport.width - padding) {
    out.right = "";
    out.left = Math.max(padding, viewport.width - rect.width - padding);
  } else if (rect.left < padding) {
    out.left = "";
    out.right = Math.max(padding, viewport.width - rect.width - padding);
  }

  // Vertical axis.
  if (rect.bottom > viewport.height - padding) {
    out.bottom = "";
    out.top = Math.max(padding, viewport.height - rect.height - padding);
  } else if (rect.top < padding) {
    out.top = "";
    out.bottom = Math.max(padding, viewport.height - rect.height - padding);
  }

  return out;
}

/**
 * Svelte action for auto-positioning dropdowns using fixed positioning.
 * Repositions on scroll/resize so the popover tracks its trigger.
 *
 * **Keep the ancestor chain clean.** `position: fixed` anchors to the nearest
 * ancestor with `transform`, `filter`, `backdrop-filter`, `perspective`,
 * `will-change: transform/filter/perspective`, or `contain: paint/layout/strict/content` —
 * any of those break viewport-relative placement. The toolbar's previous
 * `backdrop-filter: blur()` and `transform: translateY()` both triggered this
 * and had to be removed. Portaling to `document.body` was tried and fought
 * Svelte's teardown (the moved node was no longer in the if-block's tracked
 * children, so action destroy didn't fire reliably); the simpler and more
 * robust fix is to keep the ancestor chain containing-block-free.
 *
 * Usage:
 *   <div class="dropdown" use:autoPosition={{ triggerEl }}>
 */
export function autoPosition(
  node: HTMLElement,
  params: { triggerEl: HTMLElement | null; gap?: number; align?: 'start' | 'end' }
) {

  /**
   * Clamp the dropdown's final on-screen rect inside the viewport.
   * Runs after the first-pass placement applies — re-measures the actual
   * rendered rect and nudges left/right/top/bottom inward if any edge
   * pokes past viewport - padding.
   *
   * The first-pass math (`calculateDropdownPosition`) handles the common
   * cases (trigger near right edge → flip to left-align, etc.), but it
   * relies on the pre-position `dropdownRect` measurement and on the
   * assumption that the ancestor chain is containing-block-free. In a
   * few edge cases — fullscreen-modal containing block leaking through
   * to a `position: fixed` descendant, late-loading webfonts shifting
   * the dropdown's intrinsic width, container CSS forcing a narrower
   * width than measured — the dropdown can still overflow. This clamp
   * is the safety net that makes the popover ALWAYS visible regardless
   * of which path failed (GH #5).
   */
  function clampToViewport(): void {
    const rect = node.getBoundingClientRect();
    const override = computeViewportClamp(
      rect,
      { width: window.innerWidth, height: window.innerHeight },
    );
    if (override.top !== undefined) node.style.top = override.top === "" ? "" : `${override.top}px`;
    if (override.bottom !== undefined) node.style.bottom = override.bottom === "" ? "" : `${override.bottom}px`;
    if (override.left !== undefined) node.style.left = override.left === "" ? "" : `${override.left}px`;
    if (override.right !== undefined) node.style.right = override.right === "" ? "" : `${override.right}px`;
  }

  function applyPosition() {
    if (!params.triggerEl) return;

    const triggerRect = params.triggerEl.getBoundingClientRect();
    const dropdownRect = node.getBoundingClientRect();

    const position = calculateDropdownPosition(
      triggerRect,
      { width: dropdownRect.width, height: dropdownRect.height },
      { gap: params.gap ?? 4, align: params.align ?? 'end' }
    );

    node.style.position = 'fixed';

    // Reset previous coords before applying new ones.
    node.style.top = '';
    node.style.bottom = '';
    node.style.left = '';
    node.style.right = '';

    if (position.top !== undefined) node.style.top = `${position.top}px`;
    if (position.bottom !== undefined) node.style.bottom = `${position.bottom}px`;
    if (position.left !== undefined) node.style.left = `${position.left}px`;
    if (position.right !== undefined) node.style.right = `${position.right}px`;

    if (position.maxHeight) {
      node.style.maxHeight = `${position.maxHeight}px`;
      node.style.overflowY = 'auto';
    } else {
      node.style.maxHeight = '';
      node.style.overflowY = '';
    }

    // Second-pass clamp. Schedule via rAF so the browser has applied the
    // first-pass styles before we re-measure the rendered rect.
    requestAnimationFrame(clampToViewport);
  }

  // rAF-batch reposition requests so scroll/resize bursts are cheap.
  let rafId: number | null = null;
  function schedulePosition() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      applyPosition();
    });
  }

  function update(newParams: typeof params) {
    params = newParams;
    schedulePosition();
  }

  // Initial placement + live tracking.
  update(params);
  window.addEventListener('scroll', schedulePosition, true); // capture-phase to catch nested scrollers
  window.addEventListener('resize', schedulePosition);

  return {
    update,
    destroy() {
      window.removeEventListener('scroll', schedulePosition, true);
      window.removeEventListener('resize', schedulePosition);
      if (rafId !== null) cancelAnimationFrame(rafId);
    }
  };
}

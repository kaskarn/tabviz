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
 * Svelte action for auto-positioning dropdowns using fixed positioning.
 * This escapes clipping containers by using position:fixed.
 *
 * Usage:
 * <div class="dropdown" use:autoPosition={{ triggerEl }}>
 */
export function autoPosition(
  node: HTMLElement,
  params: { triggerEl: HTMLElement | null; gap?: number; align?: 'start' | 'end' }
) {
  function applyPosition() {
    if (!params.triggerEl) return;

    const triggerRect = params.triggerEl.getBoundingClientRect();
    const dropdownRect = node.getBoundingClientRect();

    const position = calculateDropdownPosition(
      triggerRect,
      { width: dropdownRect.width, height: dropdownRect.height },
      { gap: params.gap ?? 4, align: params.align ?? 'end' }
    );

    // Use fixed positioning to escape clipping containers
    node.style.position = 'fixed';

    // Clear all position properties first
    node.style.top = '';
    node.style.bottom = '';
    node.style.left = '';
    node.style.right = '';

    // Apply calculated positions
    if (position.top !== undefined) {
      node.style.top = `${position.top}px`;
    }
    if (position.bottom !== undefined) {
      node.style.bottom = `${position.bottom}px`;
    }
    if (position.left !== undefined) {
      node.style.left = `${position.left}px`;
    }
    if (position.right !== undefined) {
      node.style.right = `${position.right}px`;
    }

    if (position.maxHeight) {
      node.style.maxHeight = `${position.maxHeight}px`;
      node.style.overflowY = 'auto';
    } else {
      node.style.maxHeight = '';
      node.style.overflowY = '';
    }
  }

  function update(newParams: typeof params) {
    params = newParams;
    // Use requestAnimationFrame to ensure dropdown has been laid out
    requestAnimationFrame(applyPosition);
  }

  // Initial position
  update(params);

  return {
    update,
    destroy() {
      // Cleanup if needed
    }
  };
}

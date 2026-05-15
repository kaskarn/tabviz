import { expect, test, describe } from "bun:test";
import { computeViewportClamp } from "./dropdown-position";

// Helper: construct a rect-shaped object with derived right/bottom
// from a top-left + dimensions. Mirrors what getBoundingClientRect()
// returns at runtime.
function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

describe("computeViewportClamp (GH #5 safety net)", () => {
  const vp = { width: 1920, height: 1080 };

  test("in-bounds rect returns empty override", () => {
    // Centered, well within the viewport.
    const r = rect(800, 400, 200, 100);
    expect(computeViewportClamp(r, vp)).toEqual({});
  });

  test("overflows right edge → switches to left-anchored coord", () => {
    // Right edge at 1930 > viewport.width - padding (1912).
    const r = rect(1730, 400, 200, 100);
    const out = computeViewportClamp(r, vp);
    expect(out.right).toBe("");
    expect(out.left).toBe(1920 - 200 - 8); // 1712 — flush against the right padding
  });

  test("overflows left edge → switches to right-anchored coord", () => {
    const r = rect(-10, 400, 200, 100);
    const out = computeViewportClamp(r, vp);
    expect(out.left).toBe("");
    expect(out.right).toBe(1920 - 200 - 8);
  });

  test("overflows bottom edge → switches to top-anchored coord", () => {
    // Rect bottom at 1100 > viewport.height - padding (1072).
    const r = rect(800, 1000, 200, 100);
    const out = computeViewportClamp(r, vp);
    expect(out.bottom).toBe("");
    expect(out.top).toBe(1080 - 100 - 8); // 972
  });

  test("overflows top edge → switches to bottom-anchored coord", () => {
    const r = rect(800, -10, 200, 100);
    const out = computeViewportClamp(r, vp);
    expect(out.top).toBe("");
    expect(out.bottom).toBe(1080 - 100 - 8);
  });

  test("overflows both right + bottom → clamps both axes", () => {
    const r = rect(1730, 1000, 200, 100);
    const out = computeViewportClamp(r, vp);
    expect(out.right).toBe("");
    expect(out.left).toBe(1712);
    expect(out.bottom).toBe("");
    expect(out.top).toBe(972);
  });

  test("rect wider than viewport stays at padding (degenerate)", () => {
    const r = rect(0, 400, 2400, 100);
    const out = computeViewportClamp(r, vp);
    // right edge (2400) > 1912 → triggers right-overflow branch
    // → computed left = max(8, 1920 - 2400 - 8) = max(8, -488) = 8
    expect(out.right).toBe("");
    expect(out.left).toBe(8);
  });

  test("rect just touching viewport-pad boundary is in-bounds", () => {
    // right edge exactly at viewport.width - padding (= 1912).
    const r = rect(1712, 8, 200, 1064);
    expect(computeViewportClamp(r, vp)).toEqual({});
  });

  test("custom padding is honored", () => {
    // viewport.width = 1000, padding = 20. A rect at right=985 overflows
    // because 985 > 1000 - 20 = 980.
    const r = rect(785, 400, 200, 100);
    const out = computeViewportClamp(r, { width: 1000, height: 1080 }, 20);
    expect(out.right).toBe("");
    expect(out.left).toBe(1000 - 200 - 20); // 780
  });
});

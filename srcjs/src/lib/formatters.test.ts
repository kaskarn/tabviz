import { expect, test, it, describe } from "bun:test";
import { formatNumber, formatPvalue, truncateString, formatInterval, abbreviateNumber } from "./formatters";

describe("formatPvalue — non-positive guard (regression)", () => {
  it("p = 0 (underflow) renders the <threshold floor, NOT NaN×10⁻ᴵⁿᶠⁱⁿⁱᵗʸ", () => {
    expect(formatPvalue(0)).toBe("<0.001");
    expect(formatPvalue(0)).not.toContain("NaN");
  });
  it("negative p is invalid → naText", () => {
    expect(formatPvalue(-0.5, { naText: "—" } as never)).toBe("—");
    expect(formatPvalue(-0.5)).toBe("");
  });
  it("legitimate small p still uses scientific notation", () => {
    expect(formatPvalue(0.0001)).toContain("×10");
  });
});

describe("truncateString — code-point safety (regression)", () => {
  it("does not split an astral char mid-surrogate", () => {
    // 3 emoji = 3 code points (6 UTF-16 units); truncate to 2 → "👩‍?" must not
    // emit a lone surrogate. Use distinct astral chars to avoid ZWJ subtleties.
    const out = truncateString("🍎🍊🍋", 2);
    expect(out).toBe("🍎…");
    expect(out).not.toContain("�");
  });
});

describe("formatNumber — prefix/suffix + abbreviate (regression for col_currency)", () => {
  test("abbreviate with currency prefix preserves the prefix", () => {
    // The bug: prior to this regression test, the abbreviate branch
    // returned early before applying prefix/suffix, so
    // col_currency(abbreviate = TRUE) emitted "75.5K" instead of "$75.5K".
    const out = formatNumber(75500, {
      numeric: { abbreviate: true, prefix: "$", thousandsSep: "," },
    });
    expect(out).toBe("$75.5K");
  });

  test("abbreviate with currency suffix preserves the suffix", () => {
    const out = formatNumber(2_400_000, {
      numeric: { abbreviate: true, suffix: " USD" },
    });
    expect(out).toBe("2.4M USD");
  });

  test("abbreviate below threshold falls through to decimals + prefix", () => {
    const out = formatNumber(123, {
      numeric: { abbreviate: true, prefix: "$", decimals: 2 },
    });
    expect(out).toBe("$123.00");
  });

  test("non-abbreviate path still applies prefix", () => {
    const out = formatNumber(75500, {
      numeric: { prefix: "$", decimals: 0, thousandsSep: "," },
    });
    expect(out).toBe("$75,500");
  });

  test("digits path applies prefix", () => {
    const out = formatNumber(75500, {
      numeric: { digits: 3, prefix: "$" },
    });
    // toPrecision(3) of 75500 = "7.55e+4"; with no thousandsSep that's
    // what we'd get. Prefix still applies.
    expect(out.startsWith("$")).toBe(true);
  });
});

describe("formatNumber — R2 review fixes", () => {
  it("hoists the sign outside a currency prefix (-$ not $-)", () => {
    const out = formatNumber(-45000.5, {
      numeric: { prefix: "$", decimals: 2, thousandsSep: "," },
    } as never);
    expect(out).toBe("-$45,000.50");
  });

  it("never renders negative zero", () => {
    const out = formatNumber(-0.001, { numeric: { decimals: 2 } } as never);
    expect(out).toBe("0.00");
  });

  it("thousandsSep: true coerces to comma", () => {
    const out = formatNumber(1234567, {
      numeric: { decimals: 0, thousandsSep: true },
    } as never);
    expect(out).toBe("1,234,567");
  });
});

// formatInterval is THE forest-plot cell formatter (point + CI), painted on
// every forest table — yet it was wholly untested. These goldens pin its
// behavior across the variant-recipe matrix so a recipe/primitive refactor
// can't silently change the user-visible string. Captured 2026-06-17.
describe("formatInterval — golden coverage (the core forest CI cell)", () => {
  const o = (interval: object, rest: object = {}) => ({ interval, ...rest }) as never;
  it("default recipe: point (lower, comma upper)", () => {
    expect(formatInterval(1.5, 0.8, 2.3, o({}))).toBe("1.50 (0.80, 2.30)");
  });
  it("no options resolves the same default recipe", () => {
    expect(formatInterval(1.5, 0.8, 2.3)).toBe("1.50 (0.80, 2.30)");
  });
  it("decimals primitive flows through to point AND bounds", () => {
    expect(formatInterval(1.5, 0.8, 2.34, o({ decimals: 1 }))).toBe("1.5 (0.8, 2.3)");
  });
  it("author primitives override delimiter + separator", () => {
    expect(formatInterval(1.5, 0.8, 2.3, o({ boundsOpen: "[", boundsClose: "]", boundsSeparator: " to " })))
      .toBe("1.50 [0.80 to 2.30]");
  });
  it("half_width content renders the ± half-interval, not the range", () => {
    // (2.3 − 0.8) / 2 = 0.75
    expect(formatInterval(1.5, 0.8, 2.3, o({ boundsContent: "half_width", decimals: 2 }))).toBe("1.50 (0.75)");
  });
  it("missing point → naText", () => {
    expect(formatInterval(undefined, 0.8, 2.3, o({}, { naText: "N/A" }))).toBe("N/A");
  });
  it("missing bounds → point only (no empty parens)", () => {
    expect(formatInterval(1.5, undefined, undefined, o({ decimals: 2 }))).toBe("1.50");
  });
  it("imprecise estimate (CI ratio > threshold) collapses to em-dash", () => {
    // upper/lower = 9.0/0.1 = 90 > 2
    expect(formatInterval(1.5, 0.1, 9.0, o({ impreciseThreshold: 2 }))).toBe("—");
  });
});

// Non-finite guard (regression, 2026-06-17): undefined/null/NaN were guarded
// but ±Infinity slipped through to .toFixed()/range formatting, rendering the
// raw JS "Infinity" string into a cell. !Number.isFinite folds both in.
describe("formatters — non-finite guard (regression)", () => {
  it("formatNumber: ±Infinity → naText, not the 'Infinity' string", () => {
    expect(formatNumber(Infinity, { numeric: { decimals: 2 } } as never)).toBe("");
    expect(formatNumber(-Infinity, { naText: "—" } as never)).toBe("—");
    // NaN + finite behavior unchanged
    expect(formatNumber(NaN as never)).toBe("");
    expect(formatNumber(1.5, { numeric: { decimals: 2 } } as never)).toBe("1.50");
  });
  it("formatPvalue: Infinity → naText (matches the non-positive guard's intent)", () => {
    expect(formatPvalue(Infinity)).toBe("");
    expect(formatPvalue(0.05)).toBe("0.050"); // finite unchanged
  });
  it("formatInterval: a non-finite bound falls back to point-only", () => {
    expect(formatInterval(1.5, 0.8, Infinity, { interval: { decimals: 2 } } as never)).toBe("1.50");
    expect(formatInterval(1.5, Infinity, 2.3, { interval: { decimals: 2 } } as never)).toBe("1.50");
  });
});

// abbreviateNumber suffixes large COUNTS (K/M/B). The sub-1000 path rounds to
// an INTEGER by design (it targets counts, where 950→"950" is right) — pinned
// here so the edge is explicit: a fractional value like 0.5→"1" is intended,
// NOT a bug, and a future change to support fractional abbreviation must
// consciously re-bless these. Captured 2026-06-17.
describe("abbreviateNumber — golden coverage (count abbreviation, integer sub-1000)", () => {
  it("sub-1000 returns the rounded integer (the count-oriented design)", () => {
    expect(abbreviateNumber(950)).toBe("950");
    expect(abbreviateNumber(42)).toBe("42");
    expect(abbreviateNumber(0.5)).toBe("1"); // INTENTIONAL: rounds, not "0.5"
  });
  it("K/M/B suffixes with at-most-1 decimal, no trailing zeros", () => {
    expect(abbreviateNumber(1200)).toBe("1.2K");
    expect(abbreviateNumber(1_500_000)).toBe("1.5M");
    expect(abbreviateNumber(3_400_000_000)).toBe("3.4B");
  });
  it("negative values keep the sign", () => {
    expect(abbreviateNumber(-1200)).toBe("-1.2K");
  });
  it("≥ 1 trillion throws (out of suffix range)", () => {
    expect(() => abbreviateNumber(1e12)).toThrow();
  });
});

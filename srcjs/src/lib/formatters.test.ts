import { expect, test, it, describe } from "bun:test";
import { formatNumber, formatPvalue, truncateString } from "./formatters";

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

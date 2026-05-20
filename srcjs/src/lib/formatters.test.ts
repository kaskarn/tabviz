import { expect, test, describe } from "bun:test";
import { formatNumber } from "./formatters";

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

// End-to-end: a theme's column_defaults reach the built columns via tabviz().

import { describe, it, expect } from "bun:test";
import { tabviz } from "./tabviz";
import { colPvalue } from "./columns";
import { buildTheme } from "../lib/theme/theme-adapter";
import { NEJM } from "../lib/theme/theme-presets-inputs";

const pvalueOpts = (spec: ReturnType<typeof tabviz>) => {
  const col = spec.columns.find((c) => (c as { type?: string }).type === "pvalue") as
    | { options?: { pvalue?: Record<string, unknown> } }
    | undefined;
  return col?.options?.pvalue ?? {};
};

describe("theme.column_defaults flows through tabviz()", () => {
  it("a clinical theme defaults p-value columns to stars + pill (the maintainer's example)", () => {
    const theme = buildTheme(
      { ...NEJM, column_defaults: { pvalue: { stars: true, significantStyle: "pill" } } },
      "clinical-test",
    );
    const spec = tabviz({
      data: [{ study: "A", p: 0.001 }],
      label: "study",
      columns: [colPvalue({ field: "p" })],
      theme,
    });
    expect(pvalueOpts(spec).stars).toBe(true);
    expect(pvalueOpts(spec).significantStyle).toBe("pill");
  });

  it("the AUTHOR'S non-default option wins over the theme default", () => {
    // starsColor default is "accent"; the author deviated to "none".
    const theme = buildTheme(
      { ...NEJM, column_defaults: { pvalue: { starsColor: "negative" } } },
      "clinical-test",
    );
    const spec = tabviz({
      data: [{ study: "A", p: 0.001 }],
      label: "study",
      columns: [colPvalue({ field: "p", starsColor: "none" })],
      theme,
    });
    expect(pvalueOpts(spec).starsColor).toBe("none");
  });

  it("a CORE option in column_defaults is dropped (theme can't change precision)", () => {
    const theme = buildTheme(
      { ...NEJM, column_defaults: { pvalue: { digits: 5, stars: true } } },
      "clinical-test",
    );
    const spec = tabviz({
      data: [{ study: "A", p: 0.001 }],
      label: "study",
      columns: [colPvalue({ field: "p" })],
      theme,
    });
    expect(pvalueOpts(spec).digits).toBe(2); // theme's core `digits: 5` was DROPPED; builder default stays
    expect(pvalueOpts(spec).stars).toBe(true); // styling default still applies
  });
});

import { describe, test, expect } from "bun:test";
import { condition, evaluateConditions } from "./conditions";

const fakeData = {
  rows: [
    { id: "r1", metadata: { p: 0.01,  hr: 0.65 } },
    { id: "r2", metadata: { p: 0.20,  hr: 1.10 } },
    { id: "r3", metadata: { p: 0.001, hr: 0.45 } },
    { id: "r4", metadata: { p: 0.06,  hr: 0.92 } },
  ],
};

describe("condition()", () => {
  test("evaluates rule against each row's metadata", () => {
    const c = condition(
      { name: "significant", rule: (r) => Number(r.p) < 0.05 },
      fakeData,
    );
    expect(c.id).toBe("significant");
    expect(c.kind).toBe("boolean");
    expect(c.values).toEqual([true, false, true, false]);
  });

  test("rule receives the rows array for whole-table-aware logic", () => {
    const c = condition(
      {
        name: "bonferroni_sig",
        rule: (r, rows) => Number(r.p) < 0.05 / rows.length,
      },
      fakeData,
    );
    // 0.05 / 4 = 0.0125; only p < 0.0125 passes
    expect(c.values).toEqual([true, false, true, false]);
  });

  test("rule that throws yields false", () => {
    const c = condition(
      {
        name: "broken",
        rule: () => {
          throw new Error("boom");
        },
      },
      fakeData,
    );
    expect(c.values).toEqual([false, false, false, false]);
  });

  test("label defaults to name; explicit label preserved", () => {
    const c1 = condition({ name: "x", rule: () => true }, fakeData);
    expect(c1.label).toBe("x");
    const c2 = condition(
      { name: "x", label: "Custom", rule: () => true },
      fakeData,
    );
    expect(c2.label).toBe("Custom");
  });

  test("category passes through", () => {
    const c = condition(
      { name: "x", rule: () => true, category: "statistical" },
      fakeData,
    );
    expect(c.category).toBe("statistical");
  });

  test("ruleText defaults to rule.toString(); explicit override", () => {
    const rule = (r: Record<string, unknown>) => Number(r.p) < 0.05;
    const c1 = condition({ name: "sig", rule }, fakeData);
    expect(c1.ruleText).toContain("p");
    const c2 = condition(
      { name: "sig", rule, ruleText: "p < α" },
      fakeData,
    );
    expect(c2.ruleText).toBe("p < α");
  });

  test("empty data yields empty values vector", () => {
    const c = condition(
      { name: "x", rule: () => true },
      { rows: [] },
    );
    expect(c.values).toEqual([]);
  });
});

describe("evaluateConditions()", () => {
  test("materializes a list of authored conditions", () => {
    const list = evaluateConditions(
      [
        { name: "sig", rule: (r) => Number(r.p) < 0.05 },
        { name: "low_hr", rule: (r) => Number(r.hr) < 1 },
      ],
      fakeData,
    );
    expect(list).toHaveLength(2);
    expect(list[0].values).toEqual([true, false, true, false]);
    expect(list[1].values).toEqual([true, false, true, true]);
  });

  test("empty list returns empty array", () => {
    expect(evaluateConditions([], fakeData)).toEqual([]);
  });
});

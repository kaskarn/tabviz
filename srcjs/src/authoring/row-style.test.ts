// Row-level style mapping in TS authoring (mirrors R's `row_*` args): the
// per-row value of the named field is extracted into each row's `style`.

import { describe, test, expect } from "bun:test";
import { tabviz } from "./tabviz";
import { colText } from "./columns";

const data = [
  { study: "A", sig: true, status: "up" },
  { study: "B", sig: false, status: "down" },
  { study: "C", sig: true, status: "up" },
];
const mk = (extra: Record<string, unknown>) =>
  tabviz({ data, label: "study", columns: [colText({ field: "study" })], ...extra });

describe("tabviz row-level style mapping", () => {
  test("boolean field → per-row bold; string field → per-row color", () => {
    const spec = mk({ rowBold: "sig", rowColor: "status" });
    expect(spec.data.rows[0].style).toEqual({ bold: true, color: "up" });
    expect(spec.data.rows[1].style).toEqual({ bold: false, color: "down" });
    expect(spec.data.rows[2].style).toEqual({ bold: true, color: "up" });
  });

  test("semantic flags (emphasis/muted/accent) read as booleans", () => {
    const spec = mk({ rowEmphasis: "sig" });
    expect(spec.data.rows[0].style).toEqual({ emphasis: true });
    expect(spec.data.rows[1].style).toEqual({ emphasis: false });
  });

  test("no row-style args → rows carry no style", () => {
    const spec = mk({});
    expect(spec.data.rows.every((r) => r.style === undefined)).toBe(true);
  });

  test("missing field value on a row → that row keeps no style key", () => {
    const sparse = [{ study: "A", hl: "x" }, { study: "B" }];
    const spec = tabviz({ data: sparse, label: "study", columns: [colText({ field: "study" })], rowBg: "hl" });
    expect(spec.data.rows[0].style).toEqual({ bg: "x" });
    expect(spec.data.rows[1].style).toBeUndefined();
  });
});

describe("tabviz marker style mapping", () => {
  const mdata = [
    { study: "A", grp: "#f00", sz: 8, op: 0.9, sh: "circle" },
    { study: "B", grp: "#00f", sz: 4, op: 0.5, sh: "square" },
  ];
  test("color/shape as strings, opacity/size as numbers", () => {
    const spec = tabviz({
      data: mdata, label: "study", columns: [colText({ field: "study" })],
      markerColor: "grp", markerShape: "sh", markerOpacity: "op", markerSize: "sz",
    });
    expect(spec.data.rows[0].markerStyle).toEqual({ color: "#f00", shape: "circle", opacity: 0.9, size: 8 });
    expect(spec.data.rows[1].markerStyle).toEqual({ color: "#00f", shape: "square", opacity: 0.5, size: 4 });
  });
  test("no marker args → no markerStyle", () => {
    const spec = tabviz({ data: mdata, label: "study", columns: [colText({ field: "study" })] });
    expect(spec.data.rows.every((r) => r.markerStyle === undefined)).toBe(true);
  });
});

import { expect, test, describe } from "bun:test";
import { emitJsSource } from "./source-emit";
import { tabviz } from "../authoring/tabviz";
import { colText, colNumeric, colInterval } from "../authoring/columns";
import { vizForest } from "../authoring/viz";

const DATA = [
  { study: "A", hr: 0.85, lcl: 0.72, ucl: 0.99 },
];

describe("emitJsSource — compact builder output", () => {
  test("default nejm theme is omitted (just name resolves)", () => {
    const spec = tabviz({
      data: DATA, label: "study",
      columns: [colText({ field: "study" })],
    });
    const src = emitJsSource({ spec });
    expect(src).not.toContain("theme:"); // nejm is the default
    expect(src).toContain("tabviz({");
    expect(src).toContain("data: tabvizData");
    expect(src).toContain("colText");
  });

  test("non-default theme emitted as name string", () => {
    const spec = tabviz({
      data: DATA, label: "study", theme: "ledger", // a non-default survivor
      columns: [colText({ field: "study" })],
    });
    const src = emitJsSource({ spec });
    expect(src).toContain(`theme: "ledger"`);
  });

  test("data is replaced by placeholder, not inlined", () => {
    const spec = tabviz({
      data: DATA, label: "study",
      columns: [colText({ field: "study" })],
    });
    const src = emitJsSource({ spec });
    expect(src).not.toContain('"hr"'); // data values not inlined
    expect(src).toContain("data: tabvizData");
  });

  test("forest column emits vizForest call", () => {
    const spec = tabviz({
      data: DATA, label: "study",
      columns: [vizForest({ point: "hr", lower: "lcl", upper: "ucl", scale: "log" })],
    });
    const src = emitJsSource({ spec });
    expect(src).toContain("vizForest(");
    expect(src).toContain(`scale: "log"`); // non-default scale emitted
  });

  test("interval column emits colInterval call", () => {
    const spec = tabviz({
      data: DATA, label: "study",
      columns: [colInterval({ point: "hr", lower: "lcl", upper: "ucl" })],
    });
    const src = emitJsSource({ spec });
    expect(src).toContain("colInterval(");
    expect(src).toContain(`point: "hr"`);
    expect(src).toContain(`lower: "lcl"`);
    expect(src).toContain(`upper: "ucl"`);
  });

  test("titles are emitted when present", () => {
    const spec = tabviz({
      data: DATA, label: "study",
      title: "Forest plot",
      caption: "n=3 studies",
      columns: [colText({ field: "study" })],
    });
    const src = emitJsSource({ spec });
    expect(src).toContain(`title: "Forest plot"`);
    expect(src).toContain(`caption: "n=3 studies"`);
  });

  test("op-log replay appended after mount", () => {
    const spec = tabviz({
      data: DATA, label: "study",
      columns: [colNumeric({ field: "hr" })],
    });
    const src = emitJsSource({
      spec,
      opLog: [{ jsCall: 'instance.sortBy({ column: "hr", direction: "asc" })' }],
    });
    expect(src).toContain("instance.sortBy");
    expect(src).toContain(`createTabviz`);
  });

  test("does not include the full WebSpec JSON dump", () => {
    const spec = tabviz({
      data: DATA, label: "study",
      columns: [colText({ field: "study" })],
    });
    const src = emitJsSource({ spec });
    // The old emitter dumped `const spec = { ... 200 lines of JSON ... }`.
    // New emitter has `const spec = tabviz({...})` instead.
    expect(src).not.toContain('"schemaVersion": 2'); // no resolved-theme JSON
    expect(src).not.toContain('"rows":'); // no data array
  });
});

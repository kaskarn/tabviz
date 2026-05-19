import { expect, test, describe } from "bun:test";
import {
  setTitle, setSubtitle, setCaption, setFootnote,
  setTheme, setZoom,
  addColumn, removeColumn, updateColumn,
} from "./modifiers";
import { tabviz } from "./tabviz";
import { colText, colNumeric } from "./columns";

const DATA = [{ study: "A", hr: 0.85 }];
const baseSpec = () => tabviz({
  data: DATA, label: "study",
  columns: [colText({ field: "study" }), colNumeric({ field: "hr" })],
});

describe("label modifiers", () => {
  test("setTitle adds a title", () => {
    const out = setTitle(baseSpec(), "Hello");
    expect(out.labels?.title).toBe("Hello");
  });
  test("setSubtitle / setCaption / setFootnote chain immutably", () => {
    const spec = baseSpec();
    const out = setFootnote(setCaption(setSubtitle(spec, "sub"), "cap"), "foot");
    expect(out.labels?.subtitle).toBe("sub");
    expect(out.labels?.caption).toBe("cap");
    expect(out.labels?.footnote).toBe("foot");
    // Input unchanged
    expect(spec.labels?.subtitle).toBe(null);
  });
  test("setTitle(null) clears the title", () => {
    const out = setTitle(setTitle(baseSpec(), "x"), null);
    expect(out.labels?.title).toBe(null);
  });
});

describe("setTheme", () => {
  test("name string resolves to preset", () => {
    const out = setTheme(baseSpec(), "jama");
    expect(out.theme.name).toBe("jama");
  });
  test("input spec is not mutated", () => {
    const spec = baseSpec();
    setTheme(spec, "lancet");
    expect(spec.theme.name).toBe("cochrane");
  });
});

describe("setZoom", () => {
  test("plotWidth override propagates to layout", () => {
    const out = setZoom(baseSpec(), { plotWidth: 600 });
    expect(out.layout.plotWidth).toBe(600);
  });
  test("targetAspect override propagates", () => {
    const out = setZoom(baseSpec(), { targetAspect: 1.5 });
    expect(out.targetAspect).toBe(1.5);
  });
});

describe("column modifiers", () => {
  test("addColumn appends to the column list", () => {
    const spec = baseSpec();
    const before = spec.columns.length;
    const out = addColumn(spec, colNumeric({ field: "extra" }));
    expect(out.columns.length).toBe(before + 1);
    const last = out.columns[out.columns.length - 1];
    expect(last.id).toBe("numeric_extra");
  });

  test("removeColumn removes by id", () => {
    const spec = baseSpec();
    const out = removeColumn(spec, "numeric_hr");
    expect(out.columns.find((c) => c.id === "numeric_hr")).toBeUndefined();
  });

  test("updateColumn merges patch", () => {
    const out = updateColumn(baseSpec(), "numeric_hr", { header: "HR" });
    const col = out.columns.find((c) => c.id === "numeric_hr");
    expect(col?.header).toBe("HR");
  });
});

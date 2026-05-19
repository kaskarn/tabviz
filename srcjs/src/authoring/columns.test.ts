import { expect, test, describe } from "bun:test";
import {
  colText, colLabel, colNumeric, colN, colCurrency,
  colInterval, colPvalue, colRange, colEvents,
  colBar, colSparkline, colHeatmap, colProgress,
  colBadge, colIcon, colStars, colPictogram, colRing,
  colImg, colReference, colPercent,
  colGroup,
} from "./columns";

describe("colText", () => {
  test("minimal: defaults id from type+field", () => {
    const c = colText({ field: "study" });
    expect(c.id).toBe("text_study");
    expect(c.field).toBe("study");
    expect(c.type).toBe("text");
    expect(c.header).toBe("study");
    expect(c.align).toBe("left");
    expect(c.sortable).toBe(true);
    expect(c.flex).toBe(false);
    expect(c.isGroup).toBe(false);
  });

  test("with maxChars sets options.text.maxChars", () => {
    const c = colText({ field: "name", maxChars: 30 });
    expect(c.options?.text?.maxChars).toBe(30);
  });

  test("style mapping populates styleMapping", () => {
    const c = colText({ field: "x", style: { bold: "is_bold", color: "row_color" } });
    expect(c.styleMapping).toEqual({ bold: "is_bold", color: "row_color" });
  });
});

describe("colLabel", () => {
  test("prettifies snake_case header", () => {
    const c = colLabel({ field: "patient_id" });
    expect(c.header).toBe("Patient Id");
  });
  test("prettifies camelCase header", () => {
    const c = colLabel({ field: "studyName" });
    expect(c.header).toBe("Study Name");
  });
});

describe("colNumeric", () => {
  test("default decimals=2", () => {
    const c = colNumeric({ field: "estimate" });
    expect(c.options?.numeric?.decimals).toBe(2);
  });

  test("digits overrides decimals", () => {
    const c = colNumeric({ field: "v", digits: 3 });
    expect(c.options?.numeric?.digits).toBe(3);
    expect(c.options?.numeric?.decimals).toBeUndefined();
  });

  test("decimals + digits throws", () => {
    expect(() => colNumeric({ field: "v", decimals: 3, digits: 2 })).toThrow();
  });
});

describe("colN", () => {
  test("default header is N + thousands_sep=,", () => {
    const c = colN({ field: "n_total" });
    expect(c.header).toBe("N");
    expect(c.options?.numeric?.thousandsSep).toBe(",");
    expect(c.options?.numeric?.decimals).toBe(0);
  });
});

describe("colInterval", () => {
  test("packs point/lower/upper into interval options", () => {
    const c = colInterval({ point: "hr", lower: "lcl", upper: "ucl" });
    expect(c.options?.interval?.point).toBe("hr");
    expect(c.options?.interval?.lower).toBe("lcl");
    expect(c.options?.interval?.upper).toBe("ucl");
    expect(c.options?.interval?.decimals).toBe(2);
    expect(c.options?.interval?.separator).toBe(" ");
  });
});

describe("colPvalue", () => {
  test("default header P-value + format auto", () => {
    const c = colPvalue({ field: "p" });
    expect(c.header).toBe("P-value");
    expect(c.options?.pvalue?.format).toBe("auto");
    expect(c.options?.pvalue?.digits).toBe(2);
  });
  test("stars=true + custom thresholds", () => {
    const c = colPvalue({ field: "p", stars: true, thresholds: [0.05, 0.01, 0.001] });
    expect(c.options?.pvalue?.stars).toBe(true);
  });
});

describe("colBar / colSparkline / colProgress / colHeatmap", () => {
  test("colBar default scale linear, showLabel true", () => {
    const c = colBar({ field: "score" });
    expect(c.options?.bar?.scale).toBe("linear");
    expect(c.options?.bar?.showLabel).toBe(true);
  });
  test("colSparkline default type line, height 20", () => {
    const c = colSparkline({ field: "trend" });
    expect(c.options?.sparkline?.type).toBe("line");
    expect(c.options?.sparkline?.height).toBe(20);
  });
  test("colProgress default maxValue 100", () => {
    const c = colProgress({ field: "pct" });
    expect(c.options?.progress?.maxValue).toBe(100);
  });
});

describe("colBadge / colIcon / colStars / colPictogram / colRing", () => {
  test("colBadge default shape pill", () => {
    const c = colBadge({ field: "status" });
    expect(c.options?.badge?.shape).toBe("pill");
  });
  test("colStars default maxStars 5", () => {
    const c = colStars({ field: "rating" });
    expect(c.options?.stars?.maxStars).toBe(5);
  });
  test("colPictogram default glyph person", () => {
    const c = colPictogram({ field: "count" });
    expect(c.options?.pictogram?.glyph).toBe("person");
  });
  test("colRing default labelFormat percent", () => {
    const c = colRing({ field: "fill" });
    expect(c.options?.ring?.labelFormat).toBe("percent");
  });
});

describe("colImg / colReference / colPercent / colRange / colEvents", () => {
  test("colImg default height 40 + shape square", () => {
    const c = colImg({ field: "avatar" });
    expect(c.options?.img?.height).toBe(40);
    expect(c.options?.img?.shape).toBe("square");
  });
  test("colReference default showIcon true + maxChars 30", () => {
    const c = colReference({ field: "url" });
    expect(c.options?.reference?.showIcon).toBe(true);
    expect(c.options?.reference?.maxChars).toBe(30);
  });
  test("colPercent default decimals 1 + multiply true", () => {
    const c = colPercent({ field: "rate" });
    expect(c.options?.percent?.decimals).toBe(1);
    expect(c.options?.percent?.multiply).toBe(true);
  });
  test("colRange packs minField/maxField", () => {
    const c = colRange({ field: "spread", minField: "min", maxField: "max" });
    expect(c.options?.range?.minField).toBe("min");
    expect(c.options?.range?.maxField).toBe("max");
  });
  test("colEvents header Events + packs events/n fields", () => {
    const c = colEvents({ events: "e", n: "n" });
    expect(c.header).toBe("Events");
    expect(c.options?.events?.eventsField).toBe("e");
    expect(c.options?.events?.nField).toBe("n");
  });
  test("colCurrency uses prefix=$ by default", () => {
    const c = colCurrency({ field: "cost" });
    expect(c.options?.numeric?.prefix).toBe("$");
  });
});

describe("colGroup", () => {
  test("creates a group with nested children", () => {
    const g = colGroup({
      header: "Effect Size",
      children: [colNumeric({ field: "hr" }), colInterval({ point: "hr", lower: "lcl", upper: "ucl" })],
    });
    expect(g.isGroup).toBe(true);
    expect(g.header).toBe("Effect Size");
    expect(g.columns.length).toBe(2);
    expect(g.id).toBe("effect_size");
  });
});

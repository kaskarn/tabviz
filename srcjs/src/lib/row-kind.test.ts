import { describe, test, expect } from "bun:test";
import { resolveRowKind, rowKindProps, isBanded, type ClassifiableRow } from "./row-kind";

/**
 * RowKind classifier — behavior-preservation guard. The flag table encodes
 * today's scattered predicates; these tests pin them so the incremental
 * routing of call sites can't silently change classification.
 */

const groupHeader: ClassifiableRow = { type: "group_header", depth: 0 };
const dataRow = (t?: string): ClassifiableRow => ({
  type: "data",
  row: { style: t ? ({ type: t } as never) : {} },
});

describe("resolveRowKind", () => {
  test("group_header wins structurally (before style.type)", () => {
    expect(resolveRowKind(groupHeader)).toBe("group_header");
  });
  test("plain data row → data", () => {
    expect(resolveRowKind(dataRow())).toBe("data");
    expect(resolveRowKind(dataRow("data"))).toBe("data");
  });
  test("authored style.type maps to its kind", () => {
    expect(resolveRowKind(dataRow("spacer"))).toBe("spacer");
    expect(resolveRowKind(dataRow("summary"))).toBe("summary");
    expect(resolveRowKind(dataRow("header"))).toBe("header");
  });
  test("unknown style.type falls back to data", () => {
    expect(resolveRowKind(dataRow("bogus"))).toBe("data");
  });
});

describe("rowKindProps (today's behavior, verbatim)", () => {
  test("banding: only plain data is banded", () => {
    expect(isBanded(dataRow())).toBe(true);
    for (const k of ["header", "summary", "spacer"]) {
      expect(isBanded(dataRow(k))).toBe(false);
    }
    expect(isBanded(groupHeader)).toBe(false);
  });

  test("measuresWidth: header & spacer skip the data-row width loop", () => {
    expect(rowKindProps("data").measuresWidth).toBe(true);
    expect(rowKindProps("summary").measuresWidth).toBe(true);
    expect(rowKindProps("header").measuresWidth).toBe(false);
    expect(rowKindProps("spacer").measuresWidth).toBe(false);
  });

  test("rendersCells: group_header (full-span label) & spacer (empty) do not", () => {
    expect(rowKindProps("data").rendersCells).toBe(true);
    expect(rowKindProps("header").rendersCells).toBe(true);
    expect(rowKindProps("summary").rendersCells).toBe(true);
    expect(rowKindProps("group_header").rendersCells).toBe(false);
    expect(rowKindProps("spacer").rendersCells).toBe(false);
  });

  test("summaryMarker: only summary rows draw the diamond", () => {
    expect(rowKindProps("summary").summaryMarker).toBe(true);
    for (const k of ["data", "header", "spacer", "group_header"] as const) {
      expect(rowKindProps(k).summaryMarker).toBe(false);
    }
  });
});

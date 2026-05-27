import { describe, test, expect } from "bun:test";
import { compileVariants, resolveVariant } from "./variant-compile";
import { INTERVAL_SCHEMA } from "./columns/interval";
import type { ColumnSpec, ColumnGroup, WebSpec } from "../types";
// Side-effect: register built-in schemas so findSchemaForColumn works.
import "./init";

// Minimal stub spec — only the fields the compile pass reads.
function makeSpec(columns: WebSpec["columns"]): WebSpec {
  return {
    version: "1.0",
    data: { rows: [], groups: [], summaries: [] },
    columns,
    theme: { name: "default" } as unknown as WebSpec["theme"],
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableSelect: true, enableHover: true,
      enableResize: true, enableExport: true,
      enableFilters: false, enableReorderRows: true,
      enableReorderColumns: false, enableEdit: false,
    },
    layout: { plotWidth: "auto" },
  };
}

function intervalCol(variant?: string): ColumnSpec {
  return {
    id: "ci",
    header: "95% CI",
    field: "_interval_hr",
    type: "interval",
    align: "left",
    sortable: true,
    isGroup: false,
    options: {
      interval: {
        point: "hr",
        lower: "lo",
        upper: "hi",
        ...(variant ? { variant } : {}),
      },
    },
  } as unknown as ColumnSpec;
}

describe("resolveVariant", () => {
  test("returns the matching variant's resolved block by id", () => {
    const r = resolveVariant(INTERVAL_SCHEMA, "bracket_muted");
    expect(r).toMatchObject({
      boundsLayout: "row",
      boundsDelimiter: ["[", "]"],
      boundsSeparator: "–",
    });
  });

  test("returns the first declared variant when id is undefined", () => {
    const r = resolveVariant(INTERVAL_SCHEMA, undefined);
    // First declared is "traditional".
    expect(r).toMatchObject({
      boundsLayout: "row",
      boundsDelimiter: ["(", ")"],
      boundsSeparator: ", ",
    });
  });

  test("returns the first declared variant when id is unknown", () => {
    const r = resolveVariant(INTERVAL_SCHEMA, "nonexistent");
    expect(r).toMatchObject({ boundsDelimiter: ["(", ")"] });
  });

  test("returns null when schema declares no variants", () => {
    const schema = { ...INTERVAL_SCHEMA, variants: undefined };
    expect(resolveVariant(schema, "anything")).toBeNull();
  });
});

describe("compileVariants", () => {
  test("populates options.<bucket>.__resolved for each variant-bearing column", () => {
    const spec = makeSpec([intervalCol("plus_minus")]);
    const next = compileVariants(spec);
    const col = next.columns[0] as ColumnSpec;
    const i = (col.options as { interval?: Record<string, unknown> }).interval;
    expect(i?.__resolved).toMatchObject({
      boundsContent: "half_width",
      boundsPrefix: "± ",
    });
  });

  test("preserves the original variant key on the wire (round-trip)", () => {
    const spec = makeSpec([intervalCol("bracket_muted")]);
    const next = compileVariants(spec);
    const col = next.columns[0] as ColumnSpec;
    const i = (col.options as { interval?: Record<string, unknown> }).interval;
    expect(i?.variant).toBe("bracket_muted");
  });

  test("defaults to first variant when no id is set", () => {
    // intervalCol() with no variant arg → no `variant` key on options.
    const spec = makeSpec([intervalCol()]);
    const next = compileVariants(spec);
    const col = next.columns[0] as ColumnSpec;
    const i = (col.options as { interval?: Record<string, unknown> }).interval;
    // First variant is "traditional" → boundsDelimiter ["(", ")"].
    expect(i?.__resolved).toMatchObject({ boundsDelimiter: ["(", ")"] });
  });

  test("does not mutate the input spec", () => {
    const spec = makeSpec([intervalCol("stacked")]);
    const originalColumns = spec.columns;
    const originalOptions = (spec.columns[0] as ColumnSpec).options;
    compileVariants(spec);
    expect(spec.columns).toBe(originalColumns);
    expect((spec.columns[0] as ColumnSpec).options).toBe(originalOptions);
  });

  test("idempotent — re-running yields a referentially stable spec", () => {
    const spec = makeSpec([intervalCol("bracket_muted")]);
    const once = compileVariants(spec);
    const twice = compileVariants(once);
    expect(twice).toBe(once);
    expect(twice.columns).toBe(once.columns);
  });

  test("recurses into ColumnGroup descendants", () => {
    const grouped: ColumnGroup = {
      id: "grp",
      header: "Group",
      isGroup: true,
      columns: [intervalCol("plus_minus")],
    } as unknown as ColumnGroup;
    const spec = makeSpec([grouped as unknown as ColumnSpec]);
    const next = compileVariants(spec);
    const groupOut = next.columns[0] as unknown as ColumnGroup;
    const child = groupOut.columns[0] as ColumnSpec;
    const i = (child.options as { interval?: Record<string, unknown> }).interval;
    expect(i?.__resolved).toMatchObject({ boundsContent: "half_width" });
  });

  test("columns without variant-bearing schemas pass through unchanged", () => {
    // A plain text column — schema declares no variants. Should be the
    // exact same object reference.
    const textCol: ColumnSpec = {
      id: "name",
      header: "Name",
      field: "name",
      type: "text",
      align: "left",
      sortable: true,
      isGroup: false,
      options: { text: { maxChars: 30 } },
    } as unknown as ColumnSpec;
    const spec = makeSpec([textCol]);
    const next = compileVariants(spec);
    expect(next).toBe(spec);
    expect(next.columns[0]).toBe(textCol);
  });
});

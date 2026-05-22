// Integration test — importing init.ts boots schemas + behaviors so
// the dispatcher fires built-in contributeBanks for reference columns.

import { describe, test, expect, beforeAll } from "bun:test";
import { computeEffectiveBanks } from "./banks";
import type { ColumnSpec } from "../types";

// Side-effect import triggers behavior registrations.
beforeAll(async () => {
  await import("./init");
});

describe("schema/init — boot wires reference contributeBanks", () => {
  test("reference column populates footnotes from row data", () => {
    const col: ColumnSpec = {
      id: "studies",
      header: "Citation",
      field: "citation",
      type: "reference",
      align: "left",
      sortable: true,
      isGroup: false,
      width: "auto",
      options: { reference: { hrefField: "doi_url" } },
    } as ColumnSpec;

    const eff = computeEffectiveBanks({
      columns: [col],
      data: {
        rows: [
          {
            id: "r1",
            metadata: { citation: "Smith 2020", doi_url: "https://doi.org/1" },
          },
          {
            id: "r2",
            metadata: { citation: "Jones 2021", doi_url: "https://doi.org/2" },
          },
        ],
      },
    } as never);

    expect(eff.footnotes).toHaveLength(2);
    expect(eff.footnotes[0]).toMatchObject({
      id: "studies:r1",
      text: "Smith 2020",
      href: "https://doi.org/1",
      producer: "studies",
      index: 1,
    });
    expect(eff.footnotes[1]).toMatchObject({
      id: "studies:r2",
      text: "Jones 2021",
      producer: "studies",
      index: 2,
    });
  });

  test("reference column without hrefField produces footnotes without href", () => {
    const col: ColumnSpec = {
      id: "notes",
      header: "Notes",
      field: "note",
      type: "reference",
      align: "left",
      sortable: true,
      isGroup: false,
      width: "auto",
      options: { reference: {} },
    } as ColumnSpec;

    const eff = computeEffectiveBanks({
      columns: [col],
      data: { rows: [{ id: "r1", metadata: { note: "Internal memo" } }] },
    } as never);

    expect(eff.footnotes[0].text).toBe("Internal memo");
    expect(eff.footnotes[0].href).toBeUndefined();
  });

  test("user-authored + reference-derived footnotes coexist", () => {
    const col: ColumnSpec = {
      id: "studies",
      header: "Studies",
      field: "ref",
      type: "reference",
      align: "left",
      sortable: true,
      isGroup: false,
      width: "auto",
      options: { reference: {} },
    } as ColumnSpec;

    const eff = computeEffectiveBanks({
      columns: [col],
      data: { rows: [{ id: "r1", metadata: { ref: "Auto" } }] },
      banks: { footnotes: [{ id: "manual", text: "Disclaimer" }] },
    } as never);

    expect(eff.footnotes).toHaveLength(2);
    expect(eff.footnotes[0].id).toBe("manual");
    expect(eff.footnotes[1].id).toBe("studies:r1");
  });
});

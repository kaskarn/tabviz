import { expect, test, describe } from "bun:test";
import {
  rString,
  rLiteral,
  rCall,
  rNamed,
  ops,
  renderColumnBuilder,
} from "./op-recorder";

describe("rString", () => {
  test("plain string", () => {
    expect(rString("hello")).toBe('"hello"');
  });

  test("escapes double quotes and backslashes", () => {
    expect(rString('say "hi"')).toBe('"say \\"hi\\""');
    expect(rString("C:\\path")).toBe('"C:\\\\path"');
  });

  test("escapes newlines/tabs", () => {
    expect(rString("a\nb\tc")).toBe('"a\\nb\\tc"');
  });
});

describe("rLiteral", () => {
  test("null / undefined → NULL", () => {
    expect(rLiteral(null)).toBe("NULL");
    expect(rLiteral(undefined)).toBe("NULL");
  });

  test("booleans", () => {
    expect(rLiteral(true)).toBe("TRUE");
    expect(rLiteral(false)).toBe("FALSE");
  });

  test("finite numbers", () => {
    expect(rLiteral(42)).toBe("42");
    expect(rLiteral(3.14)).toBe("3.14");
  });

  test("non-finite numbers", () => {
    expect(rLiteral(Infinity)).toBe("Inf");
    expect(rLiteral(-Infinity)).toBe("-Inf");
    expect(rLiteral(NaN)).toBe("NaN");
  });
});

describe("rCall", () => {
  test("function with mixed positional + named args", () => {
    expect(rCall("resize_column", [rLiteral("drug"), rLiteral(160)])).toBe(
      'resize_column("drug", 160)',
    );
    expect(rCall("move_column", [rLiteral("x"), rNamed("to", 2)])).toBe(
      'move_column("x", to = 2)',
    );
  });

  test("filters nulls", () => {
    expect(rCall("f", [rLiteral("a"), null, undefined])).toBe('f("a")');
  });
});

// Snapshot-style per-op tests — if an op's rendering changes, the test
// fails loud, documenting the contract in one place.
describe("ops helpers", () => {
  test("resizeColumn", () => {
    expect(ops.resizeColumn("drug", 160.4).rCall).toBe(
      'resize_column("drug", 160)',
    );
  });

  test("moveColumn (index)", () => {
    expect(ops.moveColumn("drug", 3).rCall).toBe(
      'move_column("drug", to = 3)',
    );
  });

  test("moveColumn (string)", () => {
    expect(ops.moveColumn("drug", "region").rCall).toBe(
      'move_column("drug", to = "region")',
    );
  });

  test("addColumn", () => {
    expect(ops.addColumn('col_text("region", header = "Region")', "drug").rCall)
      .toBe('add_column(col_text("region", header = "Region"), after = "drug")');
  });

  test("removeColumn", () => {
    expect(ops.removeColumn("drug").rCall).toBe('remove_column("drug")');
  });

  test("updateColumn with patch", () => {
    expect(ops.updateColumn("hr", { header: "HR", type: "col_numeric" }).rCall)
      .toBe('update_column("hr", header = "HR", type = "col_numeric")');
  });

  test("moveRow", () => {
    expect(ops.moveRow("row_1", 2).rCall).toBe('move_row("row_1", to = 2)');
  });

  test("setCell", () => {
    expect(ops.setCell("row_1", "drug", "Metformin").rCall).toBe(
      'set_cell("row_1", "drug", "Metformin")',
    );
  });

  test("setRowLabel", () => {
    expect(ops.setRowLabel("row_1", "Study A").rCall).toBe(
      'set_row_label("row_1", "Study A")',
    );
  });

  test("setLabelSlot: title", () => {
    expect(ops.setLabelSlot("title", "Hello").rCall).toBe('set_title("Hello")');
  });

  test("setLabelSlot: caption NULL", () => {
    expect(ops.setLabelSlot("caption", null).rCall).toBe("set_caption(NULL)");
  });

  test("setWatermark", () => {
    expect(ops.setWatermark("DRAFT").rCall).toBe('set_watermark("DRAFT")');
    expect(ops.setWatermark(null).rCall).toBe("set_watermark(NULL)");
  });

  test("paintRow", () => {
    expect(ops.paintRow("row_1", "emphasis").rCall).toBe(
      'paint_row("row_1", "emphasis")',
    );
    expect(ops.paintRow("row_1", null).rCall).toBe('paint_row("row_1", NULL)');
  });

  test("paintCell", () => {
    expect(ops.paintCell("row_1", "hr", "muted").rCall).toBe(
      'paint_cell("row_1", "hr", "muted")',
    );
  });

  test("setTheme", () => {
    expect(ops.setTheme("jama").rCall).toBe('set_theme("jama")');
  });

  test("setSharedColumnWidths", () => {
    expect(ops.setSharedColumnWidths(true).rCall).toBe(
      "set_shared_column_widths(TRUE)",
    );
    expect(ops.setSharedColumnWidths(false).rCall).toBe(
      "set_shared_column_widths(FALSE)",
    );
  });
});

describe("renderColumnBuilder", () => {
  test("col_text with field + header", () => {
    expect(renderColumnBuilder({ type: "col_text", field: "drug", header: "Drug" }))
      .toBe('col_text("drug", header = "Drug")');
  });

  test("viz_forest passes through", () => {
    expect(renderColumnBuilder({ type: "viz_forest", field: "hr" }))
      .toBe('viz_forest("hr")');
  });
});

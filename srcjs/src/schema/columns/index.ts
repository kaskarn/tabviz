// Column registry — single source of truth for column-type metadata.
//
// Add new types here; the editor and codegen pick them up automatically.

import type { ColumnRegistry } from "../types";
import { TEXT_COLUMN } from "./text";
import { NUMERIC_COLUMN } from "./numeric";
import { PERCENT_COLUMN } from "./percent";

/**
 * Keys are the *editor-side* column-type identifiers (matching the labels
 * shown in the type-picker), NOT necessarily the wire `column.type`. The
 * percent entry's `.type` is "numeric"; the registry key is "percent" so
 * the editor's preset menu can distinguish them.
 */
export const COLUMN_REGISTRY: ColumnRegistry = {
  text: TEXT_COLUMN,
  numeric: NUMERIC_COLUMN,
  percent: PERCENT_COLUMN,
};

export { TEXT_COLUMN, NUMERIC_COLUMN, PERCENT_COLUMN };

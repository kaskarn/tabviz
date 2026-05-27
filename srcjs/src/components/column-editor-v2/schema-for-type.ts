// ColumnType → ColumnSchema lookup. The wire `type` field is the
// stable handle authors and runtime code use; for editor purposes we
// need to walk through to the matching schema in SCHEMA_REGISTRY.
//
// Most types map identity-style. The few that don't:
//   - "forest" is the column type for forest-plot columns, owned by
//     the `viz_forest` schema (the viz_ prefix is schema-side only,
//     wire stays "forest" for back-compat).

import { SCHEMA_REGISTRY } from "../../schema/columns";
import type { ColumnSchema } from "../../schema/types";
import type { ColumnType } from "../../types";

const TYPE_TO_SCHEMA_KEY: Partial<Record<ColumnType, string>> = {
  forest:      "viz_forest",
  viz_bar:     "viz_bar",
  viz_boxplot: "viz_boxplot",
  viz_violin:  "viz_violin",
  // Events lives at `type: "custom"` on the wire (legacy bucket reuse).
  // Without this alias the editor's `schemaForColumnType("custom")`
  // returns null and the popover silently refuses to render — "add
  // Events column" appears to do nothing.
  custom:      "events",
};

export function schemaForColumnType(type: ColumnType): ColumnSchema | null {
  const key = TYPE_TO_SCHEMA_KEY[type] ?? type;
  return SCHEMA_REGISTRY[key] ?? null;
}

// `ordinal` — abstract column schema. Same `levels` as CATEGORICAL,
// but the order is semantically meaningful. Sort by level index
// rather than lex; aggregate by median rather than mode; threshold
// conditions are well-defined.
//
// Concrete schemas inheriting ORDINAL (stars, rating, pictogram-as-
// rating) get index-aware behaviors automatically via the inherited
// CATEGORICAL surface plus ORDINAL-level overrides.

import type { ColumnSchema } from "../types";

export const ORDINAL_SCHEMA: ColumnSchema = {
  key: "ordinal",
  label: "Ordinal",
  abstract: true,
  defaultOpen: false,
  inherits: "categorical",
  options: [
    // No new options — `levels` from CATEGORICAL is reused, but
    // semantically the order matters here. The renderer / editor
    // can present them as ordered (1, 2, 3...) rather than checklists.
  ],
};

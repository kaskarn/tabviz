// Column-schema registry — single source of truth for column-type
// metadata. Add new schemas (concrete or abstract) here; the editor
// and codegen pick them up automatically.

import type { SchemaRegistry } from "../types";
import { BASE_SCHEMA } from "./base";
import { TEXT_SCHEMA } from "./text";
import { NUMERIC_SCHEMA } from "./numeric";
import { PERCENT_SCHEMA } from "./percent";

/**
 * Schemas are abstract (structural/ontological, not in the picker —
 * BASE, future VIZ / SVG) or concrete (user-facing — TEXT, NUMERIC,
 * PERCENT). Keys here match each schema's `key` field, used as the
 * inheritance handle.
 */
export const SCHEMA_REGISTRY: SchemaRegistry = {
  base:    BASE_SCHEMA,
  text:    TEXT_SCHEMA,
  numeric: NUMERIC_SCHEMA,
  percent: PERCENT_SCHEMA,
};

export { BASE_SCHEMA, TEXT_SCHEMA, NUMERIC_SCHEMA, PERCENT_SCHEMA };

// Column-schema registry — single source of truth for column-type
// metadata. Add new schemas (concrete or abstract) here; the editor
// and codegen pick them up automatically.

import type { SchemaRegistry } from "../types";
import { BASE_SCHEMA } from "./base";
import { TEXT_SCHEMA } from "./text";
import { DATE_SCHEMA } from "./date";
import { NUMERIC_SCHEMA } from "./numeric";
import { N_SCHEMA } from "./n";
import { CURRENCY_SCHEMA } from "./currency";
import { PERCENT_SCHEMA } from "./percent";
import { PVALUE_SCHEMA } from "./pvalue";
import { INTERVAL_SCHEMA } from "./interval";
import { RANGE_SCHEMA } from "./range";
import { EVENTS_SCHEMA } from "./events";
import { BAR_SCHEMA } from "./bar";
import { PROGRESS_SCHEMA } from "./progress";
import { HEATMAP_SCHEMA } from "./heatmap";
import { SPARKLINE_SCHEMA } from "./sparkline";

/**
 * Schemas are abstract (structural/ontological, not in the picker —
 * BASE, future VIZ / SVG) or concrete (user-facing — TEXT, NUMERIC,
 * PERCENT, …). Keys here match each schema's `key` field, used as
 * the inheritance handle.
 */
export const SCHEMA_REGISTRY: SchemaRegistry = {
  base:     BASE_SCHEMA,
  text:     TEXT_SCHEMA,
  date:     DATE_SCHEMA,
  numeric:  NUMERIC_SCHEMA,
  n:        N_SCHEMA,
  currency: CURRENCY_SCHEMA,
  percent:  PERCENT_SCHEMA,
  pvalue:    PVALUE_SCHEMA,
  interval:  INTERVAL_SCHEMA,
  range:     RANGE_SCHEMA,
  events:    EVENTS_SCHEMA,
  bar:       BAR_SCHEMA,
  progress:  PROGRESS_SCHEMA,
  heatmap:   HEATMAP_SCHEMA,
  sparkline: SPARKLINE_SCHEMA,
};

export {
  BASE_SCHEMA,
  TEXT_SCHEMA, DATE_SCHEMA,
  NUMERIC_SCHEMA, N_SCHEMA, CURRENCY_SCHEMA, PERCENT_SCHEMA,
  PVALUE_SCHEMA, INTERVAL_SCHEMA, RANGE_SCHEMA, EVENTS_SCHEMA,
  BAR_SCHEMA, PROGRESS_SCHEMA, HEATMAP_SCHEMA, SPARKLINE_SCHEMA,
};

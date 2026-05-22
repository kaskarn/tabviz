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
import { PICTOGRAM_SCHEMA } from "./pictogram";
import { STARS_SCHEMA } from "./stars";
import { RING_SCHEMA } from "./ring";
import { BADGE_SCHEMA } from "./badge";
import { ICON_SCHEMA } from "./icon";
import { IMG_SCHEMA } from "./img";
import { REFERENCE_SCHEMA } from "./reference";
import { VIZ_SCHEMA } from "./viz";
import { VIZ_FOREST_SCHEMA } from "./viz_forest";
import { VIZ_BAR_SCHEMA } from "./viz_bar";
import { VIZ_BOXPLOT_SCHEMA } from "./viz_boxplot";
import { VIZ_VIOLIN_SCHEMA } from "./viz_violin";

// NOTE: built-in behavior registrations (reference-behaviors.ts etc.)
// are NOT auto-imported here to avoid the circular dependency
// `extend.ts → columns/index.ts → behaviors → extend.ts`. Consumers
// that need behaviors at runtime should import `src/schema/init.ts`
// (which bundles schemas + behaviors).

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
  pictogram: PICTOGRAM_SCHEMA,
  stars:     STARS_SCHEMA,
  ring:      RING_SCHEMA,
  badge:       BADGE_SCHEMA,
  icon:        ICON_SCHEMA,
  img:         IMG_SCHEMA,
  reference:   REFERENCE_SCHEMA,
  viz:         VIZ_SCHEMA,
  viz_forest:  VIZ_FOREST_SCHEMA,
  viz_bar:     VIZ_BAR_SCHEMA,
  viz_boxplot: VIZ_BOXPLOT_SCHEMA,
  viz_violin:  VIZ_VIOLIN_SCHEMA,
};

export {
  BASE_SCHEMA,
  TEXT_SCHEMA, DATE_SCHEMA,
  NUMERIC_SCHEMA, N_SCHEMA, CURRENCY_SCHEMA, PERCENT_SCHEMA,
  PVALUE_SCHEMA, INTERVAL_SCHEMA, RANGE_SCHEMA, EVENTS_SCHEMA,
  BAR_SCHEMA, PROGRESS_SCHEMA, HEATMAP_SCHEMA, SPARKLINE_SCHEMA,
  PICTOGRAM_SCHEMA, STARS_SCHEMA, RING_SCHEMA,
  BADGE_SCHEMA, ICON_SCHEMA, IMG_SCHEMA, REFERENCE_SCHEMA,
  VIZ_SCHEMA, VIZ_FOREST_SCHEMA, VIZ_BAR_SCHEMA,
  VIZ_BOXPLOT_SCHEMA, VIZ_VIOLIN_SCHEMA,
};

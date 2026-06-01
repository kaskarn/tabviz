// `categorical` — abstract column schema. Describes the semantic
// shape of the data: values come from a finite, defined set. This
// is between FieldCategory (wire data shape) and concrete rendering
// schemas (badge / icon / ...).
//
// Concrete schemas that inherit CATEGORICAL gain:
//   - level-aware aggregate (mode)
//   - per-level contributeConditions (e.g. is_published, is_draft)
//   - smart filter UI (multi-select chips per level)
//   - color/glyph map derivation from levels

import type { ColumnSchema } from "../types";

export const CATEGORICAL_SCHEMA: ColumnSchema = {
  key: "categorical",
  label: "Categorical",
  abstract: true,
  defaultOpen: false,
  inherits: "base",
  options: [
    {
      key: "levels",
      label: "Levels",
      // Custom control: a list editor for the defined values. Stub for now;
      // Phase 5/6 builds the editor primitive. Default empty array means
      // "infer from data" — the renderer can fallback to data-derived levels.
      control: "custom",
      default: [],
      kind: "core",
      customComponent: "LevelSetEditor",
      hint: "Defined value set (or empty = infer from data)",
    },
    {
      key: "levelsRef",
      // Reference a named level set in banks.levelSets — for sharing
      // a single definition across multiple columns. Mutually exclusive
      // with `levels` (declared below via mutuallyExclusive).
      label: "Levels (named)",
      control: "text",
      default: null,
      kind: "core",
      hint: "Reference a shared level set by name",
    },
  ],
  mutuallyExclusive: [["levels", "levelsRef"]],
};

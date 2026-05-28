// Helper: build the initial editor state map for a column schema.
// Walks the resolved schema chain and gives each option its starting
// value — used by the column editor when opening "insert" mode with
// no existing spec, and as a base map that gets overlaid with values
// from an existing ColumnSpec when in "configure" mode.
//
// Conventions:
//   - Most options start at their `default` value (or null when no
//     default).
//   - `value-or-field` options start at `{ mode: "off" }` — the
//     theme cascade is the default; the user explicitly opts into
//     static or mapped overrides.

import type { ColumnSchema } from "./types";
import { resolveSchema } from "./resolve";
import type { MappedState } from "../components/primitives/mapped-value";

export type EditorState = Record<string, unknown>;

export function initialStateForSchema(schema: ColumnSchema): EditorState {
  const out: EditorState = {};
  for (const ancestor of resolveSchema(schema)) {
    for (const opt of ancestor.options) {
      if (opt.control === "value-or-field") {
        out[opt.key] = { mode: "off" } satisfies MappedState<never>;
      } else {
        out[opt.key] = opt.default;
      }
    }
  }
  // Apply optionOverrides walking the chain — later (more specific)
  // overrides win. Mirrors what the codegen does for R defaults.
  for (const ancestor of resolveSchema(schema)) {
    if (!ancestor.optionOverrides) continue;
    for (const [k, v] of Object.entries(ancestor.optionOverrides)) {
      if (k in out) out[k] = v;
    }
  }
  return out;
}

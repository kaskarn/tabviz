// Behavior wiring for the `reference` schema.
//
// Reference columns auto-populate the footnote bank: each row's
// citation text becomes a footnote entry, optionally with the URL
// from the schema's `hrefField` option. The cell renderer (Phase 7)
// will display the footnote NUMBER ("[1]", "[2]") rather than the
// truncated citation text.
//
// User-authored footnotes via `tabviz({ banks: { footnotes: ... } })`
// are preserved unchanged; derived entries get tagged with the
// producer column id so removing the column auto-removes them.

import type { ColumnSpec } from "../../types";
import type { SchemaBehaviors } from "../render-types";
import { registerBehaviors } from "../extend";
import { derivedId, type FootnoteEntry, type BankContribution } from "../banks";

interface RowLike {
  id: string;
  metadata?: Record<string, unknown>;
}
interface SpecLike {
  data?: { rows?: RowLike[] };
}

/** Re-register reference behaviors. Idempotent — safe to call after
 *  `__resetRuntimeRegistries()` to restore built-in wiring. */
export function registerReferenceBehaviors(): void {
  registerBehaviors("reference", REFERENCE_BEHAVIORS);
}

const REFERENCE_BEHAVIORS: SchemaBehaviors = {
  contributeBanks: (column: ColumnSpec, spec): BankContribution => {
    const rows = ((spec as SpecLike).data?.rows ?? []) as RowLike[];
    const referenceOpts = (column.options as { reference?: { hrefField?: string } } | undefined)
      ?.reference;
    const hrefField = referenceOpts?.hrefField;
    const footnotes: FootnoteEntry[] = [];
    for (const row of rows) {
      const meta = row.metadata ?? {};
      const text = meta[column.field];
      if (text == null || text === "") continue;
      const entry: FootnoteEntry = {
        id: derivedId(column.id, row.id),
        text: String(text),
      };
      if (hrefField) {
        const url = meta[hrefField];
        if (url != null && url !== "") entry.href = String(url);
      }
      footnotes.push(entry);
    }
    return { footnotes };
  },
};

// Side-effect: register on first import (back-compat).
registerReferenceBehaviors();

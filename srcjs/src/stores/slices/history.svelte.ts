// History micro-slice — append-only operation log + the appendOp /
// coalesce / clear primitives. Every mutation slice that records a
// fluent-R call (`paint_row(...)`, `set_aspect_ratio(...)`, etc.) goes
// through this slice's `appendOp`.
//
// Owns:
//   - opLog              OpRecord[] — append-only history of ops
//
// Coalesce contract (preserved verbatim from tabvizStore):
//
//   1. Exact byte-for-byte duplicates of the most recent entry are
//      dropped silently. Catches drag-end firing twice, double-clicks,
//      value-didn't-actually-change cases.
//
//   2. For coalesce-eligible kinds (currently only `set_aspect_ratio`),
//      a consecutive run of the same kind collapses to its LATEST
//      value. The aspect slider fires `oninput` per pixel of drag —
//      without this, View Source showed dozens of
//      `set_aspect_ratio(0.961)` / `(0.975)` / ... lines per drag.
//      Coalescing across kinds is NOT done — once a different action
//      interrupts the chain, the slider segment is sealed.
//
// No cross-slice deps. Every mutation slice that records ops takes
// `appendOp` from this slice's `appendOp` getter via the main
// factory's wiring.
//
// Phase 0c-C1 PR8 (micro-slice).

import type { OpRecord } from "$lib/op-recorder";

export interface HistorySlice {
  /** Current append-only log (reactive). */
  readonly opLog: readonly OpRecord[];
  /** Append a record, applying the dedupe + coalesce rules. */
  appendOp: (record: OpRecord) => void;
  /** Drop the entire log. Called from `setSpec` / `resetState` —
   *  a fresh spec is a fresh "session" for source generation. */
  reset: () => void;
}

export function createHistorySlice(): HistorySlice {
  let opLog = $state<OpRecord[]>([]);

  function appendOp(record: OpRecord): void {
    const prev = opLog[opLog.length - 1];
    if (prev && prev.rCall === record.rCall) return;
    // Coalesce-eligible kinds: inlined check rather than a typed Set,
    // per the saved feedback (Vite minifier trips on
    // `ReadonlySet<Union["kind"]>` top-level declarations in runes
    // modules — see commit 8b39868's bug). Inline equality stays
    // robust through the minify pass.
    const isCoalesceKind = record.kind === "set_aspect_ratio";
    if (prev && isCoalesceKind && prev.kind === record.kind) {
      opLog = [...opLog.slice(0, -1), record];
      return;
    }
    opLog = [...opLog, record];
  }

  function reset(): void {
    opLog = [];
  }

  return {
    get opLog() { return opLog; },
    appendOp,
    reset,
  };
}

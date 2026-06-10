// Stage 3 §2 — Cascade Inspector store.
//
// Owns the inspector's open/closed state, the currently-traced cssVar,
// the inspection trace, and the "click-to-trace" pointer handler. The
// inspector panel (CascadeInspector.svelte) is the consumer.
//
// The actual trace logic lives in lib/theme/inspect.ts — this store
// only holds state and exposes commit/clear actions.

import type { ResolvedTheme } from "../lib/theme/resolve-theme";
import { inspectToken, type TokenInspection } from "../lib/theme/inspect";

/** Inspector state. */
export interface InspectorState {
  open: boolean;
  cssVar: string | null;
  trace: TokenInspection | null;
}

class InspectorStore {
  state = $state<InspectorState>({
    open: false,
    cssVar: null,
    trace: null,
  });

  /** Open the inspector and trace a cssVar against the resolved theme. */
  trace(cssVar: string, resolved: ResolvedTheme): void {
    this.state.cssVar = cssVar;
    this.state.trace = inspectToken(resolved, cssVar);
    this.state.open = true;
  }

  /** Clear the active trace but keep the inspector open. */
  clearTrace(): void {
    this.state.cssVar = null;
    this.state.trace = null;
  }

  /** Close the inspector entirely. */
  close(): void {
    this.state.open = false;
    this.state.cssVar = null;
    this.state.trace = null;
  }
}

/** Singleton inspector store; the inspector panel + studio trace both
 *  consume this single instance. */
export const inspectorStore = new InspectorStore();

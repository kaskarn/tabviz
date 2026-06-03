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
  /** When set, "learning mode" highlights the consumer element being
   *  traced via a pulsing outline. Off by default; surfaced as a
   *  toggle in the inspector panel. */
  learningMode: boolean;
}

class InspectorStore {
  state = $state<InspectorState>({
    open: false,
    cssVar: null,
    trace: null,
    learningMode: false,
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

  /** Toggle learning mode (consumer-element pulse on trace). */
  toggleLearningMode(): void {
    this.state.learningMode = !this.state.learningMode;
  }
}

/** Singleton inspector store; the inspector panel + click-handler both
 *  consume this single instance. */
export const inspectorStore = new InspectorStore();

/** Click handler suitable for installing at the widget root: walks up
 *  from event.target looking for a `data-tv-token` attribute, then
 *  traces the corresponding cssVar via inspectorStore.trace().
 *
 *  Returns true when a trace was initiated, false otherwise. Caller
 *  decides whether to stopPropagation; the handler itself doesn't. */
export function tryTraceFromEvent(event: Event, resolved: ResolvedTheme): boolean {
  let el = event.target as Element | null;
  while (el && el !== document.documentElement) {
    const tok = el.getAttribute?.("data-tv-token");
    if (tok) {
      inspectorStore.trace(`--tv-${tok}`, resolved);
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

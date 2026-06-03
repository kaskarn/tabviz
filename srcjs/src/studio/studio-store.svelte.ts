// Stage 3 — Studio working-copy state + history.
//
// Owns the editable theme inputs (working copy) + a history stack for
// undo/redo (50-entry cap) + dirty tracking against the loaded base.
//
// Shared by StudioShell + all tab + Inspector components.

import type { ThemeInputs } from "../types/theme-inputs";
import type { ResolvedTheme } from "../lib/theme/resolve-theme";
import { resolveTheme } from "../lib/theme/resolve-theme";
import { createWire } from "../lib/theme/theme-wire";

/** Per-edit history step. `inputs` is a complete snapshot (cheap; <1kB). */
export interface HistoryStep {
  readonly inputs: ThemeInputs;
  /** Brief description for UI hints (e.g. "Brand color", "Polarity"). */
  readonly label: string;
}

const HISTORY_CAP = 50;

class StudioStore {
  /** The base theme inputs (loaded preset or input theme). Treated as
   *  immutable reference for "dirty" comparison. */
  base = $state.raw<ThemeInputs | null>(null);
  /** The base name shown in the header strip ("cochrane", "(user input)"). */
  baseName = $state<string>("(default)");

  /** The current working-copy inputs — the user's edits. */
  inputs = $state.raw<ThemeInputs | null>(null);

  /** History stack: undo pops from end; redo follows the cursor. */
  history = $state<HistoryStep[]>([]);
  /** Index of the current state in history (-1 = no history). */
  cursor = $state<number>(-1);

  /** Derived: the resolved theme cssVars + roles + ramps for chart rendering
   *  and Inspector trace. Recomputes on every input change. */
  resolved = $derived<ResolvedTheme | null>(
    this.inputs ? resolveTheme(createWire(this.inputs, this.baseName)) : null,
  );

  /** Derived: dirty iff the current inputs differ from the base. */
  dirty = $derived<boolean>(
    !inputsEqual(this.base, this.inputs),
  );

  /** Initialize the store with a base + initial inputs (usually identical). */
  init(base: ThemeInputs, baseName: string): void {
    this.base = base;
    this.baseName = baseName;
    this.inputs = base;
    this.history = [{ inputs: base, label: "Loaded" }];
    this.cursor = 0;
  }

  /** Apply an edit to the working copy. Pushes a new history step and
   *  truncates any redo trail. */
  apply(next: ThemeInputs, label: string): void {
    this.inputs = next;
    // Truncate forward history (redo trail) past the current cursor.
    const truncated = this.history.slice(0, this.cursor + 1);
    truncated.push({ inputs: next, label });
    // Cap at HISTORY_CAP — drop oldest if over.
    while (truncated.length > HISTORY_CAP) truncated.shift();
    this.history = truncated;
    this.cursor = truncated.length - 1;
  }

  /** Step back one history entry. Returns true when a step was performed. */
  undo(): boolean {
    if (this.cursor <= 0) return false;
    this.cursor -= 1;
    this.inputs = this.history[this.cursor].inputs;
    return true;
  }

  /** Step forward one history entry. Returns true when a step was performed. */
  redo(): boolean {
    if (this.cursor >= this.history.length - 1) return false;
    this.cursor += 1;
    this.inputs = this.history[this.cursor].inputs;
    return true;
  }

  /** Revert to the base. Treated as a single edit (one undo step). */
  revert(): void {
    if (this.base) this.apply(this.base, "Revert to base");
  }

  /** Reset everything (used on close). */
  reset(): void {
    this.base = null;
    this.baseName = "(default)";
    this.inputs = null;
    this.history = [];
    this.cursor = -1;
  }
}

/** Cheap deep equality for ThemeInputs. */
function inputsEqual(a: ThemeInputs | null, b: ThemeInputs | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Singleton — the studio is mounted once per gadget session. */
export const studioStore = new StudioStore();

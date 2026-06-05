// Stage 3 — Studio working-copy state + history.
//
// Owns the editable theme inputs (working copy) + a history stack for
// undo/redo (50-entry cap) + dirty tracking against the loaded base.
//
// Shared by StudioShell + all tab + Inspector components.

import type { ThemeInputs } from "../types/theme-inputs";
import type { RoleName, RampName } from "../types/theme-roles";
import type { ResolvedTheme } from "../lib/theme/resolve-theme";
import { resolveTheme } from "../lib/theme/resolve-theme";
import { createWire, setRoleBinding as wireSetRoleBinding, type RoleOverrides } from "../lib/theme/theme-wire";

/** Per-edit history step. `inputs` + `roleOverrides` are complete snapshots
 *  (cheap; <1kB combined). */
export interface HistoryStep {
  readonly inputs: ThemeInputs;
  readonly roleOverrides: RoleOverrides;
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

  /** Current role bindings overlaid on DEFAULT_ROLE_BINDINGS. Each entry
   *  is `{ramp, grade}`; absent roles use the default. Mutated by the
   *  Spine drag-to-rebind. */
  roleOverrides = $state.raw<RoleOverrides>({});

  /** History stack: undo pops from end; redo follows the cursor. */
  history = $state<HistoryStep[]>([]);
  /** Index of the current state in history (-1 = no history). */
  cursor = $state<number>(-1);

  /** Keep-last-good cache for the resolve error boundary. Plain field
   *  (NOT $state) so the $derived below may write it without tripping
   *  Svelte's state_unsafe_mutation guard. */
  private lastGoodResolved: ResolvedTheme | null = null;

  /** Derived: resolve outcome with an error boundary (Pass 0d-ii /
   *  wire-audit C51-adjacent, hardens B3). A resolver throw no longer
   *  white-screens the studio: the last successfully resolved theme keeps
   *  rendering and `resolveError` carries the message for inline display. */
  private resolveOutcome = $derived.by<{
    theme: ResolvedTheme | null;
    error: string | null;
  }>(() => {
    if (!this.inputs) return { theme: null, error: null };
    try {
      const theme = resolveTheme({
        ...createWire(this.inputs, this.baseName),
        roleOverrides: this.roleOverrides,
      });
      this.lastGoodResolved = theme;
      return { theme, error: null };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("studio: theme resolve failed; keeping last good", e);
      return {
        theme: this.lastGoodResolved,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  /** Derived: the resolved theme cssVars + roles + ramps for chart rendering
   *  and Inspector trace. Recomputes on every input change. Falls back to
   *  the last good resolution when the current inputs fail to resolve. */
  resolved = $derived<ResolvedTheme | null>(this.resolveOutcome.theme);

  /** Non-null while the current inputs fail to resolve (the rendered theme
   *  is then the last good one). StudioShell surfaces this inline. */
  resolveError = $derived<string | null>(this.resolveOutcome.error);

  /** Derived: dirty iff the current state differs from the base. */
  dirty = $derived<boolean>(
    !inputsEqual(this.base, this.inputs) || Object.keys(this.roleOverrides).length > 0,
  );

  /** Initialize the store with a base + initial inputs (usually identical). */
  init(base: ThemeInputs, baseName: string): void {
    this.base = base;
    this.baseName = baseName;
    this.inputs = base;
    this.roleOverrides = {};
    this.history = [{ inputs: base, roleOverrides: {}, label: "Loaded" }];
    this.cursor = 0;
  }

  /** Apply an edit to the working copy. Pushes a new history step and
   *  truncates any redo trail. */
  apply(next: ThemeInputs, label: string): void {
    this.inputs = next;
    this.pushHistory(next, this.roleOverrides, label);
  }

  /** Rebind a role to a (ramp, grade) pair. Used by Spine drag-to-rebind. */
  setRoleBinding(role: RoleName, ramp: RampName, grade: number): void {
    if (!this.inputs) return;
    const wire = { ...createWire(this.inputs, this.baseName), roleOverrides: this.roleOverrides };
    try {
      const next = wireSetRoleBinding(wire, role, ramp, grade);
      this.roleOverrides = next.roleOverrides;
      this.pushHistory(this.inputs, next.roleOverrides, `Rebind ${role} → ${ramp}[${grade}]`);
    } catch {
      // Off-ramp role or invalid grade — silently no-op; UI prevents this.
    }
  }

  private pushHistory(inputs: ThemeInputs, roleOverrides: RoleOverrides, label: string): void {
    const truncated = this.history.slice(0, this.cursor + 1);
    truncated.push({ inputs, roleOverrides, label });
    while (truncated.length > HISTORY_CAP) truncated.shift();
    this.history = truncated;
    this.cursor = truncated.length - 1;
  }

  /** Step back one history entry. Returns true when a step was performed. */
  undo(): boolean {
    if (this.cursor <= 0) return false;
    this.cursor -= 1;
    const step = this.history[this.cursor];
    this.inputs = step.inputs;
    this.roleOverrides = step.roleOverrides;
    return true;
  }

  /** Step forward one history entry. Returns true when a step was performed. */
  redo(): boolean {
    if (this.cursor >= this.history.length - 1) return false;
    this.cursor += 1;
    const step = this.history[this.cursor];
    this.inputs = step.inputs;
    this.roleOverrides = step.roleOverrides;
    return true;
  }

  /** Revert to the base. Treated as a single edit (one undo step). */
  revert(): void {
    if (this.base) {
      this.inputs = this.base;
      this.roleOverrides = {};
      this.pushHistory(this.base, {}, "Revert to base");
    }
  }

  /** Reset everything (used on close). */
  reset(): void {
    this.base = null;
    this.baseName = "(default)";
    this.inputs = null;
    this.roleOverrides = {};
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

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
import { collectContrastFailures } from "../lib/theme/theme-validate";
import {
  buildThemeWire,
  createWire,
  setRoleBinding as wireSetRoleBinding,
  type ThemeWireEnvelope,
  type RoleOverrides,
} from "../lib/theme/theme-wire";
import { TOKENS_BY_VAR } from "../lib/theme/component-tokens";
import { applyTokenPins, isValidPinValue } from "../lib/theme/consumer-bridge";

/** Per-edit history step. `inputs` + `roleOverrides` are complete snapshots
 *  (cheap; <1kB combined). */
export interface HistoryStep {
  readonly inputs: ThemeInputs;
  readonly roleOverrides: RoleOverrides;
  /** Tier-2/3 token pins (cssVar → value) — see setPin(). */
  readonly pins: Record<string, string>;
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

  /** Tier-2/3 token pins — direct values for manifest cssVars (the
   *  studio's TOTAL-control channel, settings-overhaul P3). Validated
   *  against TOKENS_BY_VAR at set time; applied as a cssVars overlay
   *  after resolve and BEFORE the contrast check, so the validator sees
   *  pinned values (the no-reapplyEdits-clone condition). */
  pins = $state.raw<Record<string, string>>({});

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
      const resolved = resolveTheme({
        ...createWire(this.inputs, this.baseName),
        roleOverrides: this.roleOverrides,
      });
      // Pins overlay BEFORE anything reads cssVars — contrastWarnings
      // below must judge the pinned values, not the pre-pin resolve.
      const theme = Object.keys(this.pins).length > 0
        ? {
            ...resolved,
            cssVars: applyTokenPins({ ...(resolved.cssVars as Record<string, string>) }, this.pins, this.inputs?.mode),
          } as ResolvedTheme
        : resolved;
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

  /** Live contrast failures on the CURRENT resolution (R3 studio UX F1:
   *  paper L=0 rendered black-on-black with zero feedback — the contrast
   *  validator only ran in buildTheme, which this resolve path bypasses).
   *  Non-blocking: the chart still renders; StudioShell shows a banner. */
  contrastWarnings = $derived<string[]>(
    this.resolveOutcome.theme
      ? collectContrastFailures(
          this.resolveOutcome.theme.cssVars as Record<string, string>,
        ).map((f) => `${f.name} (${f.ratio.toFixed(2)}:1, needs ${f.minRatio}:1)`)
      : [],
  );

  /** Derived: dirty iff the current state differs from the base. */
  dirty = $derived<boolean>(
    !inputsEqual(this.base, this.inputs) ||
      Object.keys(this.roleOverrides).length > 0 ||
      Object.keys(this.pins).length > 0,
  );

  /** Initialize the store with a base + initial inputs (usually identical). */
  init(
    base: ThemeInputs,
    baseName: string,
    seed?: { roleOverrides?: RoleOverrides; pins?: Record<string, string> },
  ): void {
    this.base = base;
    this.baseName = baseName;
    this.inputs = base;
    // Seed roleOverrides/pins INTO the loaded base (round-2 state review
    // P1): an R-authored / imported theme arrives carrying them via the
    // "Edit in studio" handoff. They must live in history[0] — otherwise
    // the FIRST undo (cursor→0) reverts to an empty base and silently
    // wipes the seeded pins/rebinds, unreachable via redo.
    const roleOverrides = seed?.roleOverrides ?? {};
    const pins = seed?.pins ?? {};
    this.roleOverrides = roleOverrides;
    this.pins = pins;
    this.history = [{ inputs: base, roleOverrides, pins, label: "Loaded" }];
    this.cursor = 0;
  }

  /** Apply an edit to the working copy. Pushes a new history step and
   *  truncates any redo trail. */
  apply(next: ThemeInputs, label: string): void {
    this.inputs = next;
    this.pushHistory(next, this.roleOverrides, this.pins, label);
  }

  /** C53 (wire-audit Pass 4a): drag-time preview — updates the working
   *  copy (cascade re-resolves via the `resolved` derived) WITHOUT
   *  pushing history. Callers commit via apply() on pointer-up so a
   *  slider drag is one undo step, not a hundred. */
  preview(next: ThemeInputs): void {
    this.inputs = next;
  }

  /** The COMPLETE portable theme artifact (settings-overhaul P0): the
   *  canonical wire envelope `{$schema, name, inputs, roleOverrides}`.
   *  Every egress (Copy JSON / download / save-as / studio_done) emits
   *  THIS — never bare `inputs`, which silently dropped the spine
   *  rebinds (the studio exported less than its own UI edited). */
  exportWire(): ThemeWireEnvelope | null {
    if (!this.inputs) return null;
    return buildThemeWire(this.inputs, this.baseName, this.roleOverrides, this.pins);
  }

  /** Pin a manifest token to a direct value (TOTAL control, P3).
   *  Throws on unknown cssVars — typed-by-validation against the
   *  component-token manifest, never a blind string write. */
  setPin(cssVar: string, value: string): void {
    if (!TOKENS_BY_VAR.has(cssVar)) {
      throw new Error(
        `setPin: "${cssVar}" is not in the component-token manifest. ` +
        `Use list_component_tokens() / the inspector to find token names.`,
      );
    }
    // Value grammar gate (round-2 robustness P0): structural chars in a
    // pin value can break out of CSS declarations / SVG attributes in
    // the exported artifact. Same rule as the import + overlay paths.
    if (!isValidPinValue(value)) {
      throw new Error(
        `setPin: invalid value for "${cssVar}" — pin values may not contain ` +
        `angle brackets, braces, semicolons, or double quotes (use single quotes for font lists).`,
      );
    }
    this.pins = { ...this.pins, [cssVar]: value };
    if (this.inputs) {
      this.pushHistory(this.inputs, this.roleOverrides, this.pins, `Pin ${cssVar}`);
    }
  }

  /** Release a token pin back to its derived value. */
  clearPin(cssVar: string): void {
    if (!(cssVar in this.pins)) return;
    const { [cssVar]: _gone, ...rest } = this.pins;
    void _gone;
    this.pins = rest;
    if (this.inputs) {
      this.pushHistory(this.inputs, this.roleOverrides, this.pins, `Unpin ${cssVar}`);
    }
  }

  /** Rebind a role to a (ramp, grade) pair. Used by Spine drag-to-rebind. */
  setRoleBinding(role: RoleName, ramp: RampName, grade: number): void {
    if (!this.inputs) return;
    const wire = { ...createWire(this.inputs, this.baseName), roleOverrides: this.roleOverrides };
    try {
      const next = wireSetRoleBinding(wire, role, ramp, grade);
      this.roleOverrides = next.roleOverrides;
      this.pushHistory(this.inputs, next.roleOverrides, this.pins, `Rebind ${role} → ${ramp}[${grade}]`);
    } catch {
      // Off-ramp role or invalid grade — silently no-op; UI prevents this.
    }
  }

  private pushHistory(
    inputs: ThemeInputs,
    roleOverrides: RoleOverrides,
    pins: Record<string, string>,
    label: string,
  ): void {
    const truncated = this.history.slice(0, this.cursor + 1);
    truncated.push({ inputs, roleOverrides, pins, label });
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
    this.pins = step.pins;
    return true;
  }

  /** Step forward one history entry. Returns true when a step was performed. */
  redo(): boolean {
    if (this.cursor >= this.history.length - 1) return false;
    this.cursor += 1;
    const step = this.history[this.cursor];
    this.inputs = step.inputs;
    this.roleOverrides = step.roleOverrides;
    this.pins = step.pins;
    return true;
  }

  /** Revert to the base. Treated as a single edit (one undo step). */
  revert(): void {
    if (this.base) {
      this.inputs = this.base;
      this.roleOverrides = {};
      this.pins = {};
      this.pushHistory(this.base, {}, {}, "Revert to base");
    }
  }

  /** Reset everything (used on close). */
  reset(): void {
    this.base = null;
    this.baseName = "(default)";
    this.inputs = null;
    this.roleOverrides = {};
    this.pins = {};
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

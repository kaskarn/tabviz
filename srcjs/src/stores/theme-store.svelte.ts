// Theme store — reactive wrapper around ThemeWire (v4 substrate).
//
// Foundation that future settings-panel UI components hook into. Holds
// a wire (`inputs + roleOverrides`) as reactive state; the resolved theme
// is a `$derived` that automatically recomputes on any wire edit.
//
// Migrated to the v4 wire surface during Stage 1 step 3 of the substrate
// sprint. The store exposes the new role-binding API (setRoleBinding,
// pinTokenByName, releaseRole, etc.) — the old dotted-path pin surface
// (pinPath/releasePath/inspect) is removed per Q-P2.1 closure.

import type { ThemeStructure, ThemeInputs } from "../types/theme-inputs";
import type { RoleName, RampName } from "../types/theme-roles";
import type {
  ThemeWire,
  RoleBinding,
  RoleProvenance,
} from "../lib/theme/theme-wire";
import {
  createWire,
  setRoleBinding,
  pinTokenByName,
  releaseRole,
  releaseAllRoles,
  isRolePinned,
  getRoleBinding,
  getRoleProvenance,
  resolveWire,
} from "../lib/theme/theme-wire";

export interface ThemeStore {
  /** Current wire (inputs + roleOverrides). */
  readonly wire: ThemeWire;
  /** Fully-resolved theme (derived from wire). */
  readonly theme: ThemeStructure;

  /** Update a Tier-1 input field (brand, mode, categorical, fonts, …). */
  setInput<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]): void;

  /** Pin a role to a (ramp, grade) pair. */
  setRoleBinding(role: RoleName, ramp: RampName, grade: number): void;
  /** Friendly token-name lookup: pin the source role of a component token. */
  pinTokenByName(tokenName: string, ramp: RampName, grade: number): void;
  /** Release a role's override, falling back to its default binding. */
  releaseRole(role: RoleName): void;
  /** Release all role overrides at once. */
  releaseAllRoles(): void;
  /** True if `role` is currently pinned. */
  isRolePinned(role: RoleName): boolean;
  /** Get the current binding for a role (override if pinned, default otherwise). */
  getRoleBinding(role: RoleName): RoleBinding;
  /** Get the provenance for a role (distinguishes user override from default). */
  getRoleProvenance(role: RoleName): RoleProvenance;

  /** Load a wire (e.g., from a preset). Replaces all current state. */
  load(wire: ThemeWire): void;
  /** Reset to a wire with these inputs and no overrides. */
  reset(inputs: ThemeInputs, name?: string): void;
}

export function createThemeStore(
  initialInputs: ThemeInputs,
  initialName = "custom",
): ThemeStore {
  let wire = $state<ThemeWire>(createWire(initialInputs, initialName));
  const resolved = $derived.by(() => resolveWire(wire));

  return {
    get wire() { return wire; },
    get theme() { return resolved; },

    setInput(key, value) {
      wire = { ...wire, inputs: { ...wire.inputs, [key]: value } };
    },

    setRoleBinding(role, ramp, grade) {
      wire = setRoleBinding(wire, role, ramp, grade);
    },

    pinTokenByName(tokenName, ramp, grade) {
      wire = pinTokenByName(wire, tokenName, ramp, grade);
    },

    releaseRole(role) {
      wire = releaseRole(wire, role);
    },

    releaseAllRoles() {
      wire = releaseAllRoles(wire);
    },

    isRolePinned(role) {
      return isRolePinned(wire, role);
    },

    getRoleBinding(role) {
      return getRoleBinding(wire, role);
    },

    getRoleProvenance(role) {
      return getRoleProvenance(wire, role);
    },

    load(newWire) {
      wire = newWire;
    },

    reset(inputs, name) {
      wire = createWire(inputs, name ?? wire.name);
    },
  };
}

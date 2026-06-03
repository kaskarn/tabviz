// Plain-runtime mirror of theme-store.svelte.ts — for bun test.
// (bun can't run .svelte.ts files directly; this file provides the same
// shape using manual reactivity for testing.)
//
// Migrated to v4 wire surface during Stage 1 step 3 of the substrate sprint.

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

export interface ThemeStoreV3Plain {
  wire: ThemeWire;
  theme: ThemeStructure;

  setInput<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]): void;
  setRoleBinding(role: RoleName, ramp: RampName, grade: number): void;
  pinTokenByName(tokenName: string, ramp: RampName, grade: number): void;
  releaseRole(role: RoleName): void;
  releaseAllRoles(): void;
  isRolePinned(role: RoleName): boolean;
  getRoleBinding(role: RoleName): RoleBinding;
  getRoleProvenance(role: RoleName): RoleProvenance;

  load(wire: ThemeWire): void;
  reset(inputs: ThemeInputs, name?: string): void;
}

export function createThemeStoreV3Plain(
  initialInputs: ThemeInputs,
  initialName = "custom",
): ThemeStoreV3Plain {
  let wire = createWire(initialInputs, initialName);
  let cached = resolveWire(wire);

  function recompute() { cached = resolveWire(wire); }

  return {
    get wire() { return wire; },
    get theme() { return cached; },

    setInput(key, value) {
      wire = { ...wire, inputs: { ...wire.inputs, [key]: value } };
      recompute();
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
      recompute();
    },

    reset(inputs, name) {
      wire = createWire(inputs, name ?? wire.name);
      recompute();
    },
  };
}

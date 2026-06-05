// Pass 0d resolver-dispatch gate.
//
// 0d-i proved the resolverGroup Map dispatch byte-identical to the legacy
// waterfall (token-by-token, 22 presets × 3 modes) before the waterfall
// was deleted in 0d-ii. This file is now the FORWARD lock: a full-cssVars
// snapshot per preset × mode. Any resolver/manifest edit that changes an
// emitted value diffs here first — intentional changes regenerate with
//   bun test src/lib/theme/resolver-dispatch.test.ts --update-snapshots
// and the diff gets reviewed in the commit.

import { describe, it, expect } from "bun:test";
import { PRESETS } from "./theme-presets-inputs";
import { createWire } from "./theme-wire";
import { resolveTheme } from "./resolve-theme";
import { COMPONENT_TOKENS, type ResolverGroup } from "./component-tokens";
import type { ThemeInputs } from "../../types/theme-inputs";

const MODES: Array<ThemeInputs["mode"]> = [
  undefined,
  "high-contrast",
  "reduced-transparency",
];

describe("Pass 0d: full-cssVars snapshot lock (per preset × mode)", () => {
  for (const [name, inputs] of Object.entries(PRESETS)) {
    for (const mode of MODES) {
      it(`${name} / ${mode ?? "standard"}`, () => {
        const wireInputs = mode === undefined ? inputs : { ...inputs, mode };
        const cssVars = resolveTheme(createWire(wireInputs, name)).cssVars;
        expect(cssVars).toMatchSnapshot();
      });
    }
  }
});

describe("Pass 0d manifest invariants", () => {
  it("every manifest entry declares a resolverGroup", () => {
    const missing = COMPONENT_TOKENS.filter(
      (t) => (t.resolverGroup as ResolverGroup | undefined) === undefined,
    );
    expect(missing.map((t) => t.cssVar)).toEqual([]);
  });

  it("every declared resolverGroup resolves without a dispatch bug", () => {
    // Indirect registration check: resolving every preset in every mode
    // (the snapshot suite above) would dev-throw on a Map miss. This
    // assertion makes the invariant explicit for one cheap resolve.
    const first = Object.entries(PRESETS)[0]!;
    expect(() => resolveTheme(createWire(first[1], first[0]))).not.toThrow();
  });
});

// Pass 0d dispatch-parity gate — proves the resolverGroup Map dispatch
// is byte-identical to the legacy waterfall for EVERY manifest token,
// across every preset × every mode (standard / high-contrast /
// reduced-transparency).
//
// 0d-i: both paths exist; this test compares them token-by-token.
// 0d-ii: the waterfall is deleted; the parity half of this file is then
// replaced by a full-cssVars snapshot lock so future resolver edits diff
// against a recorded baseline instead.

import { describe, it, expect } from "bun:test";
import { PRESETS } from "./theme-presets-inputs";
import { createWire } from "./theme-wire";
import {
  resolveTheme,
  resolveTokenValueLegacy,
  _buildResolveCtxForTest,
} from "./resolve-theme";
import { COMPONENT_TOKENS } from "./component-tokens";
import type { ThemeInputs } from "../../types/theme-inputs";

const MODES: Array<ThemeInputs["mode"]> = [
  undefined,
  "high-contrast",
  "reduced-transparency",
];

describe("Pass 0d dispatch parity: Map dispatch ≡ legacy waterfall", () => {
  for (const [name, inputs] of Object.entries(PRESETS)) {
    for (const mode of MODES) {
      it(`${name} / ${mode ?? "standard"}`, () => {
        const wireInputs = mode === undefined ? inputs : { ...inputs, mode };
        const wire = createWire(wireInputs, name);

        // Group path: one resolveTheme call → Map-dispatched values for
        // every token (all entries carry resolverGroup post-0d-i).
        const groupVars = resolveTheme(wire).cssVars;

        // Legacy path: drive the preserved waterfall token-by-token over
        // the same ResolveCtx the manifest walk used.
        const ctx = _buildResolveCtxForTest(wire);
        const mismatches: string[] = [];
        for (const token of COMPONENT_TOKENS) {
          let legacy: string;
          try {
            legacy = resolveTokenValueLegacy(token, ctx);
          } catch (e) {
            mismatches.push(
              `${token.cssVar}: legacy waterfall threw (${(e as Error).message}) ` +
              `but group dispatch returned "${groupVars[token.cssVar]}"`,
            );
            continue;
          }
          const group = groupVars[token.cssVar];
          if (group !== legacy) {
            mismatches.push(
              `${token.cssVar}: group="${group}" legacy="${legacy}" ` +
              `(resolverGroup=${token.resolverGroup})`,
            );
          }
        }
        if (mismatches.length > 0) {
          throw new Error(
            `${mismatches.length} dispatch divergence(s):\n` +
            mismatches.join("\n"),
          );
        }
      });
    }
  }
});

describe("Pass 0d manifest invariants", () => {
  it("every manifest entry declares a resolverGroup", () => {
    const missing = COMPONENT_TOKENS.filter((t) => t.resolverGroup === undefined);
    expect(missing.map((t) => t.cssVar)).toEqual([]);
  });
});

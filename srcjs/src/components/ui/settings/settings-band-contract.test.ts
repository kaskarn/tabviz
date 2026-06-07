/**
 * settings-band-contract.test.ts — DT-11, the boundary-is-real gate
 * (settings-overhaul P2).
 *
 * The settings panel may write Tier-1 inputs (setAuthoringInputs /
 * previewAuthoringInputs), the figure-scoped slice methods (banding,
 * watermark, row pins), and — since theme-rework Wave 2 — the SANCTIONED
 * Tier-2 role-rebind channel (setThemeRoleOverride / clearThemeRoleOverride,
 * the viewer's "safe middle rung"). Those RE-RESOLVE the cascade through the
 * role layer; they are NOT raw T2/3 path WRITES.
 *
 * It must NEVER write a Tier-2/3 component-token PATH — setThemeField /
 * setThemeFieldDerived / writeThemePath / previewThemeField are the studio's
 * (P3) and the deleted tabs' vocabulary. If a control in this tree grows
 * one of those calls, the tier boundary has become cosmetic and the
 * whole overhaul premise is void. (Role rebinding is fine; raw token-path
 * writes are the line.)
 */
import { describe, test, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../../..");          // srcjs/src
const PANEL = path.resolve(__dirname, "../SettingsPanel.svelte");

const FORBIDDEN = [
  /setThemeField\s*\(/,
  // Bracket/computed-member evasion (test-gap audit SURVIVED-3b): catch
  // store["setThemeField"] / store['set'+'ThemeField'] too — the gate
  // proves no T2/3 WRITE, not merely no literal call text.
  /setThemeField['"\]]/,
  /setThemeFieldDerived\s*\(/,
  /setThemeFieldDerived['"\]]/,
  /writeThemePath\s*\(/,
  /previewThemeField\s*\(/,
];

const ALIAS: Record<string, string> = {
  $components: path.join(SRC, "components"),
  $lib: path.join(SRC, "lib"),
  $stores: path.join(SRC, "stores"),
  $types: path.join(SRC, "types"),
  $svelte: path.join(SRC, "svelte"),
};

function srcOf(p: string): string {
  return readFileSync(p, "utf8").replace(/<!--[\s\S]*?-->/g, "");
}

/** Resolve an import specifier to an on-disk .svelte path, or null if it
 *  isn't a Svelte component (we only police the component tree). */
function resolveSvelte(spec: string, fromFile: string): string | null {
  let base: string | null = null;
  if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else {
    for (const [k, v] of Object.entries(ALIAS)) {
      if (spec === k || spec.startsWith(k + "/")) { base = v + spec.slice(k.length); break; }
    }
  }
  if (!base) return null;
  for (const cand of [base, base + ".svelte"]) {
    if (cand.endsWith(".svelte") && existsSync(cand)) return cand;
  }
  return null;
}

/** Every .svelte file SettingsPanel transitively mounts. The directory
 *  glob (settings/*.svelte) had a blind spot (test-gap audit SURVIVED-3a):
 *  a control authored OUTSIDE settings/ and imported into the panel
 *  passed clean. Walking the real import graph closes it — the boundary
 *  is enforced by what the panel ACTUALLY mounts, not by directory. */
function transitiveSvelteImports(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  const importRe = /\bimport\s+[^;'"]*?from\s*["']([^"']+)["']/g;
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = srcOf(file);
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(src)) !== null) {
      const resolved = resolveSvelte(m[1], file);
      if (resolved && !seen.has(resolved)) stack.push(resolved);
    }
  }
  return [...seen];
}

describe("DT-11: the settings tree writes no Tier-2/3 theme paths", () => {
  const files = transitiveSvelteImports(PANEL);

  test("the import walk actually reaches the bands (sanity)", () => {
    const names = files.map((f) => path.basename(f));
    // If these aren't reached, the walk is broken and the gate is blind.
    expect(names).toContain("ThemeBand.svelte");
    expect(names).toContain("FigureBand.svelte");
    expect(names).toContain("Tier1Sections.svelte");
  });

  for (const file of files) {
    test(`${path.relative(SRC, file)} is Tier-1/figure-scoped only`, () => {
      const src = srcOf(file);
      for (const pat of FORBIDDEN) {
        expect(src).not.toMatch(pat);
      }
    });
  }

  test("the panel mounts no resurrected tab apparatus", () => {
    const src = srcOf(PANEL);
    expect(src).not.toMatch(/TabSelect|TabBar|activeTabId|scroll-fade/);
  });
});

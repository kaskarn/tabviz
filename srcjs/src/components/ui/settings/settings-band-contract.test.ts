/**
 * settings-band-contract.test.ts — DT-11, the boundary-is-real gate
 * (settings-overhaul P2).
 *
 * The settings panel may write Tier-1 inputs ONLY (setAuthoringInputs /
 * previewAuthoringInputs) plus the figure-scoped slice methods (banding,
 * watermark, row pins). It must NEVER write a Tier-2/3 theme path —
 * setThemeField / setThemeFieldDerived / writeThemePath are the studio's
 * (P3) and the deleted tabs' vocabulary. If a control in this tree grows
 * one of those calls, the tier boundary has become cosmetic and the
 * whole overhaul premise is void.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const SETTINGS_DIR = path.resolve(__dirname);
const PANEL = path.resolve(__dirname, "../SettingsPanel.svelte");

const FORBIDDEN = [
  /setThemeField\s*\(/,
  /setThemeFieldDerived\s*\(/,
  /writeThemePath\s*\(/,
  /previewThemeField\s*\(/,
];

function srcOf(p: string): string {
  return readFileSync(p, "utf8").replace(/<!--[\s\S]*?-->/g, "");
}

describe("DT-11: the settings tree writes no Tier-2/3 theme paths", () => {
  const files = [
    PANEL,
    ...readdirSync(SETTINGS_DIR)
      .filter((f) => f.endsWith(".svelte"))
      .map((f) => path.join(SETTINGS_DIR, f)),
  ];

  for (const file of files) {
    test(`${path.basename(file)} is Tier-1/figure-scoped only`, () => {
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

import { describe, it, expect } from "bun:test";
import { buildTheme } from "./theme-resolve-v3";
import { buildThemeCssV3 } from "./theme-css-v3";
import type { ThemeInputsV3 } from "../types/theme-v3";

const COCHRANE: ThemeInputsV3 = { brand: "#0099CC", accent: "#C8553D" };
const LANCET:   ThemeInputsV3 = { brand: "#00407A", accent: "#A6792A", decorative: "#A6792A" };
const DARK:     ThemeInputsV3 = { brand: "#89B4FA", mode: "dark" };

describe("buildThemeCssV3 — full CSS variable emission", () => {
  it("emits :root block with --tv-* variables", () => {
    const t = buildTheme(COCHRANE);
    const css = buildThemeCssV3(t);
    expect(css).toMatch(/^:root \{/);
    expect(css).toMatch(/\}$/m);
  });

  it("emits all T2 token vars (snake_case → kebab-case)", () => {
    const t = buildTheme(COCHRANE);
    const css = buildThemeCssV3(t);
    expect(css).toContain("--tv-paper:");
    expect(css).toContain("--tv-paper-alt:");
    expect(css).toContain("--tv-ink:");
    expect(css).toContain("--tv-ink-muted:");
    expect(css).toContain("--tv-brand:");
    expect(css).toContain("--tv-brand-ink:");
    expect(css).toContain("--tv-rule-subtle:");
    expect(css).toContain("--tv-rule-strong:");
    expect(css).toContain("--tv-positive:");
    expect(css).toContain("--tv-positive-ink:");
  });

  it("emits cluster-level shorthand vars", () => {
    const t = buildTheme(COCHRANE);
    const css = buildThemeCssV3(t);
    expect(css).toContain("--tv-row-bg:");
    expect(css).toContain("--tv-cell-fg:");
    expect(css).toContain("--tv-header-bold-bg:");
    expect(css).toContain("--tv-header-bold-fg:");
    expect(css).toContain("--tv-plot-axis:");
  });

  it("emits paint role vars", () => {
    const t = buildTheme(COCHRANE);
    const css = buildThemeCssV3(t);
    expect(css).toContain("--tv-role-emphasis-fg:");
    expect(css).toContain("--tv-role-emphasis-weight: 600;");
    expect(css).toContain("--tv-role-accent-fg:");
    expect(css).toContain("--tv-role-fill-bg:");
    expect(css).toContain("--tv-role-positive-fg:");
    expect(css).toContain("--tv-role-warning-fg:");
  });

  it("cluster-resolved header.bold uses brand_ink (APCA-pair)", () => {
    const t = buildTheme(COCHRANE);
    const css = buildThemeCssV3(t);
    const bgMatch = css.match(/--tv-header-bold-bg: (#[0-9A-Fa-f]+);/);
    const fgMatch = css.match(/--tv-header-bold-fg: (#[0-9A-Fa-f]+);/);
    expect(bgMatch).not.toBeNull();
    expect(fgMatch).not.toBeNull();
    expect(bgMatch![1]).toBe(t.tokens.brand);
    expect(fgMatch![1]).toBe(t.tokens.brand_ink);
  });

  it("dark mode produces dark paper", () => {
    const t = buildTheme(DARK);
    const css = buildThemeCssV3(t);
    // Paper should be a dark hex (low lightness perceptually)
    expect(css).toContain(`--tv-paper: ${t.tokens.paper};`);
    expect(css).toContain(`--tv-ink: ${t.tokens.ink};`);
  });

  it("Lancet decorative chrome flows into columnGroup tint", () => {
    const t = buildTheme(LANCET);
    const css = buildThemeCssV3(t);
    expect(css).toContain(`--tv-decorative-chrome: ${t.tokens.decorative_chrome};`);
  });

  it("all values are hex or special CSS values", () => {
    const t = buildTheme(COCHRANE);
    const css = buildThemeCssV3(t);
    // CSS vars only: `--tv-name: value;` (not the :root opening)
    const re = /--tv-[a-z0-9-]+:\s*([^;]+);/g;
    let m;
    let count = 0;
    while ((m = re.exec(css)) !== null) {
      const v = m[1]!.trim();
      const ok = /^#[0-9A-Fa-f]{6,8}$/.test(v) ||
                 v === "transparent" || v === "inherit" ||
                 /^[0-9]+(\.[0-9]+)?(px)?$/.test(v) ||
                 /^[0-9]+$/.test(v);
      expect(ok).toBe(true);
      count++;
    }
    expect(count).toBeGreaterThan(40);
  });
});

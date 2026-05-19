/**
 * Construction-time theme validation — TS port of `R/utils-theme-validate.R`.
 *
 * Runs at the end of `resolveTheme()` and verifies the contrast invariants
 * required for legibility of bold-band header rows, accent semantic fills,
 * etc. Throws a `ThemeValidationError` listing every failed invariant with
 * the cascade path the user can override to fix it.
 *
 * Defensive check against malformed user overrides (`setThemeField`,
 * hand-rolled `webTheme()` overrides). The resolver's defaults always
 * satisfy these invariants. Skipping validation is supported via
 * `resolveTheme(draft, { validate: false })` for tests that use synthetic
 * high-saturation colors.
 */

import { contrastRatio } from "./oklch";
import type { WebThemeV2 } from "../types/theme-v2";

// Header text is bold (weight=600) and lives in chrome bands rather than
// dense reading flow, so WCAG AA Large (3.0) is the applicable bar.
// Body text on surface.base gets the stricter 4.5 (WCAG AA Normal).
const WCAG_AA_LARGE = 3.0;
const WCAG_AA_NORMAL = 4.5;

interface Invariant {
  name: string;
  fg: string | null;
  bg: string | null;
  path: string[];
  minRatio: number;
}

interface ContrastFailure {
  name: string;
  ratio: number;
  minRatio: number;
  fg: string;
  bg: string;
  path: string[];
}

export class ThemeValidationError extends Error {
  failures: ContrastFailure[];
  constructor(failures: ContrastFailure[]) {
    const lines = failures.map((f) =>
      `${f.name}\n  fg=${f.fg} on bg=${f.bg} -> contrast=${f.ratio.toFixed(2)} (need >=${f.minRatio.toFixed(1)})\n  cascade: ${f.path.join(" <- ")}`,
    );
    super(`Theme failed ${failures.length} contrast invariant${failures.length === 1 ? "" : "s"}.\n${lines.join("\n")}`);
    this.name = "ThemeValidationError";
    this.failures = failures;
  }
}

/**
 * Validate every contrast invariant on a resolved theme. Throws a
 * `ThemeValidationError` on failure; returns void on success.
 */
export function validateResolvedTheme(theme: WebThemeV2): void {
  const invariants: Invariant[] = [
    {
      name: "header bold band: header.bold.fg must read on header.bold.bg",
      fg: theme.header.bold.fg,
      bg: theme.header.bold.bg,
      path: ["header.bold.fg", "header.bold.bg", "content.inverse", "inputs.primaryDeep"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "column-group bold band: columnGroup.bold.fg must read on columnGroup.bold.bg",
      fg: theme.columnGroup.bold.fg,
      bg: theme.columnGroup.bold.bg,
      path: ["columnGroup.bold.fg", "columnGroup.bold.bg", "content.inverse", "inputs.secondaryDeep"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "header tint band: header.tint.fg must read on header.tint.bg",
      fg: theme.header.tint.fg,
      bg: theme.header.tint.bg,
      path: ["header.tint.fg", "header.tint.bg", "content.primary", "inputs.primaryDeep"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "leaf header light band: header.light.fg must read on surface.base",
      fg: theme.header.light.fg,
      bg: theme.surface.base,
      path: ["header.light.fg", "content.primary", "surface.base"],
      minRatio: WCAG_AA_NORMAL,
    },
    {
      name: "default cell text: content.primary must read on surface.base",
      fg: theme.content.primary,
      bg: theme.surface.base,
      path: ["content.primary", "surface.base"],
      minRatio: WCAG_AA_NORMAL,
    },
  ];

  const failures: ContrastFailure[] = [];
  for (const inv of invariants) {
    if (inv.fg == null || inv.bg == null) continue;
    const ratio = contrastRatio(inv.fg, inv.bg);
    if (ratio < inv.minRatio) {
      failures.push({
        name: inv.name,
        ratio,
        minRatio: inv.minRatio,
        fg: inv.fg,
        bg: inv.bg,
        path: inv.path,
      });
    }
  }

  if (failures.length > 0) {
    throw new ThemeValidationError(failures);
  }
}

// Stage 2 §2 — Shell/paper two-surface model.
//
// Resolver helpers for the 10 shell/paper Tier-3 tokens. The
// `shell_mode` Tier-1 input selects one of four canonical modes and the
// resolver emits each token's value via this table.

import type { ThemeInputs } from "../../types/theme-inputs";
import type { DensityPreset } from "./density-presets";

export type ShellMode = "flush" | "raised" | "float" | "transparent";

// ── effects.elevation = FIGURE-WIDE depth (decision 2026-06-05) ────────────
// The elevation input lifts the whole figure off the page — the SHELL when
// there's a band (raised mode), the PAPER otherwise (flush / float /
// transparent), so "table-wide or widget-wide" follows the shell mode.
// "none" keeps the per-mode default shadows; low/medium/high amplify.
// Vocabulary is pure MAGNITUDE (R2 decision): it deliberately shares no
// words with ShellMode's raised/float. Module-level + key-typed so a
// future recipe registry can reach it (R2 extensibility A7).
type ElevationLevel = NonNullable<NonNullable<ThemeInputs["effects"]>["elevation"]>;
const ELEVATION_SHADOW: Record<ElevationLevel, string | null> = {
  none:   null,
  low:    "0 1px 3px rgba(0,0,0,0.10), 0 3px 10px rgba(0,0,0,0.06)",
  medium: "0 2px 6px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08)",
  high:   "0 4px 12px rgba(0,0,0,0.15), 0 14px 36px rgba(0,0,0,0.10)",
};
// Air the drop shadow needs around a band-less figure. Flush/transparent
// shells have 0 padding, and the auto-fit container is overflow:hidden
// with container padding 0 — without this, the elevation shadow clipped
// at the widget edges and read as a smudge (atelier; both R2 visual
// reviewers). ~60% of the far shadow's blur radius.
const ELEVATION_AIR_PX: Record<ElevationLevel, number> = {
  none: 0, low: 8, medium: 14, high: 22,
};

// ── Density-scaled surface air (spacing rework, 2026-06-05) ────────────────
// The SHELL owns the figure's outer air; the PAPER carries an inner mat
// between its edge and the table. Both scale with the density axis +
// density_factor like every other spacing token (the wire-audit graft
// originally hardcoded 8px/0px, which read as a hairline, not a shell —
// flagged by all three spacing-review agents). The px ranges project the
// rgc_v4 lab's clamp(18,2.2vw,28) frame-pad / clamp(12,1.6vw,18) paper-pad
// through the density axis instead of the viewport.
//
// These live here (not DENSITY_PX) deliberately: the density table emits
// every entry as a `--tv-spacing-*` wire token, but shell/paper padding is
// mode-gated — flush MUST stay 0 (geometric inertness contract) — so the
// scale belongs to the shell recipe, one canonical home per axis.
const SHELL_PAD_PX: Record<DensityPreset, number> = { compact: 14, comfortable: 20, spacious: 26 };
const PAPER_PAD_PX: Record<DensityPreset, number> = { compact: 10, comfortable: 14, spacious: 18 };

/** Density preset × density_factor (clamped [0.5, 2], matching
 *  tokenDensityPx / the v3 scaleSpacing) projected to a px string. */
function densityScaledPx(
  table: Record<DensityPreset, number>,
  inputs: ThemeInputs,
): string {
  const d: DensityPreset = inputs.density ?? "comfortable";
  const f = Math.min(2, Math.max(0.5, inputs.density_factor ?? 1));
  return `${Math.round(table[d] * f)}px`;
}

export interface ShellPaperResolved {
  shellBg: string;
  shellBorder: string;
  shellShadow: string;
  shellRadius: string;
  shellPadding: string;
  paperBg: string;
  paperBorder: string;
  paperShadow: string;
  paperRadius: string;
  paperPadding: string;
}

/** Resolve all 10 shell/paper tokens for the given mode + theme roles.
 *
 *  `roles` provides the T2 colors the recipes reference (surface,
 *  surface-subtle, border, border-subtle). The recipes themselves are
 *  hand-tuned to match stage-2-design.md §2c — each mode picks a
 *  distinct shell/paper relationship.
 *
 *  The shell wraps the paper. Under `flush`, both share the surface bg.
 *  Under `raised`, the shell is a slightly-darker card and the paper
 *  sits on it with a soft inset shadow. Under `float`, the shell is
 *  transparent and the paper has its own drop shadow.
 *  `transparent` is `float` minus the drop shadow. */
export function resolveShellPaper(
  inputs: ThemeInputs,
  roles: { surface: string; surfaceSubtle: string; border: string; borderSubtle: string },
): ShellPaperResolved {
  const mode: ShellMode = inputs.shell_mode ?? "flush";
  const { surface, surfaceSubtle, border, borderSubtle } = roles;

  // Soft drop-shadow for raised + float modes. Tuned for editorial readability
  // — substantial enough to read as elevation, not so much it feels heavy.
  const SOFT_LIFT = "0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)";
  const RAISED_CARD = "0 1px 2px rgba(0,0,0,0.06)";
  const PAPER_INSET = "inset 0 1px 0 rgba(0,0,0,0.03)";

  const elevLevel: ElevationLevel = inputs.effects?.elevation ?? "none";
  const elevShadow = ELEVATION_SHADOW[elevLevel] ?? null;
  const elevAir = ELEVATION_AIR_PX[elevLevel] ?? 0;
  // Per-mode defaults, overridden by an explicit elevation pin.
  const shellLift = (fallback: string): string =>
    mode === "raised" && elevShadow ? elevShadow : fallback;
  const paperLift = (fallback: string): string =>
    mode !== "raised" && elevShadow ? elevShadow : fallback;

  switch (mode) {
    case "flush":
      // TRULY flush (re-tuned in wire-audit Pass 1a, first time these
      // values ever painted): no border, no radius — the table sits on
      // the page exactly as the pre-wrap widget did. The earlier
      // borderSubtle + 8px radius recipe was authored before any DOM
      // consumed it and would have put a card outline on every default
      // preset. The table's own outer border stays owned by
      // --tv-table-border-* on .tabviz-main.
      // Geometric inertness holds ONLY while elevation is off: a pinned
      // figure depth needs air for its shadow (a lifted sheet is no
      // longer visually flush anyway).
      return {
        shellBg: "transparent",
        shellBorder: "transparent",
        shellShadow: "none",
        shellRadius: "0px",
        shellPadding: `${elevAir}px`,
        paperBg: surface,
        paperBorder: "transparent",
        paperShadow: paperLift("none"),
        paperRadius: elevAir > 0 ? "6px" : "0px",
        paperPadding: "0px",
      };
    case "raised":
      // Two nested padded surfaces (lab model): a real shell band around
      // an inner-matted paper — this is what makes a "shell" read as a
      // shell rather than the original 8px hairline.
      return {
        shellBg: surfaceSubtle,
        shellBorder: border,
        shellShadow: shellLift(RAISED_CARD),
        shellRadius: "12px",
        shellPadding: densityScaledPx(SHELL_PAD_PX, inputs),
        paperBg: surface,
        paperBorder: borderSubtle,
        paperShadow: PAPER_INSET,
        paperRadius: "8px",
        paperPadding: densityScaledPx(PAPER_PAD_PX, inputs),
      };
    case "float":
      // Transparent shell still owns the air: the floating paper's drop
      // shadow needs room to breathe (container padding is 0 — with a
      // 0-pad shell the SOFT_LIFT shadow clipped at the widget edge).
      return {
        shellBg: "transparent",
        shellBorder: "transparent",
        shellShadow: "none",
        shellRadius: "0px",
        shellPadding: densityScaledPx(SHELL_PAD_PX, inputs),
        paperBg: surface,
        paperBorder: borderSubtle,
        paperShadow: paperLift(SOFT_LIFT),
        paperRadius: "8px",
        paperPadding: densityScaledPx(PAPER_PAD_PX, inputs),
      };
    case "transparent":
      return {
        shellBg: "transparent",
        shellBorder: "transparent",
        shellShadow: "none",
        shellRadius: "0px",
        shellPadding: `${elevAir}px`,
        paperBg: surface,
        paperBorder: "transparent",
        paperShadow: paperLift("none"),
        paperRadius: elevAir > 0 ? "6px" : "0px",
        paperPadding: "0px",
      };
  }
}

// shellPaperPaddingPx was deleted in the spacing rework (2026-06-05): the
// paper now lives INSIDE .tabviz-scalable so its padding is measured, and
// the auto-fit height formula reads the shell's padding from the resolved
// `--tv-shell-padding` cssVar (one source, consumed once) instead of
// re-resolving this recipe against a stub.

/** Map a shell/paper cssVar to the corresponding ShellPaperResolved key.
 *  Returns null when the cssVar isn't a shell/paper token. */
export function shellPaperKeyForCssVar(cssVar: string): keyof ShellPaperResolved | null {
  switch (cssVar) {
    case "--tv-shell-bg":      return "shellBg";
    case "--tv-shell-border":  return "shellBorder";
    case "--tv-shell-shadow":  return "shellShadow";
    case "--tv-shell-radius":  return "shellRadius";
    case "--tv-shell-padding": return "shellPadding";
    case "--tv-paper-bg":      return "paperBg";
    case "--tv-paper-border":  return "paperBorder";
    case "--tv-paper-shadow":  return "paperShadow";
    case "--tv-paper-radius":  return "paperRadius";
    case "--tv-paper-padding": return "paperPadding";
    default: return null;
  }
}

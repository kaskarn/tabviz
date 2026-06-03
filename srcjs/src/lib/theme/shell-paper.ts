// Stage 2 §2 — Shell/paper two-surface model.
//
// Resolver helpers for the 10 shell/paper Tier-3 tokens. The
// `shell_mode` Tier-1 input selects one of four canonical modes and the
// resolver emits each token's value via this table.

import type { ThemeInputs } from "../../types/theme-inputs";

export type ShellMode = "flush" | "raised" | "float" | "transparent";

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

  switch (mode) {
    case "flush":
      return {
        shellBg: "transparent",
        shellBorder: "transparent",
        shellShadow: "none",
        shellRadius: "0px",
        shellPadding: "0px",
        paperBg: surface,
        paperBorder: borderSubtle,
        paperShadow: "none",
        paperRadius: "8px",
        paperPadding: "0px",
      };
    case "raised":
      return {
        shellBg: surfaceSubtle,
        shellBorder: border,
        shellShadow: RAISED_CARD,
        shellRadius: "12px",
        shellPadding: "8px",
        paperBg: surface,
        paperBorder: borderSubtle,
        paperShadow: PAPER_INSET,
        paperRadius: "8px",
        paperPadding: "0px",
      };
    case "float":
      return {
        shellBg: "transparent",
        shellBorder: "transparent",
        shellShadow: "none",
        shellRadius: "0px",
        shellPadding: "0px",
        paperBg: surface,
        paperBorder: borderSubtle,
        paperShadow: SOFT_LIFT,
        paperRadius: "8px",
        paperPadding: "0px",
      };
    case "transparent":
      return {
        shellBg: "transparent",
        shellBorder: "transparent",
        shellShadow: "none",
        shellRadius: "0px",
        shellPadding: "0px",
        paperBg: surface,
        paperBorder: "transparent",
        paperShadow: "none",
        paperRadius: "0px",
        paperPadding: "0px",
      };
  }
}

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

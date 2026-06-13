// Role → "what element does this paint" hint for the Styling tab role
// pickers. The user's complaint: it's illegible which role maps to which
// table element. The mapping ALREADY EXISTS as per-token `description`
// strings in the component-tokens manifest (e.g. "Cell horizontal divider
// color", "Alternating (zebra) row background fill") — they were just never
// surfaced in the editing UI. This derives the hint from the manifest (the
// role's first representative token), so it stays accurate as the manifest
// evolves, with curated overrides where the raw description reads as
// internal jargon or the role has no backing token (computed/indirect).
//
// Added for the maintainer-feedback pass (2026-06-13).

import { TOKENS_BY_ROLE } from "$lib/theme/component-tokens";
import type { RoleName } from "$types/theme-roles";

// Where the first manifest token's description isn't the clearest element
// mapping, or the role is computed/indirect (no token).
const ROLE_HINT_OVERRIDES: Partial<Record<string, string>> = {
  accent: "Interactive emphasis — hover, selection, callouts, status-info.",
  brand: "The primary brand identity color.",
  text: "Default body / cell / row text color.",
  "text-muted": "Muted secondary text — captions, secondary labels.",
  border: "Generic divider / border color.",
};

// Derive a hint for computed roles with no manifest token, from the role's
// naming convention (series-N-fill/stroke, status -text/-fill/-solid…).
function patternHint(role: string): string | undefined {
  const s = role.match(/^series-(\d)-(fill|stroke)$/);
  if (s) return `Data series ${s[1]} ${s[2]} color.`;
  const suffixes: [string, string][] = [
    ["-text", "text"], ["-fill", "fill"], ["-solid", "solid color"],
    ["-stroke", "stroke"], ["-border", "border"], ["-hover", "hover color"],
  ];
  for (const [suf, word] of suffixes) {
    if (role.endsWith(suf)) return `The ${role.slice(0, -suf.length)} ${word}.`;
  }
  return undefined;
}

/** A short, human "this paints element X" hint for a role, or undefined if
 *  none is known (the caller then shows no hint). */
export function roleElementHint(role: string): string | undefined {
  if (role in ROLE_HINT_OVERRIDES) return ROLE_HINT_OVERRIDES[role];
  const desc = (TOKENS_BY_ROLE.get(role as RoleName) ?? [])[0]?.description;
  if (desc) {
    // Drop the internal "Mirrors role:… — use for …" jargon tail; keep the
    // leading human sentence.
    return desc.split(/\.\s*Mirrors /)[0]!.trim().replace(/\.$/, "");
  }
  return patternHint(role);
}

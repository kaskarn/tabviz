// Stage 3 §2c — Element → token attribution.
//
// Maps semantic element kinds (in widget renderer code) to the cssVar name
// they're painted by. Used by:
// - DOM + SVG renderers to emit `data-tv-token="..."` attributes
// - Cascade Inspector to identify the token painting a clicked element
// - Spine UI hover-wire animation to light up consumers of a hovered role
//
// The attribute value is the cssVar name WITHOUT the `--tv-` prefix
// (saves on bytes in markup; the Inspector reattaches the prefix when
// looking up in COMPONENT_TOKENS).

/** Bare token names (no `--tv-` prefix) attributed to widget element kinds. */
export const ELEMENT_TOKEN_ATTRIBUTION = {
  // Surface chrome
  "shell":          "shell-bg",
  "paper":          "paper-bg",

  // Row state
  "row-base":       "row-base-bg",
  "row-alt":        "row-alt-bg",
  "row-hover":      "row-hover-bg",
  "row-selected":   "row-selected-bg",
  "row-emphasis":   "row-emphasis-bg",

  // Cells
  "cell-bg":        "cell-bg",
  "cell-fg":        "cell-fg",
  "cell-border":    "cell-border",

  // Header
  "header-bg":      "header-light-bg",
  "header-fg":      "header-light-fg",
  "header-rule":    "header-light-rule",

  // Plot scaffold
  "axis-line":      "plot-axis-line",
  "tick-mark":      "plot-tick-mark",
  "axis-label":     "text-muted",
  "tick-label":     "text-muted",

  // Text roles
  "title":          "text-title-fg",
  "subtitle":       "text-muted",
  "caption":        "text-muted",
  "footnote":       "text-footnote-fg",

  // Accent
  "accent":         "accent",
  "badge":          "accent",
} as const;

export type ElementKind = keyof typeof ELEMENT_TOKEN_ATTRIBUTION;

/** Look up the bare token name for an element kind. */
export function tokenForElement(kind: ElementKind): string {
  return ELEMENT_TOKEN_ATTRIBUTION[kind];
}

/** Build the HTML/SVG attribute pair for an element kind. Useful in
 *  template-literal contexts:
 *
 *  ```ts
 *  `<rect ${dataTvTokenAttr("row-base")} fill="..."/>`
 *  ```
 */
export function dataTvTokenAttr(kind: ElementKind): string {
  return `data-tv-token="${tokenForElement(kind)}"`;
}

/** Reverse lookup: given a bare token name, find all element kinds that
 *  paint with it. Used by the Spine UI's hover-wire animation. */
export function elementsForToken(bareTokenName: string): readonly ElementKind[] {
  const out: ElementKind[] = [];
  for (const [kind, token] of Object.entries(ELEMENT_TOKEN_ATTRIBUTION) as [ElementKind, string][]) {
    if (token === bareTokenName) out.push(kind);
  }
  return out;
}

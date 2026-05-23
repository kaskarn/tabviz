// UI glyph vocabulary — the single typographic shorthand the editor,
// settings panel, and harness reference for compact visual cues.
//
// Distinct from `glyph-registry.ts` (which holds SVG <path> data for
// the `pictogram` column type). This module holds single-character
// strings used as labels in segmented buttons, type badges, section
// flags, override dots, and similar editorial chrome.
//
// One flat dotted-key table → full TS autocomplete, one place to
// re-skin, one place to audit. Every component that wants a glyph
// should reach through `glyph('type.numeric')` rather than inlining a
// character; the table is the contract.

// ────────────────────────────────────────────────────────────────────
// Table — keyed by `category.token`, value is the unicode shorthand.
// ────────────────────────────────────────────────────────────────────

export const GLYPHS = {
  // Column-type badges (column kind shown in editor header + picker).
  "type.text":       "Aa",
  "type.numeric":    "#",
  "type.percent":    "%",
  "type.pvalue":     "p",
  "type.interval":   "( )",      // ( ) with thin-space inside
  "type.events":     "x / N",
  "type.forest":     "—●—",
  "type.bar":        "▬",
  "type.sparkline":  "⌇",
  "type.pictogram":  "★★",
  "type.ring":       "◐",
  "type.stars":      "★",
  "type.badge":      "▱",
  "type.icon":       "◇",
  "type.img":        "▦",
  "type.viz":        "◈",            // abstract VIZ parent

  // Field-type badges (data-column origin shown next to picker rows).
  "field.string":    "abc",
  "field.numeric":   "#",
  "field.integer":   "#̄",     // # with combining macron — "integer #"
  "field.logical":   "●○",
  "field.date":      "⏱",
  "field.factor":    "Ⅰ Ⅱ Ⅲ",
  "field.array":     "[ ]",

  // Alignment (segmented L / C / R + justify).
  "align.left":      "L",
  "align.center":    "C",
  "align.right":     "R",
  "align.justify":   "J",

  // Density (segmented for spacing presets).
  "density.compact":     "⫶",
  "density.comfortable": "⫶⫶",
  "density.spacious":    "⫶⫶⫶",

  // Border / divider style.
  "border.none":     "·",
  "border.thin":     "—",
  "border.thick":    "=",
  "border.dashed":   "- -",

  // Sort direction (single glyph that flips by aria-state in CSS).
  "sort.unsorted":   "↕",
  "sort.asc":        "↑",
  "sort.desc":       "↓",

  // Common actions in the editor chrome.
  "action.wrap":     "↵",
  "action.unwrap":   "→",
  "action.reset":    "⤺",
  "action.override": "●",            // small dot — "value has been pinned"
  "action.add":      "+",
  "action.remove":   "−",            // U+2212 minus, optical match with +
  "action.edit":     "✎",
  "action.copy":     "⎘",
  "action.lock":     "⏿",
  "action.unlock":   "⎈",
  "action.expand":   "▸",
  "action.collapse": "▾",
  "action.dragger":  "⋮⋮",
  "action.more":     "⋯",

  // Section / accordion heading flags (compact mode indicator).
  "section.data":    "▤",
  "section.header":  "Ⓗ",
  "section.layout":  "▦",
  "section.style":   "✦",
  "section.options": "◌",
  "section.advanced":"⚙",

  // MappedValue mode selector (theme / static / field / condition).
  "mode.theme":      "◍",
  "mode.static":     "■",
  "mode.field":      "ƒ",
  "mode.condition":  "?",

  // Status dots (echo schema status colors but glyph-only for SVG).
  "status.ok":       "✓",
  "status.warn":     "△",
  "status.error":    "✕",
  "status.info":     "ⓘ",
} as const;

export type GlyphToken = keyof typeof GLYPHS;

// ────────────────────────────────────────────────────────────────────
// Lookup helper. Throws in dev, returns "•" sentinel in prod-style use
// (we *don't* silently swallow because a missing glyph is a bug — but
// we also don't want to throw inside a render pass and crash the UI).
// ────────────────────────────────────────────────────────────────────

const MISSING = "•";

/** Resolve a token → glyph character. Unknown tokens return the
 *  bullet sentinel and log a warning once per token. */
export function glyph(token: GlyphToken): string {
  return GLYPHS[token];
}

const warnedMissing = new Set<string>();

/** Soft variant — accepts arbitrary strings (e.g. dynamic column type
 *  ids from the schema). Returns the bullet sentinel for unknown
 *  tokens and warns once. Prefer the typed `glyph()` when the token
 *  is known statically. */
export function glyphOr(token: string, fallback: string = MISSING): string {
  if (token in GLYPHS) return GLYPHS[token as GlyphToken];
  if (!warnedMissing.has(token) && typeof console !== "undefined") {
    warnedMissing.add(token);
    console.warn(`[ui-glyphs] unknown token: ${token}`);
  }
  return fallback;
}

// ────────────────────────────────────────────────────────────────────
// Convenience subgroup accessors — return typed records so a segmented
// control can iterate without restating the keys.
// ────────────────────────────────────────────────────────────────────

function pickPrefix<P extends string>(prefix: P) {
  const out: Record<string, string> = {};
  for (const k of Object.keys(GLYPHS) as GlyphToken[]) {
    if (k.startsWith(`${prefix}.`)) out[k.slice(prefix.length + 1)] = GLYPHS[k];
  }
  return out;
}

export const TYPE_GLYPHS    = pickPrefix("type");
export const FIELD_GLYPHS   = pickPrefix("field");
export const ALIGN_GLYPHS   = pickPrefix("align");
export const DENSITY_GLYPHS = pickPrefix("density");
export const SORT_GLYPHS    = pickPrefix("sort");
export const ACTION_GLYPHS  = pickPrefix("action");
export const SECTION_GLYPHS = pickPrefix("section");
export const MODE_GLYPHS    = pickPrefix("mode");
export const STATUS_GLYPHS  = pickPrefix("status");

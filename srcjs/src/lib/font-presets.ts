/**
 * Curated font-family presets for the settings-panel font picker.
 *
 * Each preset is a CSS font-family stack: the named font first, then
 * graceful fallbacks across macOS / Windows / Linux. The runtime never
 * `@import`s web fonts — if the named font isn't installed locally,
 * the next stack entry takes over. CRAN-friendly, offline-friendly.
 *
 * Authors who want a specific web font can use the picker's
 * "Custom..." option and load the font themselves (CSS link, etc.).
 */

export interface FontPreset {
  /** Display name shown in the dropdown. */
  name: string;
  /** Full CSS font-family stack written to `theme.typography.fontFamily`. */
  stack: string;
  /** Optional short blurb shown next to the name (kept terse). */
  hint?: string;
}

export const FONT_PRESETS: readonly FontPreset[] = [
  {
    name: "System UI",
    stack: "system-ui, -apple-system, sans-serif",
    hint: "OS default",
  },
  {
    name: "Inter",
    stack: "Inter, system-ui, sans-serif",
  },
  {
    name: "Source Sans Pro",
    stack: "'Source Sans Pro', 'Segoe UI', Roboto, sans-serif",
  },
  {
    name: "Helvetica Neue",
    stack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  {
    name: "Arial",
    stack: "Arial, Helvetica, sans-serif",
  },
  {
    name: "Georgia",
    stack: "Georgia, 'Times New Roman', serif",
    hint: "serif",
  },
  {
    name: "Charter",
    stack: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
    hint: "serif",
  },
  {
    name: "IBM Plex Sans",
    stack: "'IBM Plex Sans', system-ui, sans-serif",
  },
  {
    name: "Atkinson Hyperlegible",
    stack: "'Atkinson Hyperlegible', system-ui, sans-serif",
    hint: "a11y",
  },
  {
    name: "JetBrains Mono",
    stack: "'JetBrains Mono', 'Fira Mono', Menlo, Consolas, monospace",
    hint: "mono",
  },
];

/** Loose normalization for stack equality (whitespace + quote-style). */
export function normalizeStack(stack: string): string {
  return stack
    .replace(/["']/g, "'")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Find the preset whose stack matches `value` (whitespace + quote
 * tolerant). Returns the preset's `stack` so the caller can drive a
 * `<select>` `value=` directly. Returns `null` when no preset matches.
 */
export function matchPresetStack(value: string | undefined | null): string | null {
  if (!value) return null;
  const norm = normalizeStack(value);
  for (const preset of FONT_PRESETS) {
    if (normalizeStack(preset.stack) === norm) return preset.stack;
  }
  return null;
}

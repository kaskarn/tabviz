/**
 * Theme source generation — turns a base theme name + a map of user edits
 * into a chain of R code that reproduces the current look:
 *
 *   web_theme_default() |>
 *     set_colors(primary = "#2563eb", alt_bg = "#fef3c7") |>
 *     set_layout(banding = "group-1")
 *
 * The output uses the package's fluent modifier API — the natural home for
 * composed tweaks — so pasted code stays idiomatic and diff-friendly.
 */

export type ThemeEdits = Record<string, Record<string, unknown>>;

/**
 * Map frontend section keys to their R modifier function names.
 * Sections not in this map are silently skipped (no R equivalent).
 */
const SECTION_TO_R_FN: Record<string, string> = {
  colors: "set_colors",
  typography: "set_typography",
  spacing: "set_spacing",
  shapes: "set_shapes",
  axis: "set_axis",
  layout: "set_layout",
  groupHeaders: "set_group_headers",
};

/** Canonical section order in the emitted chain (stable diffs, readable). */
const SECTION_ORDER = [
  "colors",
  "typography",
  "spacing",
  "shapes",
  "axis",
  "layout",
  "groupHeaders",
];

/** `fontFamily` → `font_family`. */
export function camelToSnake(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}

/** Format a JS value as an R literal. Handles strings, numbers, booleans,
 *  null/undefined, and flat vectors. Objects fall back to quoted JSON — we
 *  don't currently emit nested structures, but the default keeps us honest
 *  if a new field type sneaks in. */
export function rLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NA_real_";
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value); // quotes + escapes
  if (Array.isArray(value)) {
    if (value.length === 0) return "c()";
    return `c(${value.map(rLiteral).join(", ")})`;
  }
  return JSON.stringify(value);
}

/** Indentation used between chain steps (two spaces, matches tidyverse style). */
const INDENT = "  ";

/**
 * Emit a complete R theme snippet.
 *
 * @param baseThemeName  Preset the chain starts from (e.g. "default", "jama").
 * @param edits          Per-section map of edited fields (frontend camelCase).
 *                       Empty sections are skipped. Unknown sections (not in
 *                       SECTION_TO_R_FN) are skipped.
 */
export function generateThemeSource(
  baseThemeName: string,
  edits: ThemeEdits,
): string {
  const lines: string[] = [`web_theme_${baseThemeName}()`];

  for (const section of SECTION_ORDER) {
    const fn = SECTION_TO_R_FN[section];
    if (!fn) continue;
    const fields = edits[section];
    if (!fields || Object.keys(fields).length === 0) continue;

    const args = Object.entries(fields)
      .map(([k, v]) => `${camelToSnake(k)} = ${rLiteral(v)}`);

    // Single arg on one line, multiple args across lines for readability.
    if (args.length === 1) {
      lines.push(`${INDENT}|> ${fn}(${args[0]})`);
    } else {
      lines.push(`${INDENT}|> ${fn}(`);
      args.forEach((arg, i) => {
        const sep = i < args.length - 1 ? "," : "";
        lines.push(`${INDENT}${INDENT}${arg}${sep}`);
      });
      lines.push(`${INDENT})`);
    }
  }

  return lines.join("\n");
}

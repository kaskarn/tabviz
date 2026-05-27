// Small string helpers shared between SVG renderers (the per-schema
// renderers in `schema/columns/*-renderer.ts` and the legacy
// `export/svg-generator.ts`). Kept in `$lib/` so neither side has to
// import from the other.

/** Escape XML special characters for embedding in attribute values
 *  or element bodies. */
export function escapeXml(text: string | null | undefined): string {
  if (text == null) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

/** Neutralize an UNTRUSTED, spec-data-derived value before writing it into a
 *  double-quoted SVG attribute (fill/stroke colors from EffectSpec.color,
 *  row.markerStyle/cellStyle/style.bg, CustomAnnotation/ReferenceLine colors —
 *  all attacker-reachable on the wire). The exported SVG is string-concatenated
 *  (no DOM auto-escaping) and gets embedded into HTML/Quarto, so a value like
 *  `#fff" onload="alert(1)` would otherwise break out of the attribute = stored
 *  XSS. A legitimate CSS color never contains &<>"', so this is a no-op on real
 *  colors — same egress-neutralizer posture as `getCssVars` for theme tokens.
 *  Theme-derived colors already pass that gate; this guards the data tier. */
export const escapeAttr = escapeXml;

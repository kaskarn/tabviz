// StyleMappingValue — discriminated union for style override values.
//
// A style override (bold / italic / color / bg / token / ...) can be:
//   - "theme":     the theme cascade decides (no override)
//   - "static":    an explicit literal value applied to every row
//   - "field":     a per-row value pulled from a data column
//   - "condition": a per-row value pulled from a named condition's
//                  boolean vector
//
// The tagged union replaces today's "bare string = field name"
// convention with a self-discriminating shape. Back-compat is
// preserved at render time: bare strings are accepted and treated
// as { kind: "field", field: <string> } by `normalizeStyle`.

/**
 * Discriminated style-override value. Generic over the static-value
 * type so toggle (boolean) and color (string) and number can all use
 * the same shape.
 */
export type StyleMappingValue<T> =
  | { kind: "theme" }
  | { kind: "static";    value: T }
  | { kind: "field";     field: string }
  | { kind: "condition"; name: string };

/**
 * Style override as written on the wire — either the new tagged union
 * or a bare string (legacy field-reference form).
 */
export type StyleOverride<T> = StyleMappingValue<T> | string | undefined | null;

// ────────────────────────────────────────────────────────────────────
// Type guards
// ────────────────────────────────────────────────────────────────────

export function isStyleMappingValue<T>(v: unknown): v is StyleMappingValue<T> {
  return (
    typeof v === "object" &&
    v !== null &&
    "kind" in v &&
    typeof (v as { kind: unknown }).kind === "string"
  );
}

export function isFieldOverride<T>(v: StyleMappingValue<T>): v is { kind: "field"; field: string } {
  return v.kind === "field";
}

export function isConditionOverride<T>(
  v: StyleMappingValue<T>,
): v is { kind: "condition"; name: string } {
  return v.kind === "condition";
}

export function isStaticOverride<T>(
  v: StyleMappingValue<T>,
): v is { kind: "static"; value: T } {
  return v.kind === "static";
}

export function isThemeOverride<T>(v: StyleMappingValue<T>): v is { kind: "theme" } {
  return v.kind === "theme";
}

// ────────────────────────────────────────────────────────────────────
// Normalizer
// ────────────────────────────────────────────────────────────────────

/**
 * Convert any-shape wire input into a canonical `StyleMappingValue<T>`.
 *
 * - `undefined` / `null`            → `{ kind: "theme" }`
 * - bare `string` (legacy)          → `{ kind: "field", field }`
 * - already-tagged union            → returned unchanged
 *
 * Use this at the renderer's read site so downstream code can switch
 * on `kind` without re-handling the legacy string form.
 */
export function normalizeStyle<T>(v: StyleOverride<T>): StyleMappingValue<T> {
  if (v == null) return { kind: "theme" };
  if (typeof v === "string") return { kind: "field", field: v };
  if (isStyleMappingValue<T>(v)) return v;
  // Fallback — treat as static value (boolean / number / etc.)
  return { kind: "static", value: v as T };
}

// ────────────────────────────────────────────────────────────────────
// Authoring helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Reference a named condition. Returns a tagged-union value that
 * a styleMapping field will recognize as a condition reference.
 *
 *   col_text({ field: "study", bold: cond("significant") })
 */
export function cond(name: string): StyleMappingValue<never> {
  return { kind: "condition", name };
}

/**
 * Wrap an explicit static value. Mostly for symmetry — the same
 * effect is achievable by passing the literal directly when the
 * normalizer's "fallback to static" rule applies.
 */
export function staticValue<T>(value: T): StyleMappingValue<T> {
  return { kind: "static", value };
}

/**
 * Reference a data field. Same as passing a bare string today; this
 * helper makes intent explicit.
 */
export function fieldRef<T = never>(field: string): StyleMappingValue<T> {
  return { kind: "field", field };
}

// Wire-format version handling for tabviz specs.
//
// Every WebSpec and SplitForestPayload emitted by the R serializer carries
// a top-level `version` string (semver-shaped: "MAJOR.MINOR"). The JS side
// validates the major on ingestion before handing the payload off to the
// store.
//
// Pre-release stance (per docs/dev/frontend-split-spec.md §3.4): we may
// evolve the wire format freely between releases, including breaking
// changes, with no migration handlers expected. The version field is
// still emitted and validated — that's load-bearing infrastructure that
// needs to be present on day one — but the policy around bumps is
// informal until external consumers ship.
//
// Steady-state (post-publish):
//   - Major bumps are breaking; migration handlers translate older majors
//   - Minor bumps are strictly additive; older readers must ignore unknown
//     fields. The JSON Schema at $spec/v1.0.json is published with
//     `additionalProperties: true` to make minor-bumps safe by contract.
//   - Patch bumps are documentation/internal only.

/**
 * Supported wire-format major versions. Bump when shipping a breaking
 * change and add a migration handler in {@link normalizeSpecVersion}.
 */
export const SUPPORTED_MAJORS = ["1"] as const;
export type SupportedMajor = (typeof SUPPORTED_MAJORS)[number];

/**
 * The canonical version string the R-side serializer emits today. Update
 * when shipping additive minor changes; bump major + add migration when
 * shipping breaking changes.
 */
// 1.4 (additive): spec.figureLayout figure-state block (column width pins,
// column reorder, row-kind height pins) + interaction.enableAxisZoom +
// the row_kind_heights Shiny event field (interactivity-UX arc P0/P1).
// WIRE FROZEN at 1.10 (2026-06-11, roadmap area M): minors are strictly
// additive from here; breaking changes need a major + migration handler
// + a regenerated published schema. Mirror statement: R/wire-version.R.
export const CURRENT_VERSION = "1.10" as const;
export type SpecVersion = typeof CURRENT_VERSION;

/**
 * Result of parsing a version string into its major/minor components.
 * `major` is the integer-as-string (so the SupportedMajor union works);
 * `minor` is best-effort and not validated.
 */
export interface ParsedVersion {
  major: string;
  minor: string | null;
  raw: string;
}

/**
 * Parse a wire-format version string. Tolerant of missing minor; rejects
 * anything that doesn't start with an integer-shaped major segment.
 */
export function parseSpecVersion(raw: unknown): ParsedVersion | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d+)(?:\.(\d+(?:\.\d+)?))?$/.exec(raw.trim());
  if (!match) return null;
  return { major: match[1], minor: match[2] ?? null, raw };
}

/**
 * Validate that a wire payload carries a recognized version. Throws with
 * a helpful error message on unknown majors; tolerates unknown minors per
 * the additive-evolution contract.
 *
 * The narrowed return type is the input payload with `version` known to
 * be a string — callers can drop the optional/unknown narrowing without
 * a redundant `as` cast.
 */
export function validateSpecVersion<T extends { version?: unknown }>(
  payload: T,
  context = "spec",
): T & { version: string } {
  const parsed = parseSpecVersion(payload.version);
  if (parsed === null) {
    throw new Error(
      `[tabviz] ${context} is missing a recognizable \`version\` field ` +
        `(got: ${JSON.stringify(payload.version)}). ` +
        `Expected a semver-shaped string like "1.0". ` +
        `If this payload was produced by an older tabviz R package, upgrade R-side.`,
    );
  }
  if (!(SUPPORTED_MAJORS as readonly string[]).includes(parsed.major)) {
    throw new Error(
      `[tabviz] ${context} has an unrecognized major version: "${parsed.raw}". ` +
        `This build supports majors: ${SUPPORTED_MAJORS.join(", ")}. ` +
        `If you're seeing this, either upgrade the JS bundle to match a newer ` +
        `R-emitted format or downgrade R-side to a matching major.`,
    );
  }
  // Unknown minor is fine — additive-only minor evolution.
  return payload as T & { version: string };
}

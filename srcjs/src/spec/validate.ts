// Structured spec validation (roadmap area D, 2026-06-11).
//
// ThemeIssue-style `{path, code, message, severity}` diagnostics for the
// WIRE SPEC, mirroring the theme ingress contract (theme-wire-parse.ts).
// This is the spec-first promise for non-R drivers (JS authors, LLMs,
// the MCP path): a broken payload gets machine-readable, path-addressed
// errors instead of a downstream render crash.
//
// Two layers, deliberately:
//   - `validateSpec(payload)` COLLECTS issues (never throws) — the
//     introspection/tooling surface.
//   - `assertValidSpec(payload)` throws `SpecValidationError` carrying
//     the error-severity issues — the ingress wall (createTabviz).
//
// Checks are STRUCTURAL (shape, references, duplicates), not the full
// option grammar — that's the published JSON Schema's job
// (dist/tabviz-spec.schema.json). The two are complementary: the schema
// is exhaustive but external; this is cheap, bundled, and runs at every
// mount.

import { parseSpecVersion, SUPPORTED_MAJORS } from "./index";

export interface SpecIssue {
  /** JSON-pointer-ish location, e.g. "columns[2].field". */
  path: string;
  /** Stable machine code, e.g. "missing-field", "unknown-ref". */
  code: string;
  /** User-presentable message. */
  message: string;
  severity: "error" | "warning";
}

export class SpecValidationError extends Error {
  issues: SpecIssue[];
  constructor(issues: SpecIssue[]) {
    super(
      `[tabviz] invalid spec — ${issues.length} error(s):\n` +
        issues.map((i) => `  ${i.path}: ${i.message}`).join("\n"),
    );
    this.name = "SpecValidationError";
    this.issues = issues;
  }
}

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Does any data row carry this key? (Sparse rows are legal — absence
 *  from EVERY row is what signals a broken reference.) */
function fieldExists(metas: AnyRecord[], field: string): boolean {
  return metas.some((meta) => field in meta);
}

/**
 * Structural validation of a wire-spec payload. Returns ALL findings
 * (errors + warnings); never throws. Reference checks (column fields vs
 * data keys) are warnings — sparse or streamed data can be legitimate.
 *
 * @param opts.knownTypes column-type roster for typo detection (pass
 *   `listColumnTypes()` from the authoring surface or the MCP layer;
 *   omitted by default so unknown FUTURE types stay valid per the
 *   additive-minor contract).
 */
export function validateSpec(
  payload: unknown,
  opts: { knownTypes?: readonly string[] } = {},
): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const err = (path: string, code: string, message: string) =>
    issues.push({ path, code, message, severity: "error" });
  const warn = (path: string, code: string, message: string) =>
    issues.push({ path, code, message, severity: "warning" });

  if (!isRecord(payload)) {
    err("$", "shape", "Spec must be a JSON object.");
    return issues;
  }

  // ── version ──────────────────────────────────────────────────────
  const parsed = parseSpecVersion(payload.version);
  if (parsed === null) {
    err("version", "version-missing",
      `Missing or unrecognizable \`version\` (got ${JSON.stringify(payload.version)}); expected a semver-shaped string like "1.10".`);
  } else if (!(SUPPORTED_MAJORS as readonly string[]).includes(parsed.major)) {
    err("version", "version-major",
      `Unsupported major version "${parsed.raw}"; this build supports majors: ${SUPPORTED_MAJORS.join(", ")}.`);
  }

  // ── data ─────────────────────────────────────────────────────────
  // Wire shape (WebData): `{rows, groups, …}` where every row is
  // `{id, label, metadata}` and ALL field data lives in `metadata`.
  let metas: AnyRecord[] = [];
  if (!isRecord(payload.data)) {
    err("data", "shape", "`data` must be an object: `{rows: [...], groups: [...]}`.");
  } else if (!Array.isArray(payload.data.rows)) {
    err("data.rows", "shape", "`data.rows` must be an array of row objects.");
  } else {
    const dataRows = payload.data.rows;
    const bad = dataRows.findIndex((r) => !isRecord(r) || !isRecord((r as AnyRecord).metadata));
    if (bad !== -1) {
      err(`data.rows[${bad}]`, "shape",
        "Every data row must be an object with a `metadata` record (all field data lives there).");
    } else {
      metas = (dataRows as AnyRecord[]).map((r) => r.metadata as AnyRecord);
      const seenRowIds = new Set<string>();
      for (let i = 0; i < dataRows.length; i++) {
        const id = (dataRows[i] as AnyRecord).id;
        if (typeof id !== "string" || id === "") {
          err(`data.rows[${i}].id`, "missing-id", "Every row needs a non-empty string `id` (state reconciliation keys on it).");
        } else if (seenRowIds.has(id)) {
          err(`data.rows[${i}].id`, "duplicate-id", `Row id "${id}" duplicates an earlier row.`);
        } else {
          seenRowIds.add(id);
        }
      }
    }
    if (payload.data.groups !== undefined && !Array.isArray(payload.data.groups)) {
      err("data.groups", "shape", "`data.groups` must be an array.");
    }
  }

  // ── columns ──────────────────────────────────────────────────────
  if (payload.columns !== undefined && !Array.isArray(payload.columns)) {
    err("columns", "shape", "`columns` must be an array.");
  }
  const columns = Array.isArray(payload.columns) ? payload.columns : [];
  const seenIds = new Map<string, number>();
  columns.forEach((col, i) => {
    const path = `columns[${i}]`;
    if (!isRecord(col)) {
      err(path, "shape", "Column must be an object.");
      return;
    }
    if (typeof col.type !== "string" || col.type === "") {
      err(`${path}.type`, "missing-type", "Column is missing its `type` string.");
    } else if (opts.knownTypes && !opts.knownTypes.includes(col.type)) {
      warn(`${path}.type`, "unknown-type",
        `Unknown column type "${col.type}" — typo, or a newer wire minor than this roster.`);
    }
    if (typeof col.id === "string" && col.id !== "") {
      const prev = seenIds.get(col.id);
      if (prev !== undefined) {
        err(`${path}.id`, "duplicate-id",
          `Column id "${col.id}" duplicates columns[${prev}] — figure layout, reorder, and width pins key on ids.`);
      }
      seenIds.set(col.id, i);
    }
    // Field references. Forest-family columns reference data through
    // options.forest (point/lower/upper); their own `field` is synthetic.
    const forest = isRecord(col.options) && isRecord(col.options.forest) ? col.options.forest : null;
    if (forest && metas.length > 0) {
      for (const k of ["point", "lower", "upper"] as const) {
        const ref = forest[k];
        if (typeof ref === "string" && ref !== "" && !fieldExists(metas, ref)) {
          warn(`${path}.options.forest.${k}`, "unknown-ref",
            `References data field "${ref}", which no data row carries.`);
        }
      }
    } else if (!forest && metas.length > 0 && typeof col.field === "string" && col.field !== "" && !fieldExists(metas, col.field)) {
      warn(`${path}.field`, "unknown-ref",
        `Column references data field "${col.field}", which no data row carries.`);
    }
  });

  // ── labelColumn ──────────────────────────────────────────────────
  const label = payload.labelColumn;
  if (label !== undefined && label !== null) {
    if (!isRecord(label)) {
      err("labelColumn", "shape", "`labelColumn` must be an object.");
    } else if (metas.length > 0 && typeof label.field === "string" && label.field !== "" && !fieldExists(metas, label.field)) {
      warn("labelColumn.field", "unknown-ref",
        `Label column references data field "${label.field}", which no data row carries.`);
    }
  }

  return issues;
}

/** The ingress wall: throws `SpecValidationError` (with the structured
 *  issues attached) when any error-severity finding exists. Warnings
 *  pass through — return them so callers can surface them. */
export function assertValidSpec(
  payload: unknown,
  opts: { knownTypes?: readonly string[] } = {},
): SpecIssue[] {
  const issues = validateSpec(payload, opts);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) throw new SpecValidationError(errors);
  return issues.filter((i) => i.severity === "warning");
}

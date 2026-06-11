// JSON Schema generator (roadmap area D, 2026-06-11).
//
// Emits the publishable wire-format schema by merging:
//   - the hand-written TOP-LEVEL shape (src/spec/v1.0.json — permissive
//     by contract so v1.x minors stay compatible), and
//   - GENERATED per-column-type definitions from SCHEMA_REGISTRY: every
//     concrete type's option bucket becomes a typed object (controls map
//     to JSON types; segmented/select controls become enums; integer
//     bounds carry through).
//
// Output: src/spec/generated/tabviz-spec.schema.json (checked in; ships
// with the npm package via the dist build). The gate
// (spec/json-schema.test.ts) validates a REAL authored spec against it
// with Ajv and asserts a malformed one fails.
//
//   bun run scripts/generate-json-schema.ts

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { SCHEMA_REGISTRY } from "../src/schema/columns/index";
import { resolveSchema } from "../src/schema/resolve";
import { CURRENT_VERSION } from "../src/spec/index";

type Json = Record<string, unknown>;

function optionToSchema(opt: {
  control: string; default?: unknown;
  min?: number; max?: number;
  segments?: { value: string }[];
  options?: { value: string }[];
}): Json {
  switch (opt.control) {
    case "toggle":   return { type: ["boolean", "null"] }; // wire carries null for unset
    case "integer": {
      const s: Json = { type: ["integer", "null"] };
      if (opt.min !== undefined) s.minimum = opt.min;
      if (opt.max !== undefined) s.maximum = opt.max;
      return s;
    }
    case "number": {
      const s: Json = { type: ["number", "null"] };
      if (opt.min !== undefined) s.minimum = opt.min;
      if (opt.max !== undefined) s.maximum = opt.max;
      return s;
    }
    case "text":     return { type: ["string", "null"] };
    case "color":    return { type: ["string", "null"] };
    case "segmented":
      return opt.segments?.length
        ? { enum: [...opt.segments.map((s) => s.value), null] }
        : { type: ["string", "null"] };
    case "select":
      return opt.options?.length
        ? { enum: [...opt.options.map((s) => s.value), null] }
        : { type: ["string", "null"] };
    default:
      // custom / field / value-or-field — structurally open.
      return {};
  }
}

// One def per WIRE TYPE (several registry entries share a wire type via
// different option buckets — e.g. numeric/currency/n all ride type
// "numeric"); merging every bucket's constraints into the wire-type def
// gives the schema teeth (a per-entry anyOf let a broken bucket slip
// through a sibling entry that doesn't constrain it).
const byWireType = new Map<string, { keys: string[]; buckets: Map<string, Json> }>();
for (const [key, schema] of Object.entries(SCHEMA_REGISTRY)) {
  const sc = schema as {
    abstract?: boolean; type?: string; bucket?: string;
    options?: Parameters<typeof optionToSchema>[0][] & { key: string }[];
  };
  if (sc.abstract || !sc.type) continue;
  const chain = resolveSchema(schema as never) as { options?: ({ key: string } & Parameters<typeof optionToSchema>[0])[] }[];
  const effective = new Map<string, { key: string } & Parameters<typeof optionToSchema>[0]>();
  for (const link of chain) {
    for (const opt of link.options ?? []) effective.set(opt.key, opt);
  }
  const optionProps: Json = {};
  for (const opt of effective.values()) optionProps[opt.key] = optionToSchema(opt);
  const entry = byWireType.get(sc.type) ?? { keys: [], buckets: new Map() };
  entry.keys.push(key);
  if (sc.bucket) {
    // Same bucket from two entries (numeric family): merge properties.
    const prev = (entry.buckets.get(sc.bucket) ?? {}) as Json;
    entry.buckets.set(sc.bucket, { ...prev, ...optionProps });
  }
  byWireType.set(sc.type, entry);
}

const defs: Json = {};
const columnRefs: Json[] = [];
const knownWireTypes: string[] = [];
for (const [wireType, entry] of byWireType) {
  knownWireTypes.push(wireType);
  const bucketProps: Json = {};
  for (const [bucket, props] of entry.buckets) {
    bucketProps[bucket] = { type: "object", additionalProperties: true, properties: props };
  }
  defs[`column_${wireType}`] = {
    type: "object",
    description: `Wire type "${wireType}" (authoring types: ${entry.keys.join(", ")}). Generated from SCHEMA_REGISTRY.`,
    additionalProperties: true,
    properties: {
      type: { const: wireType },
      field: { type: "string" },
      id: { type: "string" },
      header: { type: ["string", "null"] },
      width: { anyOf: [{ type: "number" }, { const: "auto" }, { type: "null" }] },
      sortable: { type: "boolean" },
      options: { type: "object", additionalProperties: true, properties: bucketProps },
    },
  };
  columnRefs.push({ $ref: `#/$defs/column_${wireType}` });
}

const base = JSON.parse(readFileSync(new URL("../src/spec/v1.0.json", import.meta.url), "utf8")) as Json;
const baseDefs = base.$defs as Json;
const webSpec = baseDefs.webSpec as Json;
const props = webSpec.properties as Json;
props.columns = {
  type: "array",
  items: {
    anyOf: [
      ...columnRefs,
      {
        type: "object",
        description: "Forward-compatible fallback: column types UNKNOWN to this schema version remain valid (additive minors). Known types must satisfy their definition.",
        properties: { type: { not: { enum: knownWireTypes } } },
      },
    ],
  },
};

const out: Json = {
  ...base,
  $id: "https://tabviz.dev/spec/tabviz-spec.schema.json",
  title: `tabviz wire-format spec (generated at ${CURRENT_VERSION})`,
  description: "GENERATED — do not edit. Top-level shape from src/spec/v1.0.json; per-column-type definitions from SCHEMA_REGISTRY. Regenerate: bun run scripts/generate-json-schema.ts",
  $defs: { ...baseDefs, ...defs },
};

mkdirSync(new URL("../src/spec/generated/", import.meta.url), { recursive: true });
const path = new URL("../src/spec/generated/tabviz-spec.schema.json", import.meta.url);
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
console.log(`✓ ${Object.keys(defs).length} column definitions → src/spec/generated/tabviz-spec.schema.json`);

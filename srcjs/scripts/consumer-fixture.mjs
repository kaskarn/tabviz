#!/usr/bin/env node
//
// consumer-fixture.mjs — a REAL external consumer, end to end
// (roadmap area D, 2026-06-11). Where dist-smoke.mjs checks export
// SHAPES, this fixture exercises the actual third-party journey using
// ONLY the published artifacts in dist/:
//
//   1. AUTHOR    — build a spec with the authoring API + a curated theme
//   2. VALIDATE  — the spec passes the SHIPPED JSON Schema (Ajv)
//   3. RENDER    — exportToSVG produces a plausible SVG with no DOM
//
// Any break in this chain is a break a real npm consumer would hit on
// day one. Runs after dist-smoke in build:npm.

import { readFileSync } from "fs";
import Ajv from "ajv/dist/2020.js";
import {
  tabviz, colText, colNumeric, vizForest, themeNejm,
} from "../dist/index.mjs";
import { exportToSVG } from "../dist/export.mjs";

// ── 1. AUTHOR ────────────────────────────────────────────────────────
const data = [
  { study: "Anderson 2020", n: 245, hr: 0.72, lo: 0.58, hi: 0.89 },
  { study: "Baker 2021",    n: 189, hr: 0.81, lo: 0.63, hi: 1.04 },
  { study: "Chen 2019",     n: 312, hr: 0.66, lo: 0.51, hi: 0.85 },
];
const spec = tabviz({
  data,
  label: "study",
  columns: [
    colText({ field: "study", header: "Study" }),
    colNumeric({ field: "n", header: "N", decimals: 0 }),
    vizForest({ point: "hr", lower: "lo", upper: "hi", header: "Hazard ratio", scale: "log" }),
  ],
  theme: themeNejm(),
  title: "Consumer fixture",
});

// ── 2. VALIDATE against the SHIPPED schema ───────────────────────────
const schema = JSON.parse(
  readFileSync(new URL("../dist/tabviz-spec.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(schema);
const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/webSpec` });
const valid = validate(JSON.parse(JSON.stringify(spec)));

// ── 3. RENDER headlessly (no DOM, no Canvas — the V8 contract) ───────
const svg = exportToSVG(spec);

const checks = [
  ["authored spec has wire version", typeof spec.version === "string"],
  ["authored spec validates against shipped schema",
    valid || JSON.stringify(validate.errors?.slice(0, 3))],
  ["SVG renders headlessly", typeof svg === "string" && svg.includes("<svg")],
  ["SVG carries the data", svg.includes("Anderson 2020") && svg.includes("Consumer fixture")],
  ["SVG is substantial (forest marks drawn)", svg.length > 5_000 || `len=${svg.length}`],
];

let failed = 0;
for (const [label, ok] of checks) {
  const pass = ok === true;
  console.log(`${pass ? "✓" : "✗"} ${label}${pass ? "" : ` — ${ok}`}`);
  if (!pass) failed++;
}
if (failed) {
  console.error(`\n${failed} consumer-fixture check(s) failed`);
  process.exit(1);
}
console.log(`\nConsumer fixture passed: author → schema-validate → headless SVG.`);

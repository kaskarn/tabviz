/**
 * V8 Entry Point for svg-generator + authoring API parity tests.
 *
 * Bundled as a standalone IIFE for the V8 R package. Exposes:
 *   - generateSVG / computeNaturalDimensions — the SVG export pipeline
 *   - callBuilder(name, argsJson) — JSON-in/JSON-out dispatcher to the
 *     authoring builders, used by `tests/testthat/test-parity-columns.R`
 *     to assert R↔TS column construction parity.
 */

import { generateSVG, computeNaturalDimensions } from "./svg-generator";
import { renderDebugShapes } from "./debug-shapes";
import type { WebSpec } from "$types";
import * as authoring from "../authoring";
// Side-effect: register built-in schema behaviors before SVG export
// queries dispatchers (sortKey, etc.).
import "../schema/init";

// Parse JSON string to WebSpec and generate SVG
function generateSVGFromJSON(specJson: string, options?: { width?: number; height?: number }): string {
  const spec: WebSpec = JSON.parse(specJson);
  return generateSVG(spec, options);
}

// Compute natural dimensions without rendering. Returns a JSON-encoded
// `{ width, height, aspect }` so the V8 → R bridge stays string-typed.
function computeNaturalDimensionsFromJSON(specJson: string): string {
  const spec: WebSpec = JSON.parse(specJson);
  return JSON.stringify(computeNaturalDimensions(spec));
}

// Box-model debug view (sizing harness, visual half). Returns an SVG that
// draws cell boxes / padding / anchors instead of content.
function renderDebugShapesFromJSON(specJson: string): string {
  const spec: WebSpec = JSON.parse(specJson);
  return renderDebugShapes(spec);
}

/**
 * Dispatch an authoring builder call from R via V8.
 *
 * `name` is the exported builder symbol (e.g. "colText", "vizForest");
 * `argsJson` is the JSON-serialized argument object the builder expects.
 * `options2Json` is an optional second argument for builders that take
 * a `(draft, options)` signature (e.g. `resolveTheme`); when undefined
 * the builder is called single-argument. Returns the resulting
 * wire-shape object as JSON. Errors throw on the V8 side and surface
 * to R as standard `cli::cli_abort` failures.
 */
function callBuilder(name: string, argsJson: string, options2Json?: string): string {
  const builder = (authoring as Record<string, unknown>)[name];
  if (typeof builder !== "function") {
    throw new Error(`callBuilder: no such builder "${name}"`);
  }
  const args = JSON.parse(argsJson);
  const fn = builder as (...a: unknown[]) => unknown;
  const result =
    options2Json !== undefined && options2Json !== null && options2Json !== ""
      ? fn(args, JSON.parse(options2Json))
      : fn(args);
  return JSON.stringify(result);
}

// Expose to global scope for V8
const g = globalThis as unknown as Record<string, unknown>;
g.generateSVG = generateSVGFromJSON;
g.computeNaturalDimensions = computeNaturalDimensionsFromJSON;
g.renderDebugShapes = renderDebugShapesFromJSON;
g.callBuilder = callBuilder;

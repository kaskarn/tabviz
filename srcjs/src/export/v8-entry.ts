/**
 * V8 Entry Point for svg-generator
 *
 * This file is bundled as a standalone IIFE for use with the V8 R package.
 * It exposes the generateSVG function globally.
 */

import { generateSVG, computeNaturalDimensions } from "./svg-generator";
import type { WebSpec } from "$types";

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

// Expose to global scope for V8
(globalThis as unknown as Record<string, unknown>).generateSVG = generateSVGFromJSON;
(globalThis as unknown as Record<string, unknown>).computeNaturalDimensions =
  computeNaturalDimensionsFromJSON;

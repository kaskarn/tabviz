// Stars cell SVG renderer (schema-sprint Phase 4b.3).
//
// Mirrors svg-generator.ts:3523-3574. N-pointed-star glyphs with
// fill/empty fills, optional half-star, configurable domain mapping
// (value range → 0..maxStars), maxStars clamped to [1, 20].
//
// Output is a single <g> containing N <path> star glyphs laid out in
// a row. Origin is (0,0); caller wraps + positions.

import type { ColumnOptions } from "../../types";
import type { CellFormatter, RenderSvg } from "../render-types";
import { registerRenderers } from "../extend";

interface StarsOptions {
  maxStars?: number;
  color?: string;
  emptyColor?: string;
  domain?: [number, number];
  halfStars?: boolean;
}

const STAR_SIZE = 12;
const STAR_GAP = 2;
const DEFAULT_FILL = "#f59e0b";
const DEFAULT_EMPTY = "#d1d5db";

function starPath(cx: number, cy: number, size: number): string {
  const r = size / 2;
  const innerR = r * 0.4;
  let d = "";
  for (let j = 0; j < 5; j++) {
    const outerAngle = (j * 72 - 90) * Math.PI / 180;
    const innerAngle = ((j * 72 + 36) - 90) * Math.PI / 180;
    const ox = cx + r * Math.cos(outerAngle);
    const oy = cy + r * Math.sin(outerAngle);
    const ix = cx + innerR * Math.cos(innerAngle);
    const iy = cy + innerR * Math.sin(innerAngle);
    d += (j === 0 ? `M${ox},${oy}` : `L${ox},${oy}`) + `L${ix},${iy}`;
  }
  return d + "Z";
}

function ratingFor(value: number, opts: StarsOptions | undefined, maxStars: number): number {
  const domain = opts?.domain;
  let raw = value;
  if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[1] > domain[0]) {
    const clamped = Math.max(domain[0], Math.min(domain[1], raw));
    raw = ((clamped - domain[0]) / (domain[1] - domain[0])) * maxStars;
  }
  return Math.max(0, Math.min(maxStars, raw));
}

const starsSvgRenderer: CellFormatter = (value, options, _ctx): RenderSvg => {
  if (typeof value !== "number") {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  const opts = (options as ColumnOptions | undefined)?.stars as StarsOptions | undefined;
  const maxStars = Math.max(1, Math.min(20, opts?.maxStars ?? 5));
  const fillColor = opts?.color ?? DEFAULT_FILL;
  const emptyColor = opts?.emptyColor ?? DEFAULT_EMPTY;
  const rating = ratingFor(value, opts, maxStars);
  const filled = Math.floor(rating);
  const hasHalf = (opts?.halfStars ?? false) && (rating - filled) >= 0.5;

  const totalWidth = maxStars * STAR_SIZE + (maxStars - 1) * STAR_GAP;
  const pieces: string[] = [];
  for (let j = 0; j < maxStars; j++) {
    const cx = j * (STAR_SIZE + STAR_GAP) + STAR_SIZE / 2;
    const cy = STAR_SIZE / 2;
    const isFilled = j < filled || (j === filled && hasHalf);
    const color = isFilled ? fillColor : emptyColor;
    pieces.push(`<path d="${starPath(cx, cy, STAR_SIZE)}" fill="${color}"/>`);
  }
  return { kind: "svg", markup: pieces.join(""), width: totalWidth, height: STAR_SIZE };
};

/** Idempotent re-register helper. */
export function registerStarsRenderer(): void {
  registerRenderers("stars", { svg: starsSvgRenderer });
}

registerStarsRenderer();

export const __testing = { starPath, ratingFor, STAR_SIZE, STAR_GAP, DEFAULT_FILL, DEFAULT_EMPTY };

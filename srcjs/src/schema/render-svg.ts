// RenderNode → SVG markup serializer.
//
// Walks a RenderNode tree and emits SVG markup. Paired with the
// browser RenderNode mounter (svelte/RenderTree.svelte) — both
// consume the same tree shape, so cell formatters can stay pure and
// renderer-agnostic.
//
// Theme resolution: text/group styles can be theme tokens
// ("primary", "muted", "accent", …) or literal values. The
// serializer takes a `resolve` function that maps tokens to literal
// values; the caller injects a theme-aware resolver. When
// `resolve` is undefined, tokens pass through verbatim — fine for
// snapshot tests that don't care about literal colors.
//
// Layout: groups render in row/column/stack via SVG `<g>` with
// transform math. Lightweight measurement — text width is
// estimated via the existing `estimateTextWidth` helper to keep the
// V8 path canvas-free.

import type {
  RenderNode,
  RenderText,
  RenderGroup,
  RenderSvg,
  RenderSpacer,
  RenderImage,
  RenderComponent,
  TextStyle,
  GroupStyle,
} from "./render-types";
import { estimateTextWidth } from "../lib/width-utils";

// ────────────────────────────────────────────────────────────────────
// Resolver
// ────────────────────────────────────────────────────────────────────

/** Maps theme tokens to literal CSS / px values. */
export interface StyleResolver {
  font?:   (v: NonNullable<TextStyle["font"]>) => string;
  size?:   (v: NonNullable<TextStyle["size"]>) => number;
  weight?: (v: NonNullable<TextStyle["weight"]>) => string | number;
  color?:  (v: NonNullable<TextStyle["color"]>) => string;
  bg?:     (v: NonNullable<GroupStyle["bg"]>) => string;
  /** Text-width measurer `(text, resolvedPx) → width`. Default is the pure-JS
   *  `estimateTextWidth`. Lets the WIDTH-ESTIMATION path inject a Canvas-exact
   *  measurer (bound to the cell font) so it reuses THIS layout engine — same
   *  per-node sizing the renderer draws — instead of re-deriving widths from a
   *  flat string. The V8 SVG render path leaves it unset (estimator). */
  measure?: (text: string, fontSizePx: number) => number;
}

const DEFAULT_RESOLVER: StyleResolver = {
  size: (v) => (typeof v === "number" ? v : v === "major" ? 14 : v === "minor" ? 10 : 12),
  color: (v) => String(v),
  bg: (v) => String(v),
  font: (v) => String(v),
  weight: (v) => v,
};

function resolveStyle(s: TextStyle | undefined, r: StyleResolver): {
  /** Pixel size used for layout (width estimation). Always defined.
   *  When the node didn't explicitly set a size, `sizeAttr` is
   *  undefined so the rendered `<text>` doesn't emit `font-size` and
   *  inherits from the outer `<g>`. */
  layoutPx: number;
  sizeAttr?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: "italic";
  fill?: string;
} {
  const resolvedSize = s?.size != null
    ? (r.size ?? DEFAULT_RESOLVER.size!)(s.size)
    : undefined;
  // Layout falls back to "base" via the resolver so width measurement
  // matches the inherited cell font-size. Explicit size still wins.
  const layoutPx = resolvedSize ?? (r.size ?? DEFAULT_RESOLVER.size!)("base");
  const out: ReturnType<typeof resolveStyle> = {
    layoutPx,
    ...(resolvedSize != null ? { sizeAttr: resolvedSize } : {}),
  };
  if (s?.font != null)   out.fontFamily = (r.font   ?? DEFAULT_RESOLVER.font!)(s.font);
  if (s?.weight != null) out.fontWeight = (r.weight ?? DEFAULT_RESOLVER.weight!)(s.weight);
  if (s?.italic)         out.fontStyle  = "italic";
  if (s?.color != null)  out.fill       = (r.color  ?? DEFAULT_RESOLVER.color!)(s.color);
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

export interface RenderToSvgResult {
  markup: string;
  width: number;
  height: number;
}

export function renderNodeToSvg(
  node: RenderNode,
  resolver?: StyleResolver,
): RenderToSvgResult {
  const r = resolver ?? DEFAULT_RESOLVER;
  return renderInner(node, r);
}

function renderInner(node: RenderNode, r: StyleResolver): RenderToSvgResult {
  switch (node.kind) {
    case "text":      return renderText(node, r);
    case "group":     return renderGroup(node, r);
    case "svg":       return renderSvg(node);
    case "spacer":    return renderSpacer(node);
    case "image":     return renderImage(node);
    case "component": return renderComponentFallback(node);
  }
}

// ────────────────────────────────────────────────────────────────────
// Per-kind renderers
// ────────────────────────────────────────────────────────────────────

function renderText(node: RenderText, r: StyleResolver): RenderToSvgResult {
  const s = resolveStyle(node.style, r);
  const attrs: string[] = [];
  // Only emit attrs the caller explicitly set; everything else
  // inherits from the outer `<g>` (which carries the cell's
  // theme/cellStyle defaults).
  if (s.sizeAttr != null) attrs.push(`font-size="${s.sizeAttr}"`);
  if (s.fontFamily)       attrs.push(`font-family="${escapeAttr(s.fontFamily)}"`);
  if (s.fontWeight)       attrs.push(`font-weight="${s.fontWeight}"`);
  if (s.fontStyle)        attrs.push(`font-style="${s.fontStyle}"`);
  if (s.fill)             attrs.push(`fill="${escapeAttr(s.fill)}"`);

  // Layout convention: a text node occupies the box (0,0)→(width,height)
  // in its own coordinate frame. With `dominant-baseline="central"` and
  // y set to height/2, the text VISUALLY centers within that box, the
  // way HTML/flex-align-items:center renders body text. The previous
  // `hanging` baseline anchored the TOP of the text at y=0, so callers
  // that tried to vertically center by shifting `-height/2` ended up
  // ~0.25×fontSize too high — visible as "text top-justified" in
  // exported SVGs, especially in inflated rows (rowGroupPadding).
  const height = s.layoutPx * 1.2;
  attrs.unshift(`y="${(height / 2).toFixed(2)}"`);
  attrs.push(`dominant-baseline="central"`);

  const width  = (r.measure ?? estimateTextWidth)(node.value, s.layoutPx);
  const markup = `<text ${attrs.join(" ")}>${escapeText(node.value)}</text>`;
  return { markup, width, height };
}

function renderGroup(node: RenderGroup, r: StyleResolver): RenderToSvgResult {
  const layout = node.layout ?? "row";
  const gap = node.gap ?? 0;
  const children = node.children.map((c) => renderInner(c, r));

  let cursorX = 0, cursorY = 0;
  let totalW = 0, totalH = 0;
  const placed: string[] = [];

  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    placed.push(`<g transform="translate(${cursorX} ${cursorY})">${c.markup}</g>`);
    if (layout === "row") {
      cursorX += c.width + (i < children.length - 1 ? gap : 0);
      totalW = cursorX;
      totalH = Math.max(totalH, c.height);
    } else if (layout === "column" || layout === "stack") {
      cursorY += c.height + (i < children.length - 1 ? gap : 0);
      totalH = cursorY;
      totalW = Math.max(totalW, c.width);
    }
  }

  let bgRect = "";
  if (node.style?.bg != null) {
    const bg = (r.bg ?? DEFAULT_RESOLVER.bg!)(node.style.bg);
    const radius = node.style.borderRadius ?? 0;
    bgRect = `<rect width="${totalW}" height="${totalH}" fill="${escapeAttr(bg)}"${radius ? ` rx="${radius}"` : ""}/>`;
  }
  const pad = node.style?.padding ?? 0;
  const padXform = pad ? ` transform="translate(${pad} ${pad})"` : "";
  const markup = `<g${padXform}>${bgRect}${placed.join("")}</g>`;
  const W = totalW + pad * 2;
  const H = totalH + pad * 2;
  return { markup, width: W, height: H };
}

function renderSvg(node: RenderSvg): RenderToSvgResult {
  // Caller-supplied SVG markup; passes through with width/height from the node.
  return { markup: node.markup, width: node.width, height: node.height };
}

function renderSpacer(node: RenderSpacer): RenderToSvgResult {
  return { markup: "", width: node.size, height: node.size };
}

// RenderComponent has no meaning in the SVG-export path. If a schema
// returns one from its `svg` renderer, that's a programming error —
// the schema should return a RenderSvg (markup) instead. Emit a
// visible diagnostic so the misuse surfaces in exported output and
// in the visual-regression diffs.
function renderComponentFallback(node: RenderComponent): RenderToSvgResult {
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  const comment = `<!-- RenderComponent "${escapeAttr(node.name)}" in SVG path: schema should provide an SVG renderer -->`;
  return { markup: comment, width: w, height: h };
}

function renderImage(node: RenderImage): RenderToSvgResult {
  const w = node.width ?? 24;
  const h = node.height ?? 24;
  const alt = node.alt ? ` aria-label="${escapeAttr(node.alt)}"` : "";
  return {
    markup: `<image href="${escapeAttr(node.src)}" width="${w}" height="${h}"${alt}/>`,
    width: w,
    height: h,
  };
}

// ────────────────────────────────────────────────────────────────────
// Escaping
// ────────────────────────────────────────────────────────────────────

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Theme finalization — `applyTheme(tree, nodeRules)`.
//
// The renderer commits to STRUCTURE: it produces a RenderNode tree
// with semantic tags. The theme commits to STYLE: `nodeRules`
// declares what each tag should look like. This module is the link
// between them — walks the tree, matches each node's tags against
// the rules table, and applies them.
//
// Rules per tag can:
//   - merge text/group style overrides onto the node
//   - wrap the node in additional structure (subscript, newline, …)
//   - hide the node entirely
//   - run an arbitrary transform (escape hatch)
//
// Last matching rule wins per property (no CSS specificity scoring;
// simple "shallow merge with override"). Tag inheritance is opt-in:
// descendants do NOT auto-inherit ancestor tag styles unless they
// declare matching tags themselves.

import type {
  RenderNode,
  RenderText,
  RenderGroup,
  TextStyle,
  GroupStyle,
} from "./render-types";

// ────────────────────────────────────────────────────────────────────
// NodeRule + theme.nodeRules
// ────────────────────────────────────────────────────────────────────

export interface NodeRule {
  /** Text-style overlay applied to RenderText (and recursively to text
   *  children when used inside a group rule). */
  text?: Partial<TextStyle>;
  /** Group-style overlay applied to RenderGroup. */
  group?: Partial<GroupStyle>;
  /**
   * Wrap the node in extra structure. Phase 7 wires the actual
   * transformations; the contract here lets themes declare intent.
   *
   *   - "subscript"   — render the node as <sub> in DOM, lower + smaller in SVG
   *   - "superscript" — opposite of subscript
   *   - "newline"     — put the node on its own line
   */
  wrap?: "subscript" | "superscript" | "newline" | null;
  /** Hide entirely — node becomes an empty group. */
  hidden?: boolean;
  /** Arbitrary transform; escape hatch. */
  transform?: (node: RenderNode) => RenderNode;
}

export type NodeRules = Record<string, NodeRule>;

/**
 * Built-in NodeRule defaults. Themes layer their own on top via
 * `WebTheme.nodeRules`; the merge happens in `applyTheme()` below.
 *
 * Single source of truth for both runtimes — the browser DOM
 * mounter (`RenderTree.svelte` via `renderCell()`) and the
 * V8/SVG-export path (`svg-generator.ts` via `renderCell(..., "svg")`)
 * both pull from here.
 *
 * Keep this list TIGHT. Tags are a structural commitment; adding
 * a default rule for a tag commits every theme to that look unless
 * they override it. Prefer empty/explicit-only defaults.
 */
export const DEFAULT_NODE_RULES: NodeRules = {
  // Interval bounds — the `(0.72, 0.99)` part of `0.85 (0.72, 0.99)` —
  // dim to minor size + muted color so the point estimate stays
  // visually dominant. Themes can override per their own style.
  "interval-range": { text: { size: "minor", color: "muted" } },
};

// ────────────────────────────────────────────────────────────────────
// applyTheme
// ────────────────────────────────────────────────────────────────────

const EMPTY_GROUP: RenderGroup = { kind: "group", children: [] };

/**
 * Walk the tree, applying matching NodeRule overlays to each node's
 * tags. Pure — does not mutate the input tree.
 *
 * Resolution order per node:
 *  1. Hidden check (any matched rule that sets `hidden: true` returns EMPTY).
 *  2. Text/group style overlays applied in tag order (last write wins
 *     per field within style; absent fields persist).
 *  3. Wrap applied (still a structural addition; outermost first).
 *  4. Transform applied last (custom rule's escape hatch).
 *
 * For RenderGroup, children are recursively finalized first so that
 * any wrap at the parent level sees finalized child structure.
 */
export function applyTheme(node: RenderNode, rules: NodeRules | undefined): RenderNode {
  // Merge built-in defaults with theme overlays. Theme rules take
  // precedence per-tag (last write wins), so a theme that explicitly
  // sets `interval-range: {...}` replaces the default but doesn't
  // clobber other defaults.
  const effective: NodeRules = { ...DEFAULT_NODE_RULES, ...(rules ?? {}) };
  // Only text and group nodes carry tags; svg/spacer/image pass through.
  const tags: string[] = (node.kind === "text" || node.kind === "group")
    ? (node.tags ?? [])
    : [];
  const matched: NodeRule[] = tags
    .map((t) => effective[t])
    .filter((r): r is NodeRule => r != null);

  // Hidden short-circuit
  if (matched.some((r) => r.hidden)) return EMPTY_GROUP;

  // Recursively finalize children first (for groups)
  let working: RenderNode =
    node.kind === "group"
      ? { ...node, children: node.children.map((c) => applyTheme(c, effective)) }
      : node;

  // Apply style overlays
  for (const rule of matched) {
    if (rule.text && working.kind === "text") {
      working = mergeText(working, rule.text);
    } else if (rule.text && working.kind === "group") {
      // Group with a text-style rule: apply the overlay to every
      // descendant text node. This is the "interval-range is muted"
      // pattern: the group is tagged, the children inherit the style.
      working = {
        ...working,
        children: working.children.map((c) => cascadeTextStyle(c, rule.text!)),
      };
    }
    if (rule.group && working.kind === "group") {
      working = mergeGroup(working, rule.group);
    }
  }

  // Apply wraps + transforms
  for (const rule of matched) {
    if (rule.wrap) working = applyWrap(working, rule.wrap);
    if (rule.transform) working = rule.transform(working);
  }

  return working;
}

// ────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────

function mergeText(node: RenderText, overlay: Partial<TextStyle>): RenderText {
  return { ...node, style: { ...overlay, ...node.style } };
}

function mergeGroup(node: RenderGroup, overlay: Partial<GroupStyle>): RenderGroup {
  return { ...node, style: { ...overlay, ...node.style } };
}

/**
 * Recursively apply a text-style overlay to every text descendant
 * of a group. The overlay sets fields that don't already have an
 * inline value — caller's explicit values win.
 */
function cascadeTextStyle(node: RenderNode, overlay: Partial<TextStyle>): RenderNode {
  if (node.kind === "text") {
    return { ...node, style: { ...overlay, ...node.style } };
  }
  if (node.kind === "group") {
    return { ...node, children: node.children.map((c) => cascadeTextStyle(c, overlay)) };
  }
  return node;
}

function applyWrap(node: RenderNode, wrap: NonNullable<NodeRule["wrap"]>): RenderNode {
  switch (wrap) {
    case "subscript":
      // Render the node as inline subscript. The browser path
      // wraps in <sub>; the SVG-export path positions baseline-
      // shifted. For now: tag the node so the platform layer can
      // recognize it.
      return tagNode(node, "wrap:subscript");
    case "superscript":
      return tagNode(node, "wrap:superscript");
    case "newline":
      return tagNode(node, "wrap:newline");
    default:
      return node;
  }
}

function tagNode(node: RenderNode, t: string): RenderNode {
  if (node.kind === "text" || node.kind === "group") {
    return { ...node, tags: [...(node.tags ?? []), t] };
  }
  return node;
}

// ────────────────────────────────────────────────────────────────────
// Authoring helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Attach one or more tags to a RenderNode. Returns a new node;
 * does not mutate. Useful inside renderers for marking semantic
 * roles without committing to a style.
 *
 *   tag(text("0.85"), "interval-point")
 *   tag(compose(...), ["interval-range", "minor"])
 *
 * Tags are supported on RenderText and RenderGroup only; other
 * RenderNode kinds (svg / spacer / image) pass through unchanged.
 */
export function tag(node: RenderNode, t: string | string[]): RenderNode {
  if (node.kind !== "text" && node.kind !== "group") return node;
  const incoming: string[] = Array.isArray(t) ? t : [t];
  const existing: string[] = node.tags ?? [];
  return { ...node, tags: [...existing, ...incoming] };
}

/** Convenience constructor for a tagged text node. */
export function textTagged(value: string, t: string | string[]): RenderText {
  const tagsArr = Array.isArray(t) ? t : [t];
  return { kind: "text", value, tags: tagsArr };
}

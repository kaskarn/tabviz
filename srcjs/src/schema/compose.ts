// compose() — layout combinator for cell formatters.
//
// The leaf concrete schema's formatter typically calls 1-N parent
// formatters and combines the resulting RenderNodes. This helper
// expresses the data-table templating patterns that actually come up:
//
//   compose(a, b, c)                         → "a b c"
//   compose(a, b, c, { sep: ", " })          → "a, b, c"
//   compose(a, b, c, { bracketStart: 2 })    → "a (b, c)"
//   compose(a, b, { sep: " ± ", minor: 2 })  → "a ± b"  with b muted+small
//
// Composes via grouping + per-child style overlay; never mutates inputs.

import type {
  RenderNode,
  RenderText,
  RenderGroup,
  TextStyle,
  ComposeOptions,
} from "./render-types";

/**
 * Compose 1+ RenderNodes into a row-laid-out group with optional
 * separators, bracketing, and minor styling. Pure; no mutation.
 *
 * Signature accepts variadic nodes with an optional trailing options
 * object: `compose(a, b, c)` or `compose(a, b, { sep: ", " })`.
 */
export function compose(...args: (RenderNode | ComposeOptions)[]): RenderGroup {
  // Last arg is options iff it's a non-null object without a `kind` key.
  let opts: ComposeOptions = {};
  let nodes: RenderNode[];
  const last = args[args.length - 1];
  if (
    typeof last === "object" &&
    last !== null &&
    !("kind" in last)
  ) {
    opts = last as ComposeOptions;
    nodes = args.slice(0, -1) as RenderNode[];
  } else {
    nodes = args as RenderNode[];
  }

  if (nodes.length === 0) {
    return { kind: "group", children: [], layout: opts.layout ?? "row" };
  }

  // 1. Apply "minor" styling overlay to nodes at index `minor-1` and beyond.
  const styled = nodes.map((n, i) =>
    opts.minor !== undefined && i >= opts.minor - 1
      ? withStyle(n, { size: "minor", color: "muted" })
      : n,
  );

  // 2. Apply bracketing: nodes from index `bracketStart-1` get wrapped
  //    in parens with the separator inside; nodes before stay outside.
  const sep = opts.sep ?? " ";
  let children: RenderNode[];
  if (opts.bracketStart !== undefined && opts.bracketStart >= 1) {
    const before = styled.slice(0, opts.bracketStart - 1);
    const inside = styled.slice(opts.bracketStart - 1);
    const bracketed: RenderNode[] = [
      text("("),
      ...interleave(inside, text(sep)),
      text(")"),
    ];
    // before joined by sep, then a space, then the bracketed group
    children = [...interleave(before, text(sep)), ...(before.length > 0 ? [text(" ")] : []), ...bracketed];
  } else {
    children = interleave(styled, text(sep));
  }

  return {
    kind: "group",
    children,
    layout: opts.layout ?? "row",
  };
}

// ────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────

/**
 * Render-node text primitive. Exported so third-party renderers can
 * build trees without re-deriving the literal-object shape.
 */
export function text(value: string): RenderText {
  return { kind: "text", value };
}

function interleave<T>(items: T[], sep: T): T[] {
  if (items.length === 0) return [];
  const out: T[] = [items[0]];
  for (let i = 1; i < items.length; i++) {
    out.push(sep, items[i]);
  }
  return out;
}

/**
 * Recursively apply a TextStyle overlay to a render node. Leaves
 * untouched fields untouched (caller's style values take precedence);
 * groups walk into children. Exported so renderers that hand-build a
 * subtree (e.g. interval bounds) can apply the same minor/muted overlay
 * `compose({minor})` uses, instead of re-deriving the style merge.
 */
export function withStyle(node: RenderNode, overlay: TextStyle): RenderNode {
  switch (node.kind) {
    case "text":
      return { ...node, style: { ...overlay, ...node.style } };
    case "group":
      return { ...node, children: node.children.map((c) => withStyle(c, overlay)) };
    // Other node kinds carry no TextStyle slot — pass through.
    case "svg":
    case "spacer":
    case "image":
    default:
      return node;
  }
}

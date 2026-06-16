// portal — small Svelte action that moves an element to a target node
// (default: document.body) on mount, then back to its original parent
// on destroy. Used to escape transformed ancestors that turn
// position: fixed into position: absolute-style behavior.
//
// Usage:
//   <div use:portal>…</div>
//   <div use:portal={document.body}>…</div>
//   <div use:portal={"body"}>…</div>
//
// TRAP (D4): moving to body DOES break inherited CSS variables. The tabviz
// theme custom properties are scoped to `.tabviz-container` (applied as inline
// style), so a portaled element loses them and falls back to its hardcoded
// CSS-var defaults — portaled popovers render fallback chrome by design. If a
// portaled element needs a live theme value (e.g. the accent), pass it in as an
// inline style prop rather than relying on the unreachable var.

export type PortalTarget = HTMLElement | "body" | undefined;

export function portal(node: HTMLElement, target: PortalTarget = "body") {
  function getTarget(t: PortalTarget): HTMLElement {
    if (t instanceof HTMLElement) return t;
    return document.body;
  }
  let host: HTMLElement = getTarget(target);
  host.appendChild(node);
  return {
    update(next: PortalTarget) {
      host = getTarget(next);
      host.appendChild(node);
    },
    destroy() {
      if (node.parentNode) node.parentNode.removeChild(node);
    },
  };
}

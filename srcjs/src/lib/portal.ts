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
// The element keeps its computed styles (no DOM-tree reparenting
// would change inherited CSS variables since we move-to-body, not
// detach-from-document).

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

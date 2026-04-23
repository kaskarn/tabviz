<!--
  Portal — renders its children into a target DOM node (default: document.body)
  so they escape ancestor clipping (overflow:hidden) and any containing-block
  ancestor (`transform`, `filter`, `backdrop-filter`, `perspective`, `contain`,
  or `will-change`). Those CSS properties hijack `position: fixed` descendants,
  causing viewport-relative coords to anchor to the wrong box — a trap we've
  hit repeatedly with toolbar styling. By portaling popovers to body, we
  decouple popover placement from whatever CSS happens to live in the tree.

  Usage:

    <Portal>
      <div class="my-popover" use:autoPosition={{ triggerEl }}>
        ...
      </div>
    </Portal>

  `to` accepts either an HTMLElement or a CSS selector (default `"body"`).

  Lifecycle (verified with Svelte 5 runes):
    - mount: the wrapper div is inserted into the target.
    - unmount (e.g. `{#if open}` flips false): the action's destroy() runs,
      which calls `node.remove()`. Svelte's own teardown then calls detach(),
      which is a no-op because `node.parentNode` is already null. No throws,
      no dangling DOM.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Target element or CSS selector. Defaults to `document.body`. */
    to?: HTMLElement | string;
    children: Snippet;
  }

  let { to = "body", children }: Props = $props();

  function portal(node: HTMLElement) {
    const target: Element | null =
      typeof to === "string" ? document.querySelector(to) : to;
    if (!target) {
      // Target missing — leave the node where Svelte mounted it so the user
      // still sees something, rather than silently rendering nothing.
      // (Happens in edge cases like SSR or when `to` selector is typo'd.)
      return {};
    }
    target.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

<!-- `display: contents` keeps the wrapper inert for layout while it still
     carries children. The children render directly inside the portal target. -->
<div use:portal style="display: contents;">
  {@render children()}
</div>

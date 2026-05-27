<!--
  Tooltip — instant, styled, portaled tooltip for the v2 surface.

  Renders the trigger inline and the bubble in a document.body portal
  so it escapes any `contain: layout / paint` ancestor (which makes
  position:fixed scope to the contain root — the same bug that bit
  EditableCell / HeaderContextMenu / DropIndicator).

  Why not native `title=`?
   - 500ms+ delay on hover (feels broken for short hints).
   - Browsers strip tooltips inside `position: fixed` portaled blocks
     in some configurations.
   - Unstylable — looks foreign next to the editorial-aesthetic UI.

  API:
   <Tooltip text="...">
     <span class="?-chip">?</span>     ← whatever the trigger is
   </Tooltip>

  Behavior:
   - Show on pointerenter / focus.
   - Hide on pointerleave / blur.
   - Position above the trigger by default; flip below when there's no
     room. Clamped to viewport with 8 px padding.
   - aria-describedby on the trigger so screen readers announce the
     tooltip when the trigger receives focus.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { portal } from "$lib/portal";
  import type { Snippet } from "svelte";

  interface Props {
    /** Tooltip text. Multi-line allowed (rendered as `white-space: pre-wrap`). */
    text: string;
    /** Anchor element ARIA description target. Set if you want the
     *  trigger's aria-describedby to point at the bubble for SR users. */
    id?: string;
    /** Snippet rendered as the inline trigger. The component wraps it in a
     *  <span class="tt-trigger"> so it can attach the hover/focus listeners. */
    children: Snippet;
  }
  let { text, id, children }: Props = $props();

  let bubbleEl: HTMLDivElement | null = $state(null);
  let triggerEl: HTMLSpanElement | null = $state(null);
  let open = $state(false);

  // Bubble position. Computed from the trigger's bounding rect on every
  // show — handles scrolled containers + transformed-ancestor cases
  // (portal escape gives us viewport-relative coords).
  let bubbleStyle = $state("");

  function reposition() {
    if (!open || !triggerEl || !bubbleEl) return;
    const tr = triggerEl.getBoundingClientRect();
    const br = bubbleEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;

    // Default: above the trigger, horizontally centered.
    let top = tr.top - br.height - 6;
    let left = tr.left + tr.width / 2 - br.width / 2;
    // Flip below when there's no room above.
    if (top < pad) top = tr.bottom + 6;
    // Clamp horizontally so the bubble doesn't run off-viewport.
    if (left < pad) left = pad;
    if (left + br.width > vw - pad) left = Math.max(pad, vw - pad - br.width);
    // If still off-viewport vertically (very tall bubble), pin to top.
    if (top + br.height > vh - pad) top = Math.max(pad, vh - pad - br.height);

    bubbleStyle = `top:${top}px; left:${left}px;`;
  }

  function show() {
    if (open) return;
    open = true;
    // Defer reposition until the bubble is in the DOM with measurable
    // dimensions.
    queueMicrotask(reposition);
  }
  function hide() { open = false; }

  // Re-position on scroll / resize so the bubble tracks its anchor.
  function onScroll() { reposition(); }
  function onResize() { reposition(); }
  $effect(() => {
    if (!open) return;
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  });
  onDestroy(() => { open = false; });
</script>

<span
  bind:this={triggerEl}
  class="tt-trigger"
  onpointerenter={show}
  onpointerleave={hide}
  onfocusin={show}
  onfocusout={hide}
  aria-describedby={id}
>
  {@render children()}
</span>

{#if open}
  <div
    bind:this={bubbleEl}
    class="tt-bubble"
    role="tooltip"
    {id}
    style={bubbleStyle}
    use:portal
  >{text}</div>
{/if}

<style>
  .tt-trigger {
    display: inline-flex;
    align-items: center;
  }
  .tt-bubble {
    position: fixed;
    z-index: 10090;
    max-width: 280px;
    padding: 5px 8px;
    background: var(--v2-ink, #15140e);
    color: var(--v2-paper, #faf7f0);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-small, 10.5px);
    line-height: 1.35;
    border-radius: var(--v2-r-soft, 3px);
    box-shadow: 0 6px 16px -2px rgba(15, 23, 42, 0.25);
    white-space: pre-wrap;
    pointer-events: none;
    animation: tt-in 80ms ease-out;
  }
  @keyframes tt-in {
    from { opacity: 0; transform: translateY(2px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
</style>

<!--
  ColumnEditorV2Popover — thin positioning shell that wraps
  ColumnEditorV2 for the real widget. Handles:

  1. Viewport-clamped positioning from EditorTarget.anchorX/anchorY,
     following the same algorithm as the legacy ColumnEditorPopover
     (try below the anchor; flip above if it would overflow; clamp
     to viewport with 8px padding).
  2. Portal: appends itself to `document.body` so the editor lives
     outside the (potentially scaled) widget wrapper. Position: fixed
     works in both normal and fullscreen modes — the fullscreen
     overlay uses z-index 9991 and we sit at 10003, matching the
     legacy editor's stacking.
  3. Outside-click + Escape dismissal.
  4. EditorTarget → ColumnEditorV2 prop mapping, including building a
     fresh ColumnSpec on commit.

  Behavior is feature-flagged into TabvizOverlays.svelte; when
  `window.__tabvizEditorV2` is truthy, this mounts instead of the
  legacy editor.
-->
<script lang="ts" module>
  import type { ColumnSpec as _ColumnSpec, ColumnType as _ColumnType } from "$types";

  /** The popover's open-state descriptor.
   *
   *  Two modes:
   *    - `"insert"` — opening a fresh column at a given anchor; the
   *      ColumnTypeMenu chose `type` (and optionally `seedOptions`).
   *    - `"configure"` — editing an existing column; the popover
   *      hydrates from `existing` and re-emits a ColumnSpec on commit.
   */
  export interface EditorTarget {
    mode: "insert" | "configure";
    anchorX: number;
    anchorY: number;
    /** For "insert": column id to insert after ("__start__" for first). */
    afterId?: string;
    /** For "configure": the existing column spec being edited. */
    existing?: _ColumnSpec;
    /** Pre-selected visual type from ColumnTypeMenu. */
    type?: _ColumnType;
    /** Human label for the chosen preset (shown in the header). */
    presetLabel?: string;
    /** Options bundle pre-seeded from the preset. */
    seedOptions?: _ColumnSpec["options"];
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { portal } from "$lib/portal";
  import type { AvailableField, ColumnSpec } from "../../types";
  // Load v2 design tokens — the [data-tv-v2] cascade gates every
  // primitive's styling. Importing here means the tokens land in the
  // widget bundle exactly once, no matter which component pulls in
  // the popover.
  import "../primitives/v2/tokens.css";
  import ColumnEditorV2 from "./ColumnEditorV2.svelte";
  import { schemaForColumnType } from "./schema-for-type";
  import type { ColumnSchema } from "../../schema/types";
  // EditorTarget is declared in the `<script module>` block above and
  // is in scope here.

  interface Props {
    target: EditorTarget | null;
    available: AvailableField[];
    onCommit: (spec: ColumnSpec, mode: "insert" | "configure", afterId?: string) => void;
    onClose: () => void;
    onRequestChangeType?: () => void;
  }

  let { target, available, onCommit, onClose }: Props = $props();

  // ── Resolve schema + initial column draft from the target ─────
  const schema = $derived<ColumnSchema | null>(
    target ? (schemaForColumnType((target.existing?.type ?? target.type ?? "text"))) : null,
  );

  // Synchronously seed the draft from target on every change.
  // Using $effect.pre fires BEFORE the child renders, so the first
  // pass of readSlot sees the hydrated values. $effect (post-render)
  // would leave the editor showing placeholders until the next tick.
  let draft: Partial<ColumnSpec> = $state({});
  let lastTargetKey = "";
  $effect.pre(() => {
    if (!target) { draft = {}; lastTargetKey = ""; return; }
    // Cheap identity check: only re-seed when target's identifying
    // fields change. Otherwise an in-flight `draft` edit (which the
    // child may have written via bind:column) gets clobbered.
    const key = `${target.mode}|${target.existing?.id ?? ""}|${target.type ?? ""}|${target.anchorX}|${target.anchorY}`;
    if (key === lastTargetKey) return;
    lastTargetKey = key;
    if (target.mode === "configure" && target.existing) {
      // $state.snapshot unwraps Svelte's reactive proxy so we get a
      // plain object the draft can own and mutate independently of
      // the live column in the store. structuredClone alone trips on
      // the proxy with DataCloneError.
      draft = $state.snapshot(target.existing) as Partial<ColumnSpec>;
    } else {
      // Insert mode: seed a minimal column with the picked type + preset options.
      draft = {
        id: `col_${Date.now().toString(36)}`,
        type: target.type ?? "text",
        header: target.presetLabel ?? "",
        align: "left",
        options: target.seedOptions ?? {},
        sortable: true,
        isGroup: false,
        field: "",
      } as Partial<ColumnSpec>;
    }
  });

  // ── Positioning — viewport-clamped, fixed-position ──────────
  let popoverEl: HTMLDivElement | undefined = $state();
  let resolvedLeft = $state(0);
  let resolvedTop = $state(0);
  // Once the user grabs the header, their drag wins over the anchor-
  // based auto-position. Without this, every reposition() call (after
  // resize, etc.) would yank the popover back to the anchor.
  let userMoved = $state(false);

  function reposition() {
    if (!target || !popoverEl) return;
    if (userMoved) return;  // honor the drag; only clamp on viewport changes
    const rect = popoverEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;

    let left = target.anchorX;
    if (left + rect.width > vw - pad) left = Math.max(pad, vw - pad - rect.width);
    if (left < pad) left = pad;

    let top = target.anchorY + 4;
    if (top + rect.height > vh - pad) {
      const altTop = target.anchorY - rect.height - 4;
      if (altTop >= pad) top = altTop;
      else top = Math.max(pad, vh - pad - rect.height);
    }
    if (top < pad) top = pad;
    resolvedLeft = left;
    resolvedTop = top;
  }

  $effect(() => {
    if (!target) return;
    userMoved = false;  // re-anchor on new open
    // Defer until the popover has measurable dimensions.
    requestAnimationFrame(reposition);
  });

  // ── Drag-to-move ───────────────────────────────────────────
  // Press on the header bar to drag the popover. Uses pointer capture
  // so the drag survives the cursor leaving the header / widget area
  // (the same "stuck-drag" pattern that plagued row-resize). Live
  // preview during the move; positions clamped to viewport on release.
  let dragOffX = 0;
  let dragOffY = 0;
  let dragging = $state(false);
  function startDrag(e: PointerEvent) {
    if (!popoverEl) return;
    // Ignore drags initiated on interactive descendants (buttons,
    // inputs, icons) — they own their own click behavior. Only the
    // bare header area should grab the drag.
    const t = e.target as HTMLElement;
    if (t.closest("button, input, [role='button'], a")) return;
    e.preventDefault();
    const rect = popoverEl.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    dragging = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDrag(e: PointerEvent) {
    if (!dragging) return;
    const pad = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = popoverEl?.offsetWidth ?? 0;
    const h = popoverEl?.offsetHeight ?? 0;
    let left = e.clientX - dragOffX;
    let top  = e.clientY - dragOffY;
    if (left < pad) left = pad;
    if (top  < pad) top  = pad;
    if (left + w > vw - pad) left = vw - pad - w;
    if (top  + h > vh - pad) top  = vh - pad - h;
    resolvedLeft = left;
    resolvedTop  = top;
    userMoved = true;
  }
  function endDrag(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }

  // ── Dismiss handlers ─────────────────────────────────────────
  function onKey(e: KeyboardEvent) {
    if (!target) return;
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }
  function onDocPointer(e: PointerEvent) {
    if (!target || !popoverEl) return;
    const t = e.target as Node | null;
    if (t && popoverEl.contains(t)) return;
    onClose();
  }
  onMount(() => {
    window.addEventListener("keydown", onKey);
    // Pointerdown rather than click so menu/select pickers don't
    // dismiss the editor when their click bubbles up.
    document.addEventListener("pointerdown", onDocPointer, true);
    window.addEventListener("resize", reposition);
  });
  onDestroy(() => {
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onDocPointer, true);
    window.removeEventListener("resize", reposition);
  });

  // ── Commit ─────────────────────────────────────────────────
  function commit() {
    if (!target || !schema) return;
    // The draft is a Partial<ColumnSpec>; the legacy callers expect a
    // fully-formed ColumnSpec. Fill defaults from the schema for any
    // missing top-level fields.
    const spec: ColumnSpec = {
      id:       (draft.id as string) ?? target.existing?.id ?? `col_${Date.now().toString(36)}`,
      header:   (draft.header as string) ?? "",
      field:    (draft.field as string) ?? "",
      type:     (draft.type ?? target.type ?? "text") as ColumnSpec["type"],
      align:    (draft.align as ColumnSpec["align"]) ?? "left",
      sortable: draft.sortable ?? true,
      isGroup:  false,
      width:    draft.width as ColumnSpec["width"],
      options:  draft.options ?? {},
      ...(draft.headerAlign != null ? { headerAlign: draft.headerAlign } : {}),
      ...(draft.showHeader != null ? { showHeader: draft.showHeader } : {}),
      ...(draft.wrap != null ? { wrap: draft.wrap } : {}),
      ...(draft.styleMapping != null ? { styleMapping: draft.styleMapping } : {}),
    };
    onCommit(spec, target.mode, target.afterId);
  }

  function onEditorCommit(next: Partial<ColumnSpec>) {
    draft = next;
  }
</script>

{#if target && schema}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="v2-popover-shell"
    class:dragging
    data-tv-v2
    bind:this={popoverEl}
    style:left="{resolvedLeft}px"
    style:top="{resolvedTop}px"
    onpointerdown={(e) => {
      // Only initiate drag from the editor's header strip — leaves
      // buttons + inputs in the rest of the popover untouched.
      if ((e.target as HTMLElement).closest("header.head")) startDrag(e);
    }}
    onpointermove={onDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    use:portal
  >
    <ColumnEditorV2
      {schema}
      bind:column={draft}
      {available}
      oncommit={onEditorCommit}
      onclose={onClose}
      onsave={commit}
      saveLabel={target.mode === "insert" ? "Insert" : "Save"}
    />
  </div>
{/if}

<style>
  /* The shell is position:fixed so it sits in viewport coordinates
     regardless of any transform/scale on the widget container. The
     z-index matches the legacy editor (10003), which means it lands
     above the fullscreen overlay (9991) and the backdrop (9990). */
  .v2-popover-shell {
    position: fixed;
    z-index: 10003;
    /* The editor body owns its own width (400px) + the foot row
       extends it slightly via padding. Wrap in a column so the foot
       buttons land below the editor body. */
    display: flex;
    flex-direction: column;
    isolation: isolate;
    /* Scroll-trap: when the popover's scrollable body reaches its
       top/bottom edge, wheel events should NOT bubble out and scroll
       the host page. `overscroll-behavior: contain` is the standard
       knob for that. Caps height so the body can actually scroll
       when the column has many options. */
    max-height: calc(100vh - 16px);
    overflow: hidden;
    overscroll-behavior: contain;
  }
  /* Apply scroll-trap to the scrollable child too — the popover
     itself doesn't scroll (overflow:hidden); the editor body inside
     does. Both layers contain so neither chains. */
  .v2-popover-shell :global(.body) {
    overscroll-behavior: contain;
  }

  .v2-popover-shell.dragging {
    cursor: grabbing;
    user-select: none;
  }
  .v2-popover-shell :global(header.head) {
    cursor: grab;
  }
  .v2-popover-shell.dragging :global(header.head) {
    cursor: grabbing;
  }

  /* (Footer retired — the save/insert button now hangs next to the
     close X in the editor masthead via ColumnEditorV2's editor-actions
     cluster.) */

</style>

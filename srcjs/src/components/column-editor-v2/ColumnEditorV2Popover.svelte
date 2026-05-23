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
  // Re-export EditorTarget so callers can import from either editor
  // without changing types.
  export type { EditorTarget } from "../controls/ColumnEditorPopover.svelte";
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
  import type { EditorTarget } from "../controls/ColumnEditorPopover.svelte";

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

  // Local mutable draft. Reseeded whenever target changes.
  let draft: Partial<ColumnSpec> = $state({});
  $effect(() => {
    if (!target) { draft = {}; return; }
    if (target.mode === "configure" && target.existing) {
      draft = structuredClone(target.existing as unknown as Record<string, unknown>) as Partial<ColumnSpec>;
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

  function reposition() {
    if (!target || !popoverEl) return;
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
    // Defer until the popover has measurable dimensions.
    requestAnimationFrame(reposition);
  });

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
  <div
    class="v2-popover-shell"
    data-tv-v2
    bind:this={popoverEl}
    style:left="{resolvedLeft}px"
    style:top="{resolvedTop}px"
    use:portal
  >
    <ColumnEditorV2
      {schema}
      bind:column={draft}
      {available}
      oncommit={onEditorCommit}
      onclose={onClose}
    />
    <div class="v2-popover-foot">
      <button type="button" class="secondary" onclick={onClose}>Cancel</button>
      <button type="button" class="primary" onclick={commit}>
        {target.mode === "insert" ? "Insert" : "Save"}
      </button>
    </div>
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
  }

  .v2-popover-foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 12px 10px;
    background: var(--v2-paper-2, #f3efe5);
    border-top: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: 0 0 var(--v2-r-large, 6px) var(--v2-r-large, 6px);
    margin-top: -1px;
  }
  .v2-popover-foot button {
    appearance: none;
    border: 0;
    padding: 4px 12px;
    border-radius: var(--v2-r-soft, 3px);
    font: inherit;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    cursor: pointer;
    transition: background var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .v2-popover-foot .secondary {
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
  }
  .v2-popover-foot .secondary:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .v2-popover-foot .primary {
    background: var(--v2-ink, #15140e);
    color: var(--v2-paper, #faf7f0);
  }
  .v2-popover-foot .primary:hover {
    background: var(--v2-ink-2, #4a463c);
  }

</style>

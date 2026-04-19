<script lang="ts" module>
  export interface ContextMenuTarget {
    columnId: string;
    columnHeader: string;
    anchorX: number;
    anchorY: number;
    // True for user-inserted or override-able columns; controls whether "Hide"
    // is offered. Currently all regular data columns are hideable.
    canHide: boolean;
    // False for viz column types whose structure (multi-field, extra_columns)
    // can't round-trip through the slot-based editor popover. Hides "Configure…".
    canConfigure: boolean;
    // Current effective visibility of the column's header cell; drives the
    // "Hide header" / "Show header" toggle label.
    headerShown: boolean;
  }

  export type ContextMenuAction = "hide" | "insert" | "configure" | "toggle-header";
</script>

<script lang="ts">
  type Action = ContextMenuAction;

  interface Props {
    target: ContextMenuTarget | null;
    onAction: (action: Action) => void;
    onClose: () => void;
  }

  let { target, onAction, onClose }: Props = $props();

  let menuEl: HTMLDivElement | null = $state(null);
  let resolvedLeft = $state(0);
  let resolvedTop = $state(0);

  // Clamp into viewport once laid out.
  $effect(() => {
    if (!target || !menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;

    let left = target.anchorX;
    if (left + rect.width > vw - pad) left = Math.max(pad, vw - pad - rect.width);
    if (left < pad) left = pad;

    let top = target.anchorY;
    if (top + rect.height > vh - pad) {
      top = Math.max(pad, target.anchorY - rect.height);
    }
    resolvedLeft = left;
    resolvedTop = top;
  });

  function handlePointerDown(e: PointerEvent) {
    if (!target) return;
    const tgt = e.target as HTMLElement;
    if (menuEl && menuEl.contains(tgt)) return;
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!target) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  function pick(action: Action) {
    onAction(action);
  }
</script>

<svelte:window onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

{#if target}
  <div
    class="header-ctx-menu"
    bind:this={menuEl}
    style:left="{resolvedLeft}px"
    style:top="{resolvedTop}px"
    role="menu"
    aria-label="Column actions: {target.columnHeader}"
  >
    <div class="ctx-title" title={target.columnHeader}>{target.columnHeader}</div>
    {#if target.canConfigure}
      <button type="button" class="ctx-item" role="menuitem" onclick={() => pick("configure")}>
        Configure…
      </button>
    {/if}
    <button type="button" class="ctx-item" role="menuitem" onclick={() => pick("toggle-header")}>
      {target.headerShown ? "Hide header" : "Show header"}
    </button>
    <button type="button" class="ctx-item" role="menuitem" onclick={() => pick("insert")}>
      Insert column after…
    </button>
    {#if target.canHide}
      <button type="button" class="ctx-item destructive" role="menuitem" onclick={() => pick("hide")}>
        Hide column
      </button>
    {/if}
  </div>
{/if}

<style>
  .header-ctx-menu {
    position: fixed;
    min-width: 180px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 6px;
    box-shadow: 0 6px 20px -4px rgba(0, 0, 0, 0.14);
    z-index: 10003;
    padding: 4px;
    font-family: inherit;
    font-size: 12px;
    color: var(--wf-fg, #1a1a1a);
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .ctx-title {
    padding: 6px 8px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--wf-secondary, #64748b);
    border-bottom: 1px solid var(--wf-border, #e2e8f0);
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 240px;
  }
  .ctx-item {
    background: transparent;
    border: none;
    text-align: left;
    padding: 6px 10px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    color: var(--wf-fg, #1a1a1a);
    cursor: pointer;
  }
  .ctx-item:hover,
  .ctx-item:focus-visible {
    background: var(--wf-border, #f1f5f9);
    outline: none;
  }
  .ctx-item.destructive {
    color: var(--wf-fg, #1a1a1a);
  }
  .ctx-item.destructive:hover {
    background: rgba(220, 38, 38, 0.08);
    color: #dc2626;
  }
</style>

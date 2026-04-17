<script lang="ts" module>
  import type { ColumnSpec, ColumnType } from "$types";

  export interface TypeMenuTarget {
    anchorX: number;
    anchorY: number;
    // When present, the menu opens in "replace type" mode for configure flow.
    // The editor will be reopened in configure mode preserving the existing id / field.
    existingId?: string;
    // When present, insert-after anchor column id ("__start__" for first).
    afterId?: string;
  }

  // What the menu emits when the user picks a leaf.
  export interface TypePick {
    type: ColumnType;
    // Human label for display (e.g. "Integer", "Percent") — differs from type for numeric presets.
    presetLabel: string;
    // Options pre-seeded from the chosen preset (e.g. { numeric: { decimals: 0 } } for Integer).
    seedOptions?: ColumnSpec["options"];
  }
</script>

<script lang="ts">
  import type { AvailableField } from "$types";
  import { VISUAL_TYPES, isTypeSatisfiable, getVisualTypeDef } from "$lib/column-compat";

  interface Props {
    target: TypeMenuTarget | null;
    available: AvailableField[];
    onPick: (pick: TypePick) => void;
    onClose: () => void;
  }

  let { target, available, onPick, onClose }: Props = $props();

  // Menu structure. Leaves carry the exact type + seed-options bundle.
  interface Leaf {
    kind: "leaf";
    key: string;
    label: string;
    type: ColumnType;
    seedOptions?: ColumnSpec["options"];
  }
  interface Group {
    label: string;
    items: Leaf[];
  }
  interface Submenu {
    kind: "submenu";
    key: string;
    label: string;
    items?: Leaf[];
    groups?: Group[];
  }
  type MenuEntry = Leaf | Submenu;

  const MENU: MenuEntry[] = [
    { kind: "leaf", key: "text", label: "Text", type: "text" },
    {
      kind: "submenu",
      key: "numbers",
      label: "Numbers",
      items: [
        { kind: "leaf", key: "number", label: "Number", type: "numeric" },
        {
          kind: "leaf",
          key: "integer",
          label: "Integer",
          type: "numeric",
          seedOptions: { numeric: { decimals: 0 } },
        },
        {
          kind: "leaf",
          key: "percent",
          label: "Percent",
          type: "numeric",
          seedOptions: { numeric: { suffix: "%" } },
        },
        {
          kind: "leaf",
          key: "currency",
          label: "Currency",
          type: "numeric",
          seedOptions: { numeric: { prefix: "$", decimals: 2 } },
        },
        { kind: "leaf", key: "pvalue", label: "P-value", type: "pvalue" },
      ],
    },
    {
      kind: "submenu",
      key: "composite",
      label: "Composite",
      items: [
        { kind: "leaf", key: "range", label: "Range", type: "range" },
        { kind: "leaf", key: "interval", label: "Interval", type: "interval" },
        { kind: "leaf", key: "events", label: "Events (x / N)", type: "custom" },
      ],
    },
    {
      kind: "submenu",
      key: "visual",
      label: "Visual",
      groups: [
        {
          label: "Simple",
          items: [
            { kind: "leaf", key: "bar", label: "Bar", type: "bar" },
            { kind: "leaf", key: "progress", label: "Fill bar", type: "progress" },
            { kind: "leaf", key: "sparkline", label: "Sparkline", type: "sparkline" },
            { kind: "leaf", key: "heatmap", label: "Heatmap", type: "heatmap" },
            { kind: "leaf", key: "stars", label: "Stars", type: "stars" },
          ],
        },
        {
          label: "Complex",
          items: [
            { kind: "leaf", key: "forest", label: "Forest plot", type: "forest" },
          ],
        },
      ],
    },
    {
      kind: "submenu",
      key: "icons",
      label: "Icons",
      items: [
        { kind: "leaf", key: "badge", label: "Badge", type: "badge" },
        { kind: "leaf", key: "icon", label: "Icon", type: "icon" },
        { kind: "leaf", key: "img", label: "Image", type: "img" },
        { kind: "leaf", key: "reference", label: "Link / reference", type: "reference" },
      ],
    },
  ];

  function leafSatisfiable(leaf: Leaf): boolean {
    const def = getVisualTypeDef(leaf.type);
    if (!def) return false;
    return isTypeSatisfiable(def, available);
  }

  function leafDescription(leaf: Leaf): string {
    const def = getVisualTypeDef(leaf.type);
    return def?.description ?? "";
  }

  // A submenu is available if at least one of its leaves is satisfiable.
  function submenuAvailable(sm: Submenu): boolean {
    if (sm.items) return sm.items.some(leafSatisfiable);
    if (sm.groups) return sm.groups.some((g) => g.items.some(leafSatisfiable));
    return false;
  }

  let menuEl: HTMLDivElement | null = $state(null);
  let submenuEl: HTMLDivElement | null = $state(null);
  let resolvedLeft = $state(0);
  let resolvedTop = $state(0);
  let openSubmenuKey = $state<string | null>(null);
  let submenuLeft = $state<number | null>(null);
  let submenuTop = $state<number | null>(null);
  let submenuFlipLeft = $state(false);
  let hoverTimer: number | null = null;

  // Clamp the root menu into viewport.
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
    if (top + rect.height > vh - pad) top = Math.max(pad, vh - pad - rect.height);
    resolvedLeft = left;
    resolvedTop = top;
  });

  // Position the submenu relative to its parent item, flipping to the left if it would
  // overflow the viewport on the right.
  function positionSubmenu(anchorRow: HTMLElement) {
    if (!menuEl) return;
    const rootRect = menuEl.getBoundingClientRect();
    const rowRect = anchorRow.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    // Estimated submenu width; the real width is computed after render, but 200 is close.
    const approxWidth = 220;
    const approxHeight = 260;

    // Prefer right side, flip left if not enough room.
    const rightEdge = rootRect.right + approxWidth;
    const flip = rightEdge > vw - pad;
    submenuFlipLeft = flip;
    submenuLeft = flip ? rootRect.left - approxWidth + 4 : rootRect.right - 4;

    let top = rowRect.top;
    if (top + approxHeight > vh - pad) {
      top = Math.max(pad, vh - pad - approxHeight);
    }
    submenuTop = top;
  }

  function openSubmenu(key: string, anchor: HTMLElement) {
    if (hoverTimer) {
      window.clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    openSubmenuKey = key;
    queueMicrotask(() => positionSubmenu(anchor));
  }

  function scheduleOpenSubmenu(key: string, anchor: HTMLElement) {
    if (openSubmenuKey === key) return;
    if (hoverTimer) window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => openSubmenu(key, anchor), 80);
  }

  function scheduleCloseSubmenu() {
    if (hoverTimer) window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      openSubmenuKey = null;
    }, 140);
  }

  function cancelCloseSubmenu() {
    if (hoverTimer) {
      window.clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (!target) return;
    const tgt = e.target as HTMLElement;
    if (menuEl && menuEl.contains(tgt)) return;
    if (submenuEl && submenuEl.contains(tgt)) return;
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!target) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (openSubmenuKey) openSubmenuKey = null;
      else onClose();
    }
  }

  function pick(leaf: Leaf) {
    if (!leafSatisfiable(leaf)) return;
    onPick({
      type: leaf.type,
      presetLabel: leaf.label,
      seedOptions: leaf.seedOptions,
    });
  }

  // Resolve which leaves the currently open submenu should display.
  const activeSubmenu = $derived(
    openSubmenuKey ? MENU.find((e) => e.kind === "submenu" && e.key === openSubmenuKey) as Submenu | undefined : undefined
  );
</script>

<svelte:window onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

{#if target}
  <div
    class="type-menu"
    bind:this={menuEl}
    style:left="{resolvedLeft}px"
    style:top="{resolvedTop}px"
    role="menu"
    aria-label="Insert column type"
  >
    <div class="menu-title">
      {target.existingId ? "Change column type" : "Insert column as"}
    </div>
    {#each MENU as entry (entry.key)}
      {#if entry.kind === "leaf"}
        {@const leaf = entry}
        {@const ok = leafSatisfiable(leaf)}
        <button
          type="button"
          class="menu-item"
          class:disabled={!ok}
          disabled={!ok}
          title={ok ? leafDescription(leaf) : `${leafDescription(leaf)} — no compatible fields`}
          role="menuitem"
          onpointerenter={() => { if (openSubmenuKey) scheduleCloseSubmenu(); }}
          onclick={() => pick(leaf)}
        >
          <span class="label">{leaf.label}</span>
        </button>
      {:else}
        {@const sm = entry}
        {@const ok = submenuAvailable(sm)}
        <button
          type="button"
          class="menu-item has-submenu"
          class:active={openSubmenuKey === sm.key}
          class:disabled={!ok}
          disabled={!ok}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={openSubmenuKey === sm.key}
          onpointerenter={(e) => ok && scheduleOpenSubmenu(sm.key, e.currentTarget)}
          onpointerleave={() => scheduleCloseSubmenu()}
          onclick={(e) => ok && openSubmenu(sm.key, e.currentTarget)}
        >
          <span class="label">{sm.label}</span>
          <svg class="caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M3 1 L7 5 L3 9" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      {/if}
    {/each}
  </div>

  {#if activeSubmenu && submenuLeft != null && submenuTop != null}
    <div
      class="type-submenu"
      class:flip-left={submenuFlipLeft}
      bind:this={submenuEl}
      style:left="{submenuLeft}px"
      style:top="{submenuTop}px"
      role="menu"
      onpointerenter={cancelCloseSubmenu}
      onpointerleave={scheduleCloseSubmenu}
    >
      {#if activeSubmenu.items}
        {#each activeSubmenu.items as leaf (leaf.key)}
          {@const ok = leafSatisfiable(leaf)}
          <button
            type="button"
            class="sub-item"
            class:disabled={!ok}
            disabled={!ok}
            title={ok ? leafDescription(leaf) : `${leafDescription(leaf)} — no compatible fields`}
            role="menuitem"
            onclick={() => pick(leaf)}
          >
            <span class="label">{leaf.label}</span>
          </button>
        {/each}
      {:else if activeSubmenu.groups}
        {#each activeSubmenu.groups as group (group.label)}
          <div class="sub-group-label">{group.label}</div>
          {#each group.items as leaf (leaf.key)}
            {@const ok = leafSatisfiable(leaf)}
            <button
              type="button"
              class="sub-item"
              class:disabled={!ok}
              disabled={!ok}
              title={ok ? leafDescription(leaf) : `${leafDescription(leaf)} — no compatible fields`}
              role="menuitem"
              onclick={() => pick(leaf)}
            >
              <span class="label">{leaf.label}</span>
            </button>
          {/each}
        {/each}
      {/if}
    </div>
  {/if}
{/if}

<style>
  .type-menu, .type-submenu {
    position: fixed;
    min-width: 180px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 7px;
    box-shadow: 0 10px 28px -8px rgba(15, 23, 42, 0.22);
    z-index: 10004;
    padding: 4px;
    font-family: inherit;
    font-size: 12px;
    color: var(--wf-fg, #1a1a1a);
    display: flex;
    flex-direction: column;
    gap: 1px;
    animation: type-menu-in 90ms ease-out;
  }

  .type-submenu {
    min-width: 200px;
    max-height: 360px;
    overflow-y: auto;
  }

  @keyframes type-menu-in {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .menu-title {
    padding: 6px 10px 4px;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--wf-muted, #64748b);
    border-bottom: 1px solid var(--wf-border, #e2e8f0);
    margin-bottom: 3px;
  }

  .menu-item, .sub-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: transparent;
    border: none;
    text-align: left;
    padding: 6px 10px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    color: var(--wf-fg, #1a1a1a);
    cursor: pointer;
    transition: background-color 0.08s ease, color 0.08s ease;
  }

  .menu-item:hover:not(.disabled),
  .menu-item:focus-visible,
  .menu-item.active,
  .sub-item:hover:not(.disabled),
  .sub-item:focus-visible {
    background: var(--wf-hover, #eef2ff);
    color: var(--wf-primary, #3b82f6);
    outline: none;
  }

  .menu-item.disabled,
  .sub-item.disabled {
    color: var(--wf-muted, #94a3b8);
    cursor: not-allowed;
    opacity: 0.55;
  }

  .caret {
    flex-shrink: 0;
    color: var(--wf-muted, #94a3b8);
  }
  .menu-item.active .caret,
  .menu-item:hover:not(.disabled) .caret {
    color: var(--wf-primary, #3b82f6);
  }

  .sub-group-label {
    padding: 6px 10px 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--wf-muted, #94a3b8);
  }
  .sub-group-label:not(:first-child) {
    margin-top: 4px;
    border-top: 1px solid var(--wf-border, #e2e8f0);
    padding-top: 7px;
  }
</style>

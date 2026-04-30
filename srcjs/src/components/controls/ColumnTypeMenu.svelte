<script lang="ts" module>
  import type { ColumnSpec, ColumnType } from "$types";

  export interface TypeMenuTarget {
    anchorX: number;
    anchorY: number;
    // When present, the menu opens in "replace type" mode for configure flow.
    existingId?: string;
    // When present, insert-after anchor column id ("__start__" for first).
    afterId?: string;
  }

  // What the menu emits when the user picks a leaf.
  export interface TypePick {
    type: ColumnType;
    presetLabel: string;
    seedOptions?: ColumnSpec["options"];
  }
</script>

<script lang="ts">
  import type { AvailableField } from "$types";
  import { isTypeSatisfiable, getVisualTypeDef } from "$lib/column-compat";
  import { tick } from "svelte";

  interface Props {
    target: TypeMenuTarget | null;
    available: AvailableField[];
    onPick: (pick: TypePick) => void;
    onClose: () => void;
  }

  let { target, available, onPick, onClose }: Props = $props();

  interface Leaf {
    kind: "leaf";
    key: string;
    label: string;
    type: ColumnType;
    seedOptions?: ColumnSpec["options"];
    // For flat search display, the submenu it lives in (e.g. "Numbers / Integer").
    breadcrumb?: string;
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
        { kind: "leaf", key: "integer", label: "Integer", type: "numeric", seedOptions: { numeric: { decimals: 0 } } },
        { kind: "leaf", key: "compact_int", label: "Compact int (1.2k)", type: "numeric", seedOptions: { numeric: { decimals: 0, abbreviate: true } } },
        { kind: "leaf", key: "percent", label: "Percent", type: "numeric", seedOptions: { numeric: { suffix: "%" } } },
        { kind: "leaf", key: "currency", label: "Currency", type: "numeric", seedOptions: { numeric: { prefix: "$", decimals: 2 } } },
        { kind: "leaf", key: "pvalue", label: "P-value", type: "pvalue" },
        { kind: "leaf", key: "pvalue_stars", label: "P-value w/ stars", type: "pvalue", seedOptions: { pvalue: { stars: true } } },
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
            { kind: "leaf", key: "heatmap_diverging", label: "Diverging heatmap", type: "heatmap", seedOptions: { heatmap: { palette: "diverging" } } },
            { kind: "leaf", key: "heatmap_sequential", label: "Sequential heatmap", type: "heatmap", seedOptions: { heatmap: { palette: "sequential" } } },
            { kind: "leaf", key: "stars", label: "Stars", type: "stars" },
            { kind: "leaf", key: "pictogram", label: "Pictogram", type: "pictogram" },
            { kind: "leaf", key: "ring", label: "Ring", type: "ring" },
          ],
        },
        {
          label: "Complex",
          items: [
            { kind: "leaf", key: "forest", label: "Forest plot", type: "forest" },
            { kind: "leaf", key: "forest_log", label: "Forest plot (log)", type: "forest", seedOptions: { forest: { scale: "log", nullValue: 1 } } },
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

  // Flatten all leaves once, annotated with breadcrumb, for the search mode.
  const ALL_LEAVES: Leaf[] = (() => {
    const out: Leaf[] = [];
    for (const entry of MENU) {
      if (entry.kind === "leaf") {
        out.push({ ...entry });
      } else if (entry.items) {
        for (const leaf of entry.items) out.push({ ...leaf, breadcrumb: entry.label });
      } else if (entry.groups) {
        for (const g of entry.groups) {
          for (const leaf of g.items) out.push({ ...leaf, breadcrumb: `${entry.label} · ${g.label}` });
        }
      }
    }
    return out;
  })();

  function leafSatisfiable(leaf: Leaf): boolean {
    const def = getVisualTypeDef(leaf.type);
    if (!def) return false;
    return isTypeSatisfiable(def, available);
  }

  function leafDescription(leaf: Leaf): string {
    const def = getVisualTypeDef(leaf.type);
    return def?.description ?? "";
  }

  function submenuAvailable(sm: Submenu): boolean {
    if (sm.items) return sm.items.some(leafSatisfiable);
    if (sm.groups) return sm.groups.some((g) => g.items.some(leafSatisfiable));
    return false;
  }

  let menuEl: HTMLDivElement | null = $state(null);
  let submenuEl: HTMLDivElement | null = $state(null);
  let searchInput: HTMLInputElement | null = $state(null);
  let resolvedLeft = $state(0);
  let resolvedTop = $state(0);
  let openSubmenuKey = $state<string | null>(null);
  let submenuLeft = $state<number | null>(null);
  let submenuTop = $state<number | null>(null);
  let submenuFlipLeft = $state(false);
  let hoverTimer: number | null = null;

  let search = $state("");
  // Focus index within the current "plane" (root entries, submenu items, or flat results).
  let focusIndex = $state(0);
  // Which plane is focused: "root" | "sub" | "search"
  let focusPlane = $state<"root" | "sub" | "search">("root");

  // Autofocus search on mount.
  $effect(() => {
    if (target && searchInput) {
      searchInput.focus();
    }
  });

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

  function positionSubmenu(anchorRow: HTMLElement) {
    if (!menuEl) return;
    const rootRect = menuEl.getBoundingClientRect();
    const rowRect = anchorRow.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const approxWidth = 200;
    const approxHeight = 240;

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

  function pick(leaf: Leaf) {
    if (!leafSatisfiable(leaf)) return;
    onPick({
      type: leaf.type,
      presetLabel: leaf.label,
      seedOptions: leaf.seedOptions,
    });
  }

  const activeSubmenu = $derived(
    openSubmenuKey ? MENU.find((e) => e.kind === "submenu" && e.key === openSubmenuKey) as Submenu | undefined : undefined
  );

  // Flatten a submenu's leaves in display order (for keyboard nav).
  function submenuLeaves(sm: Submenu): Leaf[] {
    if (sm.items) return sm.items;
    if (sm.groups) return sm.groups.flatMap((g) => g.items);
    return [];
  }

  // Normalized search terms.
  const searchTerms = $derived(search.trim().toLowerCase());
  const isSearching = $derived(searchTerms.length > 0);

  const filteredLeaves = $derived.by(() => {
    if (!isSearching) return [] as Leaf[];
    return ALL_LEAVES.filter((leaf) => {
      const haystack = `${leaf.label} ${leaf.breadcrumb ?? ""} ${leafDescription(leaf)}`.toLowerCase();
      return haystack.includes(searchTerms);
    });
  });

  // Entries visible in the root plane (for keyboard nav).
  const rootEntries = $derived(MENU);

  // When search becomes active, switch plane + close any open submenu.
  $effect(() => {
    if (isSearching) {
      if (openSubmenuKey) openSubmenuKey = null;
      focusPlane = "search";
      focusIndex = 0;
    } else if (focusPlane === "search") {
      focusPlane = "root";
      focusIndex = 0;
    }
  });

  function clampFocus(len: number) {
    if (len === 0) {
      focusIndex = 0;
      return;
    }
    if (focusIndex < 0) focusIndex = 0;
    if (focusIndex >= len) focusIndex = len - 1;
  }

  async function handleKeydown(e: KeyboardEvent) {
    if (!target) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (isSearching) {
        search = "";
        return;
      }
      if (openSubmenuKey) {
        openSubmenuKey = null;
        focusPlane = "root";
        return;
      }
      onClose();
      return;
    }

    if (isSearching) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusIndex = Math.min(filteredLeaves.length - 1, focusIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusIndex = Math.max(0, focusIndex - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const leaf = filteredLeaves[focusIndex];
        if (leaf) pick(leaf);
      }
      return;
    }

    if (focusPlane === "root") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusIndex = Math.min(rootEntries.length - 1, focusIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusIndex = Math.max(0, focusIndex - 1);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        const entry = rootEntries[focusIndex];
        if (!entry) return;
        if (entry.kind === "leaf") {
          if (e.key === "Enter") {
            e.preventDefault();
            pick(entry);
          }
        } else if (submenuAvailable(entry)) {
          e.preventDefault();
          const rowEl = menuEl?.querySelector(`[data-entry-key="${entry.key}"]`) as HTMLElement | null;
          if (rowEl) openSubmenu(entry.key, rowEl);
          focusPlane = "sub";
          focusIndex = 0;
        }
      }
      return;
    }

    if (focusPlane === "sub" && activeSubmenu) {
      const leaves = submenuLeaves(activeSubmenu);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusIndex = Math.min(leaves.length - 1, focusIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusIndex = Math.max(0, focusIndex - 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        openSubmenuKey = null;
        focusPlane = "root";
      } else if (e.key === "Enter") {
        e.preventDefault();
        const leaf = leaves[focusIndex];
        if (leaf) pick(leaf);
      }
    }
  }

  // Scroll focused element into view when focus index changes.
  $effect(() => {
    const _ = focusIndex + focusPlane;
    void _;
    void tick().then(() => {
      const host = focusPlane === "sub" ? submenuEl : menuEl;
      const el = host?.querySelector<HTMLElement>("[data-focus='true']");
      el?.scrollIntoView({ block: "nearest" });
    });
  });
</script>

<svelte:window onpointerdown={handlePointerDown} />

{#if target}
  <div
    class="type-menu"
    bind:this={menuEl}
    style:left="{resolvedLeft}px"
    style:top="{resolvedTop}px"
    role="menu"
    aria-label="Insert column type"
    onkeydown={handleKeydown}
    tabindex="-1"
  >
    <div class="menu-title">
      {target.existingId ? "Change column type" : "Insert column as"}
    </div>
    <div class="search-row">
      <input
        bind:this={searchInput}
        bind:value={search}
        type="text"
        class="search-input"
        placeholder="Search types…"
        aria-label="Search column types"
        spellcheck="false"
        autocomplete="off"
      />
    </div>

    {#if isSearching}
      {#if filteredLeaves.length === 0}
        <div class="empty-hint">No matches</div>
      {:else}
        {#each filteredLeaves as leaf, i (leaf.key)}
          {@const ok = leafSatisfiable(leaf)}
          <button
            type="button"
            class="menu-item"
            class:disabled={!ok}
            class:focused={i === focusIndex}
            data-focus={i === focusIndex}
            disabled={!ok}
            title={leafDescription(leaf)}
            role="menuitem"
            onpointerenter={() => (focusIndex = i)}
            onclick={() => pick(leaf)}
          >
            <span class="label">{leaf.label}</span>
            {#if leaf.breadcrumb}
              <span class="breadcrumb">{leaf.breadcrumb}</span>
            {/if}
          </button>
        {/each}
      {/if}
    {:else}
      {#each rootEntries as entry, i (entry.key)}
        {#if entry.kind === "leaf"}
          {@const ok = leafSatisfiable(entry)}
          <button
            type="button"
            class="menu-item"
            class:disabled={!ok}
            class:focused={focusPlane === "root" && i === focusIndex}
            data-focus={focusPlane === "root" && i === focusIndex}
            data-entry-key={entry.key}
            disabled={!ok}
            title={ok ? leafDescription(entry) : `${leafDescription(entry)} — no compatible fields`}
            role="menuitem"
            onpointerenter={() => {
              if (openSubmenuKey) scheduleCloseSubmenu();
              focusIndex = i;
              focusPlane = "root";
            }}
            onclick={() => pick(entry)}
          >
            <span class="label">{entry.label}</span>
          </button>
        {:else}
          {@const ok = submenuAvailable(entry)}
          <button
            type="button"
            class="menu-item has-submenu"
            class:active={openSubmenuKey === entry.key}
            class:disabled={!ok}
            class:focused={focusPlane === "root" && i === focusIndex}
            data-focus={focusPlane === "root" && i === focusIndex}
            data-entry-key={entry.key}
            disabled={!ok}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openSubmenuKey === entry.key}
            onpointerenter={(e) => {
              if (ok) scheduleOpenSubmenu(entry.key, e.currentTarget);
              focusIndex = i;
              focusPlane = "root";
            }}
            onpointerleave={() => scheduleCloseSubmenu()}
            onclick={(e) => ok && openSubmenu(entry.key, e.currentTarget)}
          >
            <span class="label">{entry.label}</span>
            <svg class="caret" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M3 1 L7 5 L3 9" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        {/if}
      {/each}
    {/if}
  </div>

  {#if !isSearching && activeSubmenu && submenuLeft != null && submenuTop != null}
    {@const subLeaves = submenuLeaves(activeSubmenu)}
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
        {#each activeSubmenu.items as leaf, i (leaf.key)}
          {@const ok = leafSatisfiable(leaf)}
          <button
            type="button"
            class="sub-item"
            class:disabled={!ok}
            class:focused={focusPlane === "sub" && i === focusIndex}
            data-focus={focusPlane === "sub" && i === focusIndex}
            disabled={!ok}
            title={leafDescription(leaf)}
            role="menuitem"
            onpointerenter={() => { focusIndex = i; focusPlane = "sub"; }}
            onclick={() => pick(leaf)}
          >
            <span class="label">{leaf.label}</span>
          </button>
        {/each}
      {:else if activeSubmenu.groups}
        {@const offsets = (() => {
          const res: number[] = [];
          let acc = 0;
          for (const g of activeSubmenu.groups) { res.push(acc); acc += g.items.length; }
          return res;
        })()}
        {#each activeSubmenu.groups as group, gi (group.label)}
          <div class="sub-group-label">{group.label}</div>
          {#each group.items as leaf, li (leaf.key)}
            {@const ok = leafSatisfiable(leaf)}
            {@const idx = offsets[gi] + li}
            <button
              type="button"
              class="sub-item"
              class:disabled={!ok}
              class:focused={focusPlane === "sub" && idx === focusIndex}
              data-focus={focusPlane === "sub" && idx === focusIndex}
              disabled={!ok}
              title={leafDescription(leaf)}
              role="menuitem"
              onpointerenter={() => { focusIndex = idx; focusPlane = "sub"; }}
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
    min-width: 172px;
    background: var(--tv-bg, #ffffff);
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    box-shadow: 0 6px 20px -4px rgba(15, 23, 42, 0.16);
    z-index: 10004;
    padding: 3px;
    font-family: inherit;
    font-size: 12px;
    color: var(--tv-fg, #1a1a1a);
    display: flex;
    flex-direction: column;
    gap: 1px;
    animation: type-menu-in 90ms ease-out;
  }

  .type-menu { max-height: 380px; overflow-y: auto; }

  .type-submenu {
    min-width: 188px;
    max-height: 340px;
    overflow-y: auto;
  }

  @keyframes type-menu-in {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .menu-title {
    padding: 5px 8px 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tv-muted, #64748b);
  }

  .search-row {
    padding: 2px 4px 4px;
    border-bottom: 1px solid var(--tv-border, #e2e8f0);
    margin-bottom: 3px;
  }
  .search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    font-family: inherit;
    font-size: 12px;
    color: var(--tv-fg, #1a1a1a);
    background: var(--tv-bg, #ffffff);
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    outline: none;
    transition: border-color 0.1s ease, box-shadow 0.1s ease;
  }
  .search-input:focus {
    border-color: var(--tv-accent, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .menu-item, .sub-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: transparent;
    border: none;
    text-align: left;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    color: var(--tv-fg, #1a1a1a);
    cursor: pointer;
    transition: background-color 0.08s ease, color 0.08s ease;
  }

  .menu-item:hover:not(.disabled),
  .menu-item.active,
  .menu-item.focused:not(.disabled),
  .sub-item:hover:not(.disabled),
  .sub-item.focused:not(.disabled) {
    background: var(--tv-hover, #eef2ff);
    color: var(--tv-accent, #3b82f6);
    outline: none;
  }

  .menu-item.disabled,
  .sub-item.disabled {
    color: var(--tv-muted, #94a3b8);
    cursor: not-allowed;
    opacity: 0.55;
  }

  .breadcrumb {
    font-size: 10.5px;
    color: var(--tv-muted, #94a3b8);
    white-space: nowrap;
  }
  .menu-item.focused .breadcrumb,
  .menu-item:hover:not(.disabled) .breadcrumb {
    color: var(--tv-accent, #3b82f6);
    opacity: 0.8;
  }

  .empty-hint {
    padding: 8px 10px;
    color: var(--tv-muted, #94a3b8);
    font-style: italic;
    font-size: 11.5px;
  }

  .caret {
    flex-shrink: 0;
    color: var(--tv-muted, #94a3b8);
  }
  .menu-item.active .caret,
  .menu-item:hover:not(.disabled) .caret,
  .menu-item.focused:not(.disabled) .caret {
    color: var(--tv-accent, #3b82f6);
  }

  .sub-group-label {
    padding: 5px 8px 2px;
    font-size: 9.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tv-muted, #94a3b8);
  }
  .sub-group-label:not(:first-child) {
    margin-top: 3px;
    border-top: 1px solid var(--tv-border, #e2e8f0);
    padding-top: 6px;
  }
</style>

<!--
  Picker — unified single-choice dropdown. Replaces v1 Select and
  serves as a richer FieldSelect (glyphs, group separators, search).

  Triggering surface is a chip showing the selected item's glyph +
  label (or placeholder). Click opens a floating menu below the trigger
  with the option list. Keyboard support:
    Enter / Space  — open menu (or commit highlighted in menu)
    ArrowDown / Up — move highlight
    Escape         — close menu
    Tab            — close + move focus

  Each item can carry a `glyph` (GlyphToken) shown in a leading badge
  column, plus an optional `secondary` line (e.g. data type hint when
  used as a field picker). Items can be bucketed by `group`.

  Search box appears when item count exceeds `searchableThreshold`
  (default 8). It filters by label substring (case-insensitive).
-->
<script lang="ts" generics="T extends string | number">
  import { onMount, tick } from "svelte";
  import { glyph as glyphChar } from "$lib/ui-glyphs";
  import type { PickerItem } from "./types";

  interface Props {
    value?: T | null;
    items: PickerItem<T>[];
    placeholder?: string;
    ariaLabel?: string;
    disabled?: boolean;
    /** Show search input when items.length >= this number. */
    searchableThreshold?: number;
    /** Force-show search regardless of count. */
    searchable?: boolean;
    /** Max menu height in px before scrolling. */
    maxMenuHeight?: number;
    /** Width of the trigger; menu inherits unless wider needed. */
    width?: number;
    /** Called when a new item is committed (selected from the menu). */
    onchange?: (next: T | null) => void;
  }

  let {
    value = $bindable(null),
    items,
    placeholder = "—",
    ariaLabel,
    disabled = false,
    searchableThreshold = 8,
    searchable,
    maxMenuHeight = 240,
    width,
    onchange,
  }: Props = $props();

  let open = $state(false);
  let query = $state("");
  let highlightIndex = $state(0);
  let trigger: HTMLButtonElement | undefined = $state();
  let menu: HTMLDivElement | undefined = $state();
  let searchInput: HTMLInputElement | undefined = $state();

  const selectedItem = $derived(items.find((i) => i.value === value) ?? null);
  const showSearch = $derived(searchable ?? items.length >= searchableThreshold);

  // ── Filtered + grouped items ────────────────────────────────
  const filtered = $derived.by(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      (i.secondary?.toLowerCase().includes(q)) ||
      String(i.value).toLowerCase().includes(q),
    );
  });
  // Group preserving original order of first-appearance.
  const grouped = $derived.by(() => {
    const buckets = new Map<string, PickerItem<T>[]>();
    const order: string[] = [];
    for (const it of filtered) {
      const g = it.group ?? "";
      if (!buckets.has(g)) { buckets.set(g, []); order.push(g); }
      buckets.get(g)!.push(it);
    }
    return order.map((g) => ({ group: g, items: buckets.get(g)! }));
  });
  // Flat view for keyboard nav.
  const flat = $derived(filtered);

  // ── Open / close ────────────────────────────────────────────
  async function openMenu() {
    if (disabled || open) return;
    open = true;
    query = "";
    highlightIndex = Math.max(0, flat.findIndex((i) => i.value === value));
    if (highlightIndex < 0) highlightIndex = 0;
    await tick();
    if (showSearch) searchInput?.focus();
  }
  function closeMenu(focusTrigger = true) {
    if (!open) return;
    open = false;
    if (focusTrigger) trigger?.focus();
  }

  function commit(item: PickerItem<T>) {
    if (item.disabled) return;
    value = item.value;
    onchange?.(item.value);
    closeMenu();
  }

  // ── Keyboard nav ────────────────────────────────────────────
  function onTriggerKey(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  }
  function onMenuKey(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); closeMenu(); return; }
    if (e.key === "Tab")     { closeMenu(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = Math.min(flat.length - 1, highlightIndex + 1);
      scrollHighlightedIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = Math.max(0, highlightIndex - 1);
      scrollHighlightedIntoView();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[highlightIndex];
      if (item) commit(item);
    }
  }
  function scrollHighlightedIntoView() {
    const el = menu?.querySelector<HTMLElement>(`[data-idx="${highlightIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }

  // ── Outside-click close ────────────────────────────────────
  function onDocClick(e: MouseEvent) {
    if (!open) return;
    const t = e.target as Node | null;
    if (!t) return;
    if (trigger?.contains(t)) return;
    if (menu?.contains(t)) return;
    closeMenu(false);
  }
  onMount(() => {
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  });

  // Map of value → flat index, so menu items can announce their index
  // for keyboard nav highlighting.
  function indexOf(item: PickerItem<T>): number {
    return flat.indexOf(item);
  }
</script>

<div class="picker" class:disabled class:open style:width={width ? `${width}px` : undefined}>
  <button
    type="button"
    class="trigger"
    bind:this={trigger}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    {disabled}
    onclick={() => (open ? closeMenu(false) : openMenu())}
    onkeydown={onTriggerKey}
  >
    {#if selectedItem?.glyph}
      <span class="trigger-glyph" aria-hidden="true">{glyphChar(selectedItem.glyph)}</span>
    {/if}
    <span class="trigger-label" class:placeholder={!selectedItem}>
      {selectedItem?.label ?? placeholder}
    </span>
    {#if selectedItem?.secondary}
      <span class="trigger-secondary">{selectedItem.secondary}</span>
    {/if}
    <span class="trigger-caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div
      class="menu"
      role="listbox"
      tabindex="-1"
      bind:this={menu}
      style:max-height="{maxMenuHeight}px"
      onkeydown={onMenuKey}
    >
      {#if showSearch}
        <div class="menu-search">
          <input
            type="text"
            bind:this={searchInput}
            bind:value={query}
            placeholder="Filter…"
            spellcheck="false"
            onkeydown={onMenuKey}
          />
        </div>
      {/if}
      <div class="menu-list">
        {#if flat.length === 0}
          <div class="menu-empty">no matches</div>
        {/if}
        {#each grouped as g (g.group)}
          {#if g.group}
            <div class="menu-group">{g.group}</div>
          {/if}
          {#each g.items as item (item.value)}
            {@const i = indexOf(item)}
            <button
              type="button"
              role="option"
              class="item"
              class:highlight={i === highlightIndex}
              class:selected={item.value === value}
              class:disabled={item.disabled}
              aria-selected={item.value === value}
              data-idx={i}
              onmouseenter={() => (highlightIndex = i)}
              onclick={() => commit(item)}
            >
              <span class="item-glyph" aria-hidden="true">
                {item.glyph ? glyphChar(item.glyph) : ""}
              </span>
              <span class="item-label">{item.label}</span>
              {#if item.secondary}
                <span class="item-secondary">{item.secondary}</span>
              {/if}
              {#if item.value === value}
                <span class="item-check" aria-hidden="true">✓</span>
              {/if}
            </button>
          {/each}
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    display: inline-block;
    flex: 1;
    min-width: 0;
  }
  .picker.disabled { opacity: 0.4; pointer-events: none; }

  /* ── Trigger chip ─────────────────────────────────────── */
  .trigger {
    appearance: none;
    width: 100%;
    height: var(--v2-control-h, 22px);
    padding: 0 6px 0 8px;
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: var(--v2-ink, #15140e);
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .trigger:hover { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .picker.open .trigger,
  .trigger:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e);
  }

  .trigger-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 11px;
    color: var(--v2-ink-2, #4a463c);
    width: 14px;
    text-align: center;
    line-height: 1;
  }
  .trigger-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--v2-text-body, 11.5px);
    line-height: 1.4;
  }
  .trigger-label.placeholder {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }
  .trigger-secondary {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
  }
  .trigger-caret {
    font-size: 9px;
    color: var(--v2-ink-3, #8a8478);
    margin-left: 2px;
  }

  /* ── Menu ────────────────────────────────────────────── */
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    min-width: 180px;
    background: var(--v2-paper-edge, #fff);
    border-radius: var(--v2-r-large, 6px);
    box-shadow:
      0 0 0 1px var(--v2-rule, #d6d0c1),
      0 8px 24px rgba(21, 20, 14, 0.10),
      0 24px 48px rgba(21, 20, 14, 0.06);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 1000;
  }

  .menu-search {
    border-bottom: 1px solid var(--v2-rule-soft, #e6e0d1);
    padding: 4px;
  }
  .menu-search input {
    width: 100%;
    box-sizing: border-box;
    appearance: none;
    border: 0;
    background: transparent;
    padding: 3px 6px;
    font: inherit;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    outline: none;
  }
  .menu-search input::placeholder {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }

  .menu-list {
    overflow-y: auto;
    padding: 3px 0;
    max-height: inherit;
  }

  .menu-group {
    padding: 6px 10px 2px;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
  }

  .item {
    appearance: none;
    width: 100%;
    box-sizing: border-box;
    border: 0;
    background: transparent;
    padding: 4px 10px;
    display: grid;
    grid-template-columns: 16px 1fr auto auto;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: var(--v2-ink, #15140e);
  }
  .item.disabled { opacity: 0.4; cursor: not-allowed; }
  .item.highlight {
    background: var(--v2-active-bg, #15140e);
    color: var(--v2-active-fg, #faf7f0);
  }
  .item.selected:not(.highlight) {
    background: var(--v2-paper-2, #f3efe5);
  }

  .item-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 11px;
    line-height: 1;
    color: var(--v2-ink-2, #4a463c);
    text-align: center;
  }
  .item.highlight .item-glyph { color: var(--v2-active-fg, #faf7f0); }

  .item-label {
    font-size: var(--v2-text-body, 11.5px);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item-secondary {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
  }
  .item.highlight .item-secondary { color: var(--v2-active-fg, #faf7f0); opacity: 0.7; }
  .item-check {
    font-size: 11px;
    color: var(--v2-ink-2, #4a463c);
  }
  .item.highlight .item-check { color: var(--v2-active-fg, #faf7f0); }

  .menu-empty {
    padding: 12px;
    text-align: center;
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
    font-size: var(--v2-text-small, 10.5px);
  }
</style>

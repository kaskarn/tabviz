<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { ColumnFilter, ColumnKind, FilterOperator } from "$types";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const target = $derived(store.filterPopoverTarget);
  const field = $derived(target?.field ?? "");
  const header = $derived(target?.header ?? "");
  const anchorX = $derived(target?.anchorX ?? 0);
  const anchorY = $derived(target?.anchorY ?? 0);

  const kind = $derived<ColumnKind>(target ? store.detectColumnKind(field) : "text");
  const existing = $derived<ColumnFilter | null>(target ? store.getColumnFilter(field) : null);

  // Editable draft state
  let textOp = $state<FilterOperator>("contains");
  let textVal = $state("");
  let numMin = $state<string>("");
  let numMax = $state<string>("");
  let catSelection = $state<Set<string>>(new Set());

  let popoverEl: HTMLDivElement | null = $state(null);
  let resolvedLeft = $state(0);
  let resolvedTop = $state(0);
  let resolvedMaxH = $state<number | null>(null);

  // Whenever the target changes, reset the draft from the current filter value.
  $effect(() => {
    if (!target) return;
    if (!existing) {
      textOp = "contains";
      textVal = "";
      numMin = "";
      numMax = "";
      catSelection = new Set();
      return;
    }
    if (existing.kind === "text") {
      textOp = existing.operator;
      textVal = String(existing.value ?? "");
    } else if (existing.kind === "numeric") {
      const [lo, hi] = (existing.value as [number | null, number | null] | null) ?? [null, null];
      numMin = lo == null ? "" : String(lo);
      numMax = hi == null ? "" : String(hi);
    } else {
      const arr = (existing.value as unknown[] | null) ?? [];
      catSelection = new Set(arr.map((v) => String(v)));
    }
  });

  // Clamp the popover into the viewport after it has laid out.
  $effect(() => {
    if (!target || !popoverEl) {
      resolvedMaxH = null;
      return;
    }
    const rect = popoverEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;

    let left = anchorX;
    if (left + rect.width > vw - pad) left = Math.max(pad, vw - pad - rect.width);
    if (left < pad) left = pad;

    let top = anchorY + 4;
    // If it would overflow bottom, open upward instead.
    if (top + rect.height > vh - pad) {
      const altTop = anchorY - rect.height - 4;
      if (altTop >= pad) {
        top = altTop;
      } else {
        top = Math.max(pad, vh - pad - rect.height);
        resolvedMaxH = vh - pad * 2;
      }
    }
    resolvedLeft = left;
    resolvedTop = top;
  });

  function applyFilter() {
    if (!target) return;
    if (kind === "text") {
      const val = textVal.trim();
      if (!val && (textOp === "contains" || textOp === "eq" || textOp === "neq")) {
        store.setColumnFilter(field, null);
      } else {
        store.setColumnFilter(field, { field, kind, operator: textOp, value: val });
      }
    } else if (kind === "numeric") {
      const lo = numMin === "" ? null : Number(numMin);
      const hi = numMax === "" ? null : Number(numMax);
      if (lo == null && hi == null) {
        store.setColumnFilter(field, null);
      } else {
        store.setColumnFilter(field, { field, kind, operator: "between", value: [lo, hi] });
      }
    } else {
      const raw = store.getColumnValues(field);
      const byKey = new Map(raw.map((v) => [String(v), v] as const));
      const value = Array.from(catSelection).map((k) => byKey.get(k)).filter((v) => v !== undefined);
      if (value.length === 0) {
        store.setColumnFilter(field, null);
      } else {
        store.setColumnFilter(field, { field, kind, operator: "in", value });
      }
    }
    store.closeFilterPopover();
  }

  function clearFilter() {
    if (!target) return;
    store.setColumnFilter(field, null);
    store.closeFilterPopover();
  }

  function handleWindowPointerDown(e: PointerEvent) {
    if (!target) return;
    const tgt = e.target as HTMLElement;
    if (popoverEl && popoverEl.contains(tgt)) return;
    // Don't close if the click was on the funnel button that opened us.
    if (tgt.closest(".filter-btn.open")) return;
    store.closeFilterPopover();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!target) return;
    if (e.key === "Escape") { e.preventDefault(); store.closeFilterPopover(); }
    else if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON") {
      e.preventDefault(); applyFilter();
    }
  }

  const categoricalValues = $derived(target && kind === "categorical" ? store.getColumnValues(field) : []);
  const numericRange = $derived(target && kind === "numeric" ? store.getColumnNumericRange(field) : null);
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleKeydown} />

{#if target}
  <div
    class="filter-popover"
    bind:this={popoverEl}
    style:left="{resolvedLeft}px"
    style:top="{resolvedTop}px"
    style:max-height={resolvedMaxH ? `${resolvedMaxH}px` : undefined}
    role="dialog"
    aria-label="Column filter: {header}"
  >
    <div class="filter-title">{header}</div>
    {#if kind === "text"}
      <label class="filter-field">
        <span>Match</span>
        <select bind:value={textOp}>
          <option value="contains">contains</option>
          <option value="eq">equals</option>
          <option value="neq">not equal</option>
          <option value="empty">is empty</option>
          <option value="notEmpty">not empty</option>
        </select>
      </label>
      {#if textOp !== "empty" && textOp !== "notEmpty"}
        <!-- svelte-ignore a11y_autofocus -->
        <input type="text" bind:value={textVal} placeholder="Search…" autofocus />
      {/if}
    {:else if kind === "numeric"}
      <div class="filter-row">
        <label>
          Min
          <input type="number" bind:value={numMin} placeholder={numericRange ? String(numericRange[0]) : ""} />
        </label>
        <label>
          Max
          <input type="number" bind:value={numMax} placeholder={numericRange ? String(numericRange[1]) : ""} />
        </label>
      </div>
    {:else}
      <div class="filter-cat-actions">
        <button type="button" class="text-btn" onclick={() => (catSelection = new Set(categoricalValues.map((v) => String(v))))}>Select all</button>
        <button type="button" class="text-btn" onclick={() => (catSelection = new Set())}>Clear</button>
      </div>
      <div class="filter-cat-list">
        {#each categoricalValues as v (String(v))}
          {@const k = String(v)}
          <label class="filter-cat-item">
            <input
              type="checkbox"
              checked={catSelection.has(k)}
              onchange={(e) => {
                const next = new Set(catSelection);
                if ((e.currentTarget as HTMLInputElement).checked) next.add(k); else next.delete(k);
                catSelection = next;
              }}
            />
            <span>{k}</span>
          </label>
        {/each}
      </div>
    {/if}
    <div class="filter-footer">
      <button type="button" class="secondary" onclick={clearFilter}>Clear</button>
      <button type="button" class="primary" onclick={applyFilter}>Apply</button>
    </div>
  </div>
{/if}

<style>
  .filter-popover {
    position: fixed;
    min-width: 220px; max-width: 280px; padding: 10px;
    background: var(--tv-bg, #ffffff); border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 8px; box-shadow: 0 8px 24px -4px rgba(0,0,0,0.12);
    z-index: 10002;
    font-weight: normal; font-size: 12px; color: var(--tv-fg, #1a1a1a);
    display: flex; flex-direction: column; gap: 8px;
    overflow-y: auto;
  }
  .filter-title { font-weight: 600; font-size: 12px; }
  .filter-field { display: flex; flex-direction: column; gap: 4px; }
  .filter-row { display: flex; gap: 8px; }
  .filter-row label { display: flex; flex-direction: column; gap: 3px; flex: 1; font-size: 11px; color: var(--tv-text-muted, #64748b); }
  .filter-popover input[type="text"],
  .filter-popover input[type="number"],
  .filter-popover select {
    width: 100%; padding: 5px 7px; font-size: 12px;
    border: 1px solid var(--tv-border, #e2e8f0); border-radius: 4px;
    background: var(--tv-bg, #ffffff); color: var(--tv-fg, #1a1a1a);
    font-family: inherit; box-sizing: border-box;
  }
  .filter-popover input:focus, .filter-popover select:focus {
    outline: none; border-color: var(--tv-accent, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }
  .filter-cat-actions { display: flex; gap: 8px; }
  .text-btn { background: transparent; border: none; padding: 0; color: var(--tv-accent, #2563eb); font-size: 11px; cursor: pointer; }
  .text-btn:hover { text-decoration: underline; }
  .filter-cat-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
  .filter-cat-item { display: flex; align-items: center; gap: 6px; padding: 3px 2px; border-radius: 3px; cursor: pointer; font-weight: normal; font-size: 12px; }
  .filter-cat-item:hover { background: var(--tv-border, #f1f5f9); }
  .filter-footer { display: flex; justify-content: flex-end; gap: 6px; border-top: 1px solid var(--tv-border, #e2e8f0); padding-top: 8px; }
  .filter-footer button {
    padding: 5px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; font-family: inherit;
  }
  .filter-footer .primary {
    background: var(--tv-accent, #2563eb); border: 1px solid var(--tv-accent, #2563eb); color: white;
  }
  .filter-footer .primary:hover { filter: brightness(0.95); }
  .filter-footer .secondary {
    background: transparent; border: 1px solid var(--tv-border, #e2e8f0); color: var(--tv-fg, #1a1a1a);
  }
  .filter-footer .secondary:hover { background: var(--tv-border, #f1f5f9); }
</style>

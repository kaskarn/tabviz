<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { EditTarget, EditValue } from "$types";
  import { tick } from "svelte";

  interface Props {
    store: ForestStore;
    target: EditTarget;
    /** Container the widget is mounted in; used to anchor the inline overlay. */
    root: HTMLElement | null;
  }

  let { store, target, root }: Props = $props();

  // Determine mode: plot-level label (labelField set), group-header edit
  // (groupId set), forest popover ("__forest__:colId"), or regular cell
  // (field). Ordering matches the discriminator priority in EditTarget.
  const isLabel = $derived(!!target.labelField);
  const isGroup = $derived(!isLabel && !!target.groupId);
  const isForest = $derived(!isLabel && !isGroup && target.field.startsWith("__forest__:"));
  const forestColId = $derived(isForest ? target.field.slice("__forest__:".length) : "");

  const row = $derived.by(() => {
    if (!store.spec || isGroup) return null;
    return store.spec.data.rows.find((r) => r.id === target.rowId) ?? null;
  });

  // Walk the column-def tree to find a group by id.
  function findGroup(defs: { id: string; isGroup?: boolean; columns?: unknown[] }[], id: string): { id: string; header?: string } | null {
    for (const d of defs) {
      if (d.isGroup && d.id === id) return d as { id: string; header?: string };
      if (d.isGroup && Array.isArray(d.columns)) {
        const hit = findGroup(d.columns as { id: string; isGroup?: boolean; columns?: unknown[] }[], id);
        if (hit) return hit;
      }
    }
    return null;
  }

  const group = $derived.by(() => {
    if (!isGroup || !target.groupId) return null;
    return findGroup(store.allColumnDefs as unknown as { id: string; isGroup?: boolean; columns?: unknown[] }[], target.groupId);
  });

  // Column (for inline cell edits) — used to choose numeric vs text input type.
  const column = $derived.by(() => {
    if (isForest || isGroup) return null;
    return store.allColumns.find((c) => c.field === target.field) ?? null;
  });

  const isNumericColumn = $derived.by(() => {
    if (!column) return false;
    const numTypes = new Set(["numeric", "percent", "events", "pvalue", "heatmap", "progress", "bar"]);
    return numTypes.has(column.type);
  });

  // Anchor element lookup — cells carry data-row-id + data-field; group
  // headers carry data-header-id; plot labels are found via their class
  // name inside the widget root (there's only ever one of each).
  const anchorEl = $derived.by(() => {
    if (!root || isForest) return null;
    if (isLabel && target.labelField) {
      const cls =
        target.labelField === "title"    ? ".plot-title"    :
        target.labelField === "subtitle" ? ".plot-subtitle" :
        target.labelField === "caption"  ? ".plot-caption"  :
        /* footnote */                     ".plot-footnote";
      return root.querySelector<HTMLElement>(cls);
    }
    if (isGroup && target.groupId) {
      return root.querySelector<HTMLElement>(
        `[data-header-id="${CSS.escape(target.groupId)}"]`,
      );
    }
    return root.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(target.rowId)}"][data-field="${CSS.escape(target.field)}"]`,
    );
  });

  let rect = $state<DOMRect | null>(null);
  let inputEl: HTMLInputElement | null = $state(null);
  let pointEl: HTMLInputElement | null = $state(null);
  let lowerEl: HTMLInputElement | null = $state(null);
  let upperEl: HTMLInputElement | null = $state(null);
  let popoverEl: HTMLDivElement | null = $state(null);

  let draft = $state<string>("");
  let invalid = $state(false);

  // Forest popover drafts
  let draftEst = $state<string>("");
  let draftLo = $state<string>("");
  let draftHi = $state<string>("");

  $effect(() => {
    if (anchorEl) rect = anchorEl.getBoundingClientRect();
    if (isForest) rect = null;
  });

  $effect(() => {
    if (isLabel) {
      if (!target.labelField) return;
      draft = toStr(store.getPlotLabel(target.labelField));
      tick().then(() => { inputEl?.focus(); inputEl?.select?.(); });
      return;
    }
    if (isGroup) {
      if (!target.groupId) return;
      const current = store.cellEdits.groups[target.groupId] ?? group?.header ?? "";
      draft = toStr(current);
      tick().then(() => { inputEl?.focus(); inputEl?.select?.(); });
      return;
    }
    if (!row) return;
    if (isForest) {
      const col = store.allColumns.find((c) => c.id === forestColId);
      const opts = col?.options?.forest;
      const point = opts?.point ?? "est";
      const lower = opts?.lower ?? "lo";
      const upper = opts?.upper ?? "hi";
      const m = store.cellEdits.cells[row.id] ?? {};
      draftEst = toStr(m[point] ?? row.metadata[point]);
      draftLo = toStr(m[lower] ?? row.metadata[lower]);
      draftHi = toStr(m[upper] ?? row.metadata[upper]);
    } else {
      const fieldVal = store.cellEdits.cells[row.id]?.[target.field] ?? row.metadata[target.field];
      draft = toStr(fieldVal);
    }
    tick().then(() => {
      const el = isForest ? pointEl : inputEl;
      el?.focus();
      el?.select?.();
    });
  });

  function toStr(v: unknown): string {
    if (v === null || v === undefined) return "";
    return String(v);
  }
  function parseNumberOrNull(s: string): number | null {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN as unknown as number;
  }

  function commitGroup() {
    if (!target.groupId) return;
    store.setGroupHeader(target.groupId, draft);
    store.endEdit();
  }

  function commitLabel() {
    if (!target.labelField) return;
    const trimmed = draft.trim();
    store.setLabel(target.labelField, trimmed === "" ? null : draft);
    store.endEdit();
  }

  function commitInline() {
    if (isLabel) { commitLabel(); return; }
    if (isGroup) { commitGroup(); return; }
    if (!row) return;
    if (isNumericColumn) {
      const n = parseNumberOrNull(draft);
      if (Number.isNaN(n as number)) { invalid = true; return; }
      store.setCellValue(row.id, target.field, n as EditValue);
    } else {
      store.setCellValue(row.id, target.field, draft);
    }
    store.endEdit();
  }

  function commitForest() {
    if (!row) return;
    const nE = parseNumberOrNull(draftEst);
    const nL = parseNumberOrNull(draftLo);
    const nH = parseNumberOrNull(draftHi);
    if ([nE, nL, nH].some((v) => Number.isNaN(v as number))) { invalid = true; return; }
    store.setForestCellValues(row.id, forestColId, nE as EditValue, nL as EditValue, nH as EditValue);
    store.endEdit();
  }

  function cancel() { store.endEdit(); }

  function onKeyInline(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitInline(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  }

  function onKeyForest(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitForest(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  }

  function onWindowPointerDown(e: PointerEvent) {
    const t = e.target as HTMLElement;
    if (inputEl && t === inputEl) return;
    if (popoverEl && popoverEl.contains(t)) return;
    if (isForest) commitForest(); else commitInline();
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

{#if isForest}
  <div
    class="edit-popover"
    bind:this={popoverEl}
    style:left="{(target.x ?? 0)}px"
    style:top="{(target.y ?? 0) + 8}px"
    role="dialog"
    aria-label="Edit forest values"
  >
    <div class="edit-popover-title">Edit values</div>
    <label>
      Estimate
      <input
        bind:this={pointEl}
        type="number"
        step="any"
        bind:value={draftEst}
        class:invalid
        onkeydown={onKeyForest}
      />
    </label>
    <label>
      Lower
      <input
        bind:this={lowerEl}
        type="number"
        step="any"
        bind:value={draftLo}
        class:invalid
        onkeydown={onKeyForest}
      />
    </label>
    <label>
      Upper
      <input
        bind:this={upperEl}
        type="number"
        step="any"
        bind:value={draftHi}
        class:invalid
        onkeydown={onKeyForest}
      />
    </label>
    <div class="edit-popover-footer">
      <button type="button" class="secondary" onclick={cancel}>Cancel</button>
      <button type="button" class="primary" onclick={commitForest}>Save</button>
    </div>
  </div>
{:else if rect}
  <!-- svelte-ignore a11y_autofocus -->
  <input
    bind:this={inputEl}
    class="edit-inline"
    class:invalid
    type={isNumericColumn ? "number" : "text"}
    step={isNumericColumn ? "any" : undefined}
    style:left="{rect.left}px"
    style:top="{rect.top}px"
    style:width="{rect.width}px"
    style:height="{rect.height}px"
    bind:value={draft}
    onkeydown={onKeyInline}
    autofocus
  />
{/if}

<style>
  .edit-inline {
    position: fixed;
    z-index: 10003;
    box-sizing: border-box;
    padding: 2px 6px;
    font: inherit;
    font-size: var(--wf-font-size-base, 13px);
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    border: 2px solid var(--wf-primary, #2563eb);
    border-radius: 3px;
    outline: none;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
  }
  .edit-inline.invalid { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18); }

  .edit-popover {
    position: fixed;
    z-index: 10003;
    padding: 10px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 8px 24px -4px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 180px;
    font-size: 12px;
    color: var(--wf-fg, #1a1a1a);
  }
  .edit-popover-title { font-weight: 600; font-size: 12px; }
  .edit-popover label {
    display: flex; flex-direction: column; gap: 3px;
    font-size: 11px; color: var(--wf-secondary, #64748b);
  }
  .edit-popover input[type="number"] {
    font-size: 12px; padding: 5px 7px;
    border: 1px solid var(--wf-border, #e2e8f0); border-radius: 4px;
    background: var(--wf-bg, #ffffff); color: var(--wf-fg, #1a1a1a);
  }
  .edit-popover input.invalid { border-color: #dc2626; }
  .edit-popover input:focus { outline: none; border-color: var(--wf-primary, #2563eb); box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
  .edit-popover-footer { display: flex; justify-content: flex-end; gap: 6px; }
  .edit-popover-footer button {
    padding: 4px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; font-family: inherit;
  }
  .edit-popover-footer .primary { background: var(--wf-primary, #2563eb); border: 1px solid var(--wf-primary, #2563eb); color: #fff; }
  .edit-popover-footer .secondary { background: transparent; border: 1px solid var(--wf-border, #e2e8f0); color: var(--wf-fg, #1a1a1a); }
  .edit-popover-footer .secondary:hover { background: var(--wf-border, #f1f5f9); }
</style>

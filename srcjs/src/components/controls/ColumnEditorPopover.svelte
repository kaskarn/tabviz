<script lang="ts" module>
  import type { ColumnSpec as _ColumnSpec } from "$types";

  export interface EditorTarget {
    mode: "insert" | "configure";
    anchorX: number;
    anchorY: number;
    // For "insert": anchor column id to insert after ("__start__" for first).
    afterId?: string;
    // For "configure": the existing column spec being edited.
    existing?: _ColumnSpec;
  }
</script>

<script lang="ts">
  import type {
    AvailableField,
    ColumnSpec,
    ColumnType,
    VisualTypeDef,
  } from "$types";
  import {
    VISUAL_TYPES,
    getVisualTypeDef,
    slotCompatibleFields,
    isTypeSatisfiable,
    autoPairSlots,
  } from "$lib/column-compat";

  interface Props {
    target: EditorTarget | null;
    available: AvailableField[];
    onCommit: (spec: ColumnSpec, mode: "insert" | "configure", afterId?: string) => void;
    onClose: () => void;
  }

  let { target, available, onCommit, onClose }: Props = $props();

  // Local editor state. Reinitialized whenever `target` changes.
  let selectedType = $state<ColumnType>("numeric");
  let slotValues = $state<Record<string, string>>({});
  let headerText = $state("");
  // Light options editor — covers the most common knobs per type.
  let optDecimals = $state<string>("");
  let optScale = $state<"linear" | "log">("linear");
  let optStars = $state(false);
  let optMaxValue = $state<string>("");
  let optShowPct = $state(false);
  let optSparklineType = $state<"line" | "bar" | "area">("line");

  let popoverEl: HTMLDivElement | null = $state(null);
  let resolvedLeft = $state(0);
  let resolvedTop = $state(0);
  let resolvedMaxH = $state<number | null>(null);

  // Initialize editor state from target (insert default or existing spec).
  $effect(() => {
    if (!target) return;
    if (target.mode === "configure" && target.existing) {
      const ex = target.existing;
      selectedType = ex.type;
      headerText = ex.header ?? "";
      slotValues = slotsFromExistingSpec(ex);
      hydrateOptionsFromExisting(ex);
    } else {
      // Insert mode: pick the first satisfiable type as default.
      const firstOk = VISUAL_TYPES.find((t) => isTypeSatisfiable(t, available));
      selectedType = firstOk?.type ?? "text";
      slotValues = {};
      headerText = "";
      resetOptions();
    }
  });

  function resetOptions() {
    optDecimals = "";
    optScale = "linear";
    optStars = false;
    optMaxValue = "";
    optShowPct = false;
    optSparklineType = "line";
  }

  function hydrateOptionsFromExisting(ex: ColumnSpec) {
    resetOptions();
    const o = ex.options ?? {};
    if (ex.type === "numeric" && o.numeric?.decimals != null) optDecimals = String(o.numeric.decimals);
    if (ex.type === "pvalue") optStars = !!o.pvalue?.stars;
    if (ex.type === "bar" && o.bar?.maxValue != null) optMaxValue = String(o.bar.maxValue);
    if (ex.type === "progress" && o.progress?.maxValue != null) optMaxValue = String(o.progress.maxValue);
    if (ex.type === "heatmap" && o.heatmap?.decimals != null) optDecimals = String(o.heatmap.decimals);
    if (ex.type === "forest" && o.forest?.scale) optScale = o.forest.scale;
    if (ex.type === "interval" && o.interval?.decimals != null) optDecimals = String(o.interval.decimals);
    if (ex.type === "sparkline" && o.sparkline?.type) optSparklineType = o.sparkline.type;
    if (ex.type === "custom" && o.events?.showPct != null) optShowPct = !!o.events.showPct;
  }

  // Reconstruct slot→field mapping from an existing ColumnSpec.
  function slotsFromExistingSpec(ex: ColumnSpec): Record<string, string> {
    const out: Record<string, string> = {};
    const o = ex.options ?? {};
    switch (ex.type) {
      case "forest":
        if (o.forest?.point) out.point = o.forest.point;
        if (o.forest?.lower) out.lower = o.forest.lower;
        if (o.forest?.upper) out.upper = o.forest.upper;
        break;
      case "interval":
        out.point = o.interval?.point ?? ex.field;
        if (o.interval?.lower) out.lower = o.interval.lower;
        if (o.interval?.upper) out.upper = o.interval.upper;
        break;
      case "range":
        out.min = o.range?.minField ?? ex.field;
        if (o.range?.maxField) out.max = o.range.maxField;
        break;
      case "custom":
        out.eventsField = o.events?.eventsField ?? ex.field;
        if (o.events?.nField) out.nField = o.events.nField;
        break;
      case "reference":
        out.value = ex.field;
        if (o.reference?.hrefField) out.hrefField = o.reference.hrefField;
        break;
      default:
        out.value = ex.field;
    }
    return out;
  }

  const currentDef = $derived<VisualTypeDef | undefined>(getVisualTypeDef(selectedType));

  // Fields compatible with each slot of the current visual type.
  const slotChoices = $derived.by<Record<string, AvailableField[]>>(() => {
    if (!currentDef) return {};
    const out: Record<string, AvailableField[]> = {};
    for (const s of currentDef.slots) out[s.key] = slotCompatibleFields(s, available);
    return out;
  });

  // Every required slot is filled.
  const canCommit = $derived.by(() => {
    if (!currentDef) return false;
    for (const s of currentDef.slots) {
      if (s.required && !slotValues[s.key]) return false;
    }
    return true;
  });

  // When the primary slot changes, auto-pair the others (unless the user has
  // already set them to something non-empty).
  function onPrimarySlotChange(slotKey: string, value: string) {
    if (!currentDef) return;
    const paired = autoPairSlots(currentDef, slotKey, value, available);
    const next = { ...slotValues, [slotKey]: value };
    for (const [k, v] of Object.entries(paired)) {
      if (k === slotKey) continue;
      // Respect any explicit choice the user already made in this session.
      if (!next[k]) next[k] = v;
    }
    slotValues = next;
    // Default header: match the primary field label if the user hasn't typed one.
    if (!headerText) {
      const fld = available.find((f) => f.field === value);
      headerText = fld?.label ?? value;
    }
  }

  // Build a ColumnSpec out of the editor state.
  function buildSpec(): ColumnSpec {
    const def = currentDef!;
    const primary = def.slots[0]?.key;
    const primaryField = primary ? slotValues[primary] : "";
    const baseId = target?.mode === "configure" && target.existing ? target.existing.id : primaryField;
    const align = selectedType === "numeric" || selectedType === "pvalue" ? "right" : "left";

    const spec: ColumnSpec = {
      id: baseId,
      header: headerText || primaryField,
      field: primaryField,
      type: selectedType,
      align,
      sortable: true,
      isGroup: false,
    };

    const options: ColumnSpec["options"] = {};
    switch (selectedType) {
      case "numeric":
        if (optDecimals !== "") options.numeric = { decimals: Number(optDecimals) };
        break;
      case "pvalue":
        options.pvalue = { stars: optStars };
        break;
      case "bar":
        if (optMaxValue !== "") options.bar = { maxValue: Number(optMaxValue) };
        break;
      case "progress":
        if (optMaxValue !== "") options.progress = { maxValue: Number(optMaxValue) };
        break;
      case "heatmap":
        if (optDecimals !== "") options.heatmap = { decimals: Number(optDecimals), showValue: true };
        break;
      case "sparkline":
        options.sparkline = { type: optSparklineType };
        break;
      case "forest":
        options.forest = {
          point: slotValues.point,
          lower: slotValues.lower,
          upper: slotValues.upper,
          scale: optScale,
          nullValue: optScale === "log" ? 1 : 0,
          axisLabel: "",
          showAxis: true,
        };
        break;
      case "interval":
        options.interval = {
          point: slotValues.point,
          lower: slotValues.lower,
          upper: slotValues.upper,
          ...(optDecimals !== "" ? { decimals: Number(optDecimals) } : {}),
        };
        break;
      case "range":
        options.range = {
          minField: slotValues.min,
          maxField: slotValues.max,
        };
        break;
      case "custom":
        options.events = {
          eventsField: slotValues.eventsField,
          nField: slotValues.nField,
          showPct: optShowPct,
        };
        break;
      case "reference":
        if (slotValues.hrefField) options.reference = { hrefField: slotValues.hrefField };
        break;
    }

    if (Object.keys(options).length > 0) spec.options = options;
    return spec;
  }

  function commit() {
    if (!target || !canCommit) return;
    const spec = buildSpec();
    onCommit(spec, target.mode, target.afterId);
  }

  // Clamp into viewport.
  $effect(() => {
    if (!target || !popoverEl) {
      resolvedMaxH = null;
      return;
    }
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

  function handlePointerDown(e: PointerEvent) {
    if (!target) return;
    const tgt = e.target as HTMLElement;
    if (popoverEl && popoverEl.contains(tgt)) return;
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!target) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON") {
      // Let buttons handle their own Enter; elsewhere Enter commits.
      if (canCommit) {
        e.preventDefault();
        commit();
      }
    }
  }

  // Group visual types by category for Step 1 display.
  const typesByCategory = $derived.by(() => {
    const order: Array<VisualTypeDef["category"]> = ["text", "numeric", "interval", "viz", "icon"];
    const labels: Record<VisualTypeDef["category"], string> = {
      text: "Text",
      numeric: "Number",
      interval: "Interval",
      viz: "Viz",
      icon: "Icon",
    };
    return order.map((cat) => ({
      category: cat,
      label: labels[cat],
      types: VISUAL_TYPES.filter((t) => t.category === cat),
    }));
  });
</script>

<svelte:window onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

{#if target}
  <div
    class="col-editor-popover"
    bind:this={popoverEl}
    style:left="{resolvedLeft}px"
    style:top="{resolvedTop}px"
    style:max-height={resolvedMaxH ? `${resolvedMaxH}px` : undefined}
    role="dialog"
    aria-label={target.mode === "insert" ? "Insert column" : "Configure column"}
  >
    <div class="editor-header">
      <div class="editor-title">
        {target.mode === "insert" ? "Insert column" : "Configure column"}
      </div>
    </div>

    <!-- Step 1: visual type picker -->
    <div class="type-picker">
      {#each typesByCategory as group (group.category)}
        <div class="type-group">
          <div class="type-group-label">{group.label}</div>
          <div class="type-list">
            {#each group.types as t (t.type)}
              {@const satisfiable = isTypeSatisfiable(t, available)}
              <!-- Keep author-only types visible but greyed so users see what's possible. -->
              <button
                type="button"
                class="type-chip"
                class:selected={selectedType === t.type}
                class:disabled={!satisfiable}
                disabled={!satisfiable}
                title={satisfiable ? t.description : `${t.description} — not compatible with the available data`}
                onclick={() => {
                  if (!satisfiable) return;
                  selectedType = t.type;
                  slotValues = {};
                  resetOptions();
                }}
              >
                {t.label}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Step 2: slot filler + options -->
    {#if currentDef}
      <div class="editor-body">
        {#each currentDef.slots as slot, i (slot.key)}
          {@const choices = slotChoices[slot.key] ?? []}
          <label class="editor-field">
            <span>{slot.label}{slot.required ? "" : " (optional)"}</span>
            <select
              value={slotValues[slot.key] ?? ""}
              onchange={(e) => {
                const v = (e.currentTarget as HTMLSelectElement).value;
                if (i === 0) onPrimarySlotChange(slot.key, v);
                else slotValues = { ...slotValues, [slot.key]: v };
              }}
            >
              <option value="" disabled>Select a field…</option>
              {#each choices as f (f.field)}
                <option value={f.field}>{f.label}</option>
              {/each}
            </select>
          </label>
        {/each}

        <label class="editor-field">
          <span>Header</span>
          <input
            type="text"
            bind:value={headerText}
            placeholder={slotValues[currentDef.slots[0]?.key] ?? "Column header"}
          />
        </label>

        <!-- Type-specific options -->
        {#if selectedType === "numeric" || selectedType === "heatmap" || selectedType === "interval"}
          <label class="editor-field">
            <span>Decimals</span>
            <input
              type="number"
              min="0"
              max="10"
              bind:value={optDecimals}
              placeholder="auto"
            />
          </label>
        {/if}

        {#if selectedType === "pvalue"}
          <label class="editor-check">
            <input type="checkbox" bind:checked={optStars} />
            <span>Show significance stars</span>
          </label>
        {/if}

        {#if selectedType === "bar" || selectedType === "progress"}
          <label class="editor-field">
            <span>Max value</span>
            <input
              type="number"
              bind:value={optMaxValue}
              placeholder={selectedType === "progress" ? "100" : "auto"}
            />
          </label>
        {/if}

        {#if selectedType === "forest"}
          <label class="editor-field">
            <span>Scale</span>
            <select bind:value={optScale}>
              <option value="linear">Linear</option>
              <option value="log">Log</option>
            </select>
          </label>
        {/if}

        {#if selectedType === "sparkline"}
          <label class="editor-field">
            <span>Chart type</span>
            <select bind:value={optSparklineType}>
              <option value="line">Line</option>
              <option value="bar">Bar</option>
              <option value="area">Area</option>
            </select>
          </label>
        {/if}

        {#if selectedType === "custom"}
          <label class="editor-check">
            <input type="checkbox" bind:checked={optShowPct} />
            <span>Show percentage</span>
          </label>
        {/if}
      </div>
    {:else}
      <div class="editor-empty">Pick a column type above to continue.</div>
    {/if}

    <div class="editor-footer">
      <button type="button" class="secondary" onclick={onClose}>Cancel</button>
      <button type="button" class="primary" disabled={!canCommit} onclick={commit}>
        {target.mode === "insert" ? "Insert" : "Save"}
      </button>
    </div>
  </div>
{/if}

<style>
  .col-editor-popover {
    position: fixed;
    width: 320px;
    max-height: 520px;
    padding: 10px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.16);
    z-index: 10003;
    font-family: inherit;
    font-size: 12px;
    color: var(--wf-fg, #1a1a1a);
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
  }
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .editor-title {
    font-weight: 600;
    font-size: 13px;
  }
  .type-picker {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-bottom: 1px solid var(--wf-border, #e2e8f0);
    padding-bottom: 8px;
  }
  .type-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .type-group-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--wf-secondary, #64748b);
    font-weight: 600;
  }
  .type-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .type-chip {
    background: transparent;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 999px;
    padding: 3px 10px;
    font-family: inherit;
    font-size: 11px;
    color: var(--wf-fg, #1a1a1a);
    cursor: pointer;
    white-space: nowrap;
  }
  .type-chip:hover:not(.disabled) {
    background: var(--wf-border, #f1f5f9);
  }
  .type-chip.selected {
    background: var(--wf-primary, #2563eb);
    border-color: var(--wf-primary, #2563eb);
    color: #ffffff;
  }
  .type-chip.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .editor-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .editor-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .editor-field > span {
    font-size: 11px;
    color: var(--wf-secondary, #64748b);
    font-weight: 500;
  }
  .col-editor-popover input[type="text"],
  .col-editor-popover input[type="number"],
  .col-editor-popover select {
    width: 100%;
    padding: 5px 7px;
    font-size: 12px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 4px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-family: inherit;
    box-sizing: border-box;
  }
  .col-editor-popover input:focus,
  .col-editor-popover select:focus {
    outline: none;
    border-color: var(--wf-primary, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }
  .editor-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .editor-empty {
    font-size: 12px;
    color: var(--wf-secondary, #64748b);
    padding: 6px 2px;
  }
  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    border-top: 1px solid var(--wf-border, #e2e8f0);
    padding-top: 8px;
  }
  .editor-footer button {
    padding: 5px 14px;
    font-size: 12px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  }
  .editor-footer .primary {
    background: var(--wf-primary, #2563eb);
    border: 1px solid var(--wf-primary, #2563eb);
    color: #ffffff;
  }
  .editor-footer .primary:hover:not(:disabled) {
    filter: brightness(0.95);
  }
  .editor-footer .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .editor-footer .secondary {
    background: transparent;
    border: 1px solid var(--wf-border, #e2e8f0);
    color: var(--wf-fg, #1a1a1a);
  }
  .editor-footer .secondary:hover {
    background: var(--wf-border, #f1f5f9);
  }
</style>

<script lang="ts" module>
  import type { ColumnSpec as _ColumnSpec, ColumnType as _ColumnType } from "$types";

  export interface EditorTarget {
    mode: "insert" | "configure";
    anchorX: number;
    anchorY: number;
    // For "insert": anchor column id to insert after ("__start__" for first).
    afterId?: string;
    // For "configure": the existing column spec being edited.
    existing?: _ColumnSpec;
    // Pre-selected visual type (from ColumnTypeMenu). The editor no longer
    // renders a type grid — the type is fixed once the editor opens.
    type?: _ColumnType;
    // Human label for the chosen preset (e.g. "Integer") — shown in the header.
    presetLabel?: string;
    // Options bundle pre-seeded from the preset (e.g. { numeric: { decimals: 0 } }).
    seedOptions?: _ColumnSpec["options"];
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
    getVisualTypeDef,
    slotCompatibleFields,
    autoPairSlots,
  } from "$lib/column-compat";

  interface Props {
    target: EditorTarget | null;
    available: AvailableField[];
    onCommit: (spec: ColumnSpec, mode: "insert" | "configure", afterId?: string) => void;
    onClose: () => void;
    // Reopens the ColumnTypeMenu at the same anchor so the user can pick a
    // different type. Optional: if absent, the "Change type…" link is hidden.
    onRequestChangeType?: () => void;
  }

  let { target, available, onCommit, onClose, onRequestChangeType }: Props = $props();

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
  let optPrefix = $state<string>("");
  let optSuffix = $state<string>("");
  let optThousandsSep = $state(false);
  let optMaxChars = $state<string>("");
  let optBarScale = $state<"linear" | "log" | "sqrt">("linear");
  let optMaxStars = $state<string>("");
  let optDomainMin = $state<string>("");
  let optDomainMax = $state<string>("");

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
      // Insert mode: type is fixed by the upstream type menu.
      selectedType = target.type ?? "text";
      slotValues = {};
      headerText = "";
      resetOptions();
      // Apply any seed options provided by the type menu (e.g. Integer → decimals=0).
      if (target.seedOptions) hydrateOptionsFromBundle(selectedType, target.seedOptions);
    }
  });

  function resetOptions() {
    optDecimals = "";
    optScale = "linear";
    optStars = false;
    optMaxValue = "";
    optShowPct = false;
    optSparklineType = "line";
    optPrefix = "";
    optSuffix = "";
    optThousandsSep = false;
    optMaxChars = "";
    optBarScale = "linear";
    optMaxStars = "";
    optDomainMin = "";
    optDomainMax = "";
  }

  // Pull option defaults out of a partial options bundle into the editor state.
  function hydrateOptionsFromBundle(type: ColumnType, o: NonNullable<ColumnSpec["options"]>) {
    if (type === "numeric") {
      if (o.numeric?.decimals != null) optDecimals = String(o.numeric.decimals);
      if (o.numeric?.prefix != null) optPrefix = o.numeric.prefix;
      if (o.numeric?.suffix != null) optSuffix = o.numeric.suffix;
      if (o.numeric?.thousandsSep) optThousandsSep = true;
    }
    if (type === "text" && o.text?.maxChars != null) optMaxChars = String(o.text.maxChars);
    if (type === "pvalue" && o.pvalue?.stars != null) optStars = !!o.pvalue.stars;
    if (type === "bar") {
      if (o.bar?.maxValue != null) optMaxValue = String(o.bar.maxValue);
      if (o.bar?.scale) optBarScale = o.bar.scale;
    }
    if (type === "progress") {
      if (o.progress?.maxValue != null) optMaxValue = String(o.progress.maxValue);
      if (o.progress?.scale) optBarScale = o.progress.scale;
    }
    if (type === "heatmap") {
      if (o.heatmap?.decimals != null) optDecimals = String(o.heatmap.decimals);
      if (o.heatmap?.scale) optBarScale = o.heatmap.scale;
    }
    if (type === "stars") {
      if (o.stars?.maxStars != null) optMaxStars = String(o.stars.maxStars);
      if (o.stars?.domain) {
        optDomainMin = String(o.stars.domain[0]);
        optDomainMax = String(o.stars.domain[1]);
      }
    }
    if (type === "forest" && o.forest?.scale) optScale = o.forest.scale;
    if (type === "interval" && o.interval?.decimals != null) optDecimals = String(o.interval.decimals);
    if (type === "sparkline" && o.sparkline?.type) optSparklineType = o.sparkline.type;
    if (type === "custom" && o.events?.showPct != null) optShowPct = !!o.events.showPct;
  }

  function hydrateOptionsFromExisting(ex: ColumnSpec) {
    resetOptions();
    if (ex.options) hydrateOptionsFromBundle(ex.type, ex.options);
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
      case "numeric": {
        const num: NonNullable<NonNullable<ColumnSpec["options"]>["numeric"]> = {};
        if (optDecimals !== "") num.decimals = Number(optDecimals);
        if (optPrefix !== "") num.prefix = optPrefix;
        if (optSuffix !== "") num.suffix = optSuffix;
        if (optThousandsSep) num.thousandsSep = ",";
        if (Object.keys(num).length > 0) options.numeric = num;
        break;
      }
      case "text": {
        if (optMaxChars !== "") options.text = { maxChars: Number(optMaxChars) };
        break;
      }
      case "pvalue":
        options.pvalue = { stars: optStars };
        break;
      case "bar": {
        const bar: NonNullable<NonNullable<ColumnSpec["options"]>["bar"]> = {};
        if (optMaxValue !== "") bar.maxValue = Number(optMaxValue);
        if (optBarScale !== "linear") bar.scale = optBarScale;
        if (Object.keys(bar).length > 0) options.bar = bar;
        break;
      }
      case "progress": {
        const prog: NonNullable<NonNullable<ColumnSpec["options"]>["progress"]> = {};
        if (optMaxValue !== "") prog.maxValue = Number(optMaxValue);
        if (optBarScale !== "linear") prog.scale = optBarScale;
        if (Object.keys(prog).length > 0) options.progress = prog;
        break;
      }
      case "heatmap": {
        const hm: NonNullable<NonNullable<ColumnSpec["options"]>["heatmap"]> = {};
        if (optDecimals !== "") {
          hm.decimals = Number(optDecimals);
          hm.showValue = true;
        }
        if (optBarScale !== "linear") hm.scale = optBarScale;
        if (Object.keys(hm).length > 0) options.heatmap = hm;
        break;
      }
      case "stars": {
        const st: NonNullable<NonNullable<ColumnSpec["options"]>["stars"]> = {};
        if (optMaxStars !== "") {
          const n = Math.max(1, Math.min(20, Math.round(Number(optMaxStars))));
          st.maxStars = n;
        }
        if (optDomainMin !== "" && optDomainMax !== "") {
          const lo = Number(optDomainMin);
          const hi = Number(optDomainMax);
          if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
            st.domain = [lo, hi];
          }
        }
        if (Object.keys(st).length > 0) options.stars = st;
        break;
      }
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

  // Human-friendly display name for the current type. Prefer the menu-provided
  // preset label (e.g. "Integer") over the generic type label when available.
  const displayTypeLabel = $derived(
    target?.presetLabel ?? currentDef?.label ?? selectedType
  );
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
        <span class="mode-label">{target.mode === "insert" ? "Insert" : "Configure"}</span>
        <span class="type-badge">{displayTypeLabel}</span>
      </div>
      {#if onRequestChangeType}
        <button
          type="button"
          class="change-type-link"
          onclick={onRequestChangeType}
          title="Pick a different column type"
        >
          Change type…
        </button>
      {/if}
    </div>

    <!-- Slot filler + type-specific options -->
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

        {#if selectedType === "numeric"}
          <div class="editor-row">
            <label class="editor-field">
              <span>Prefix</span>
              <input type="text" bind:value={optPrefix} placeholder="e.g. $" maxlength="4" />
            </label>
            <label class="editor-field">
              <span>Suffix</span>
              <input type="text" bind:value={optSuffix} placeholder="e.g. %" maxlength="4" />
            </label>
          </div>
          <label class="editor-check">
            <input type="checkbox" bind:checked={optThousandsSep} />
            <span>Group thousands (1,000)</span>
          </label>
        {/if}

        {#if selectedType === "text"}
          <label class="editor-field">
            <span>Max characters</span>
            <input
              type="number"
              min="1"
              bind:value={optMaxChars}
              placeholder="no limit"
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

        {#if selectedType === "bar" || selectedType === "progress" || selectedType === "heatmap"}
          <label class="editor-field">
            <span>Scale</span>
            <select bind:value={optBarScale}>
              <option value="linear">Linear</option>
              <option value="log">Log</option>
              <option value="sqrt">Sqrt</option>
            </select>
          </label>
        {/if}

        {#if selectedType === "stars"}
          <label class="editor-field">
            <span>Max stars</span>
            <input
              type="number"
              min="1"
              max="20"
              bind:value={optMaxStars}
              placeholder="5"
            />
          </label>
          <div class="editor-row">
            <label class="editor-field">
              <span>Domain min</span>
              <input type="number" bind:value={optDomainMin} placeholder="optional" />
            </label>
            <label class="editor-field">
              <span>Domain max</span>
              <input type="number" bind:value={optDomainMax} placeholder="optional" />
            </label>
          </div>
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
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--wf-border, #e2e8f0);
  }
  .editor-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    min-width: 0;
  }
  .mode-label {
    color: var(--wf-secondary, #64748b);
    font-weight: 500;
  }
  .type-badge {
    font-weight: 600;
    color: var(--wf-fg, #1a1a1a);
    background: color-mix(in srgb, var(--wf-primary, #3b82f6) 12%, transparent);
    padding: 1px 8px;
    border-radius: 999px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }
  .change-type-link {
    background: transparent;
    border: none;
    color: var(--wf-primary, #3b82f6);
    font-size: 11px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    font-family: inherit;
    white-space: nowrap;
  }
  .change-type-link:hover {
    background: var(--wf-hover, #eef2ff);
  }
  .editor-row {
    display: flex;
    gap: 8px;
  }
  .editor-row .editor-field {
    flex: 1;
    min-width: 0;
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

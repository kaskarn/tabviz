<!--
  ColumnEditorPopover — popover for inserting / configuring a column.

  Phase 0c-C3 audit (2026-05): originally 1633 lines. After per-type
  option extraction this shell is ~1010 lines. Remaining size is the
  cohesive workflow shell: type selection, slot wiring, popover
  viewport clamping, commit pipeline, alignment controls. None of
  these extract cleanly into siblings — they're a single form.

  Per-type extractions (the big-impact ones):
  - ForestOptionsEditor (forest)
  - SparklineOptionsEditor (sparkline)
  - NumericDomainOptionsEditor (bar, progress, heatmap — shared)
  - StarsOptionsEditor (stars)
  - NumericOptionsEditor (numeric)
  - VizOptionsEditor (viz_bar, viz_boxplot, viz_violin — shared)

  Tiny remaining inline blocks (intentionally not extracted, each is
  1-2 controls):
  - text → optMaxChars input
  - pvalue → optStars checkbox
  - custom → optShowPct checkbox
  - interval / heatmap → shared optDecimals input (heatmap also reads
    showValue side-effect)

  Pattern for adding a new per-type editor: see ForestOptionsEditor
  + option-slices/forest-options.svelte.ts as the canonical template.
-->
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
    resolveShowHeader,
  } from "$lib/column-types";
  import ForestOptionsEditor from "./ForestOptionsEditor.svelte";
  import SparklineOptionsEditor from "./SparklineOptionsEditor.svelte";
  import NumericDomainOptionsEditor from "./NumericDomainOptionsEditor.svelte";
  import StarsOptionsEditor from "./StarsOptionsEditor.svelte";
  import NumericOptionsEditor from "./NumericOptionsEditor.svelte";
  import VizOptionsEditor from "./VizOptionsEditor.svelte";

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
  let showHeader = $state(true);
  // Light options editor — covers the most common knobs per type.
  // `optDecimals` lives here for heatmap + interval (which share the
  // input but each store the value in their own options bundle).
  // Numeric's decimals moved into NumericOptionsEditor (Phase 0c-C3).
  let optDecimals = $state<string>("");
  type NumericEditorRef = {
    reset(): void;
    hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
    build(): NonNullable<NonNullable<ColumnSpec["options"]>["numeric"]>;
  };
  let numericEditor = $state<NumericEditorRef | null>(null);
  let optStars = $state(false);
  // bar/progress/heatmap maxValue + scale moved to NumericDomainOptionsEditor
  // sub-components (Phase 0c-C3). Three separate bind:this refs because
  // each type's component is rendered conditionally and we need to dispatch
  // build()/hydrate()/reset() to the active one.
  type NumericDomainEditorRef = {
    reset(): void;
    hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
    build(): NonNullable<NonNullable<ColumnSpec["options"]>["bar"]>
            | NonNullable<NonNullable<ColumnSpec["options"]>["progress"]>
            | NonNullable<NonNullable<ColumnSpec["options"]>["heatmap"]>;
  };
  let barEditor = $state<NumericDomainEditorRef | null>(null);
  let progressEditor = $state<NumericDomainEditorRef | null>(null);
  let heatmapEditor = $state<NumericDomainEditorRef | null>(null);
  let optShowPct = $state(false);
  // Sparkline state moved to SparklineOptionsEditor sub-component (Phase 0c-C3).
  type SparklineEditorRef = {
    reset(): void;
    hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
    build(): { type: "line" | "bar" | "area" };
  };
  let sparklineEditor = $state<SparklineEditorRef | null>(null);
  // optPrefix / optSuffix / optThousandsSep moved into NumericOptionsEditor.
  let optMaxChars = $state<string>("");
  // optBarScale moved into NumericDomainOptionsEditor (Phase 0c-C3).
  // Stars state moved to StarsOptionsEditor sub-component (Phase 0c-C3).
  type StarsEditorRef = {
    reset(): void;
    hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
    build(): NonNullable<NonNullable<ColumnSpec["options"]>["stars"]>;
  };
  let starsEditor = $state<StarsEditorRef | null>(null);
  // Forest column per-column options (beyond scale). These live on the
  // ColumnSpec.options.forest slot and override theme.axis equivalents
  // for that specific column — a per-column forest plot's axis config
  // is inherently column-specific.
  // Forest options moved to ForestOptionsEditor sub-component (Phase 0c-C3).
  // The parent reads/writes via `bind:this={forestEditor}` and calls
  // forestEditor.{reset,hydrateFromSpec,build,getScale}() from the lifecycle
  // hooks (resetOptions, hydrateOptionsFromBundle, buildSpec).
  type ForestEditorRef = {
    reset(): void;
    hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
    build(args: { point: string; lower: string; upper: string }): NonNullable<NonNullable<ColumnSpec["options"]>["forest"]>;
    getScale(): "linear" | "log";
  };
  let forestEditor = $state<ForestEditorRef | null>(null);
  // Content alignment (per-column) — drives the column's `align` property
  // (cell text alignment). Shown in the header row alongside the header
  // text input and the "show header" checkbox.
  let optAlign = $state<"left" | "center" | "right">("left");
  // Header-specific alignment override. `null` = inherit from `optAlign`.
  // Surfaces as a secondary segmented button row so users can differ
  // header text alignment from cell alignment when needed.
  let optHeaderAlign = $state<"left" | "center" | "right" | null>(null);

  // Multi-effect viz editor state moved to VizOptionsEditor sub-component
  // (Phase 0c-C3). vizEffects, vizBoxplotMode, addEffect/removeEffect/
  // moveEffect/updateEffect, and the hydrate / build helpers all now
  // live inside the slice + the component. The parent holds a bind:this
  // ref and delegates lifecycle calls.
  type VizEditorRef = {
    reset(initial?: boolean): void;
    hydrateFromSpec(ex: ColumnSpec): void;
    build(): Record<string, unknown>;
    isPrimaryValueResolved(): boolean;
    getFirstEffectField(): string;
  };
  let vizEditor = $state<VizEditorRef | null>(null);

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
      showHeader = resolveShowHeader(ex.showHeader, ex.header);
      optAlign = (ex.align as "left" | "center" | "right") ?? "left";
      optHeaderAlign =
        (ex.headerAlign as "left" | "center" | "right" | null | undefined) ?? null;
      slotValues = slotsFromExistingSpec(ex);
      hydrateOptionsFromExisting(ex);
    } else {
      // Insert mode: type is fixed by the upstream type menu.
      selectedType = target.type ?? "text";
      slotValues = {};
      headerText = "";
      showHeader = true;
      resetOptions();
      // resetOptions no longer touches optAlign/optHeaderAlign; reset
      // them here on insert so the segmented buttons start clean.
      optAlign = "left";
      optHeaderAlign = null;
      // Apply any seed options provided by the type menu (e.g. Integer → decimals=0).
      if (target.seedOptions) hydrateOptionsFromBundle(selectedType, target.seedOptions);
      // viz_* columns start with a single blank effect row so the user
      // has something to fill in. Insert a second via the "Add effect"
      // button.
      if (selectedType === "viz_bar" || selectedType === "viz_boxplot" || selectedType === "viz_violin") {
        // Seed a single blank effect row so the user has something to fill in.
        // The vizEditor instance is not yet bound during $effect setup (Svelte
        // mounts children after parent $effects), so we schedule the seed for
        // after the next tick via a microtask.
        queueMicrotask(() => vizEditor?.reset(true));
      }
    }
  });

  function resetOptions() {
    optDecimals = "";
    optStars = false;
    barEditor?.reset();
    progressEditor?.reset();
    heatmapEditor?.reset();
    optShowPct = false;
    sparklineEditor?.reset();
    numericEditor?.reset();
    optMaxChars = "";
    starsEditor?.reset();
    forestEditor?.reset();
    // `optAlign` and `optHeaderAlign` are intentionally NOT reset here:
    // resetOptions() runs inside `hydrateOptionsFromExisting()` (called
    // AFTER the $effect has initialized them from `ex.align` /
    // `ex.headerAlign`) and inside the insert branch. Clobbering them
    // here would overwrite the just-set values and the segmented
    // buttons would always open on "left" when a user hit Configure —
    // that's the v0.21.x "alignment menu isn't sticky" bug.
    vizEditor?.reset(false);
  }

  // Viz state helpers (newEffect, hydrateVizEffectsFromExisting, addEffect,
  // removeEffect, moveEffect, updateEffect) moved into VizOptionsEditor +
  // viz-options.svelte.ts slice (Phase 0c-C3).

  // Pull option defaults out of a partial options bundle into the editor state.
  function hydrateOptionsFromBundle(type: ColumnType, o: NonNullable<ColumnSpec["options"]>) {
    if (type === "numeric") numericEditor?.hydrateFromSpec(o);
    if (type === "text" && o.text?.maxChars != null) optMaxChars = String(o.text.maxChars);
    if (type === "pvalue" && o.pvalue?.stars != null) optStars = !!o.pvalue.stars;
    if (type === "bar") barEditor?.hydrateFromSpec(o);
    if (type === "progress") progressEditor?.hydrateFromSpec(o);
    if (type === "heatmap") {
      if (o.heatmap?.decimals != null) optDecimals = String(o.heatmap.decimals);
      heatmapEditor?.hydrateFromSpec(o);
    }
    if (type === "stars") starsEditor?.hydrateFromSpec(o);
    if (type === "forest") {
      forestEditor?.hydrateFromSpec(o);
    }
    if (type === "interval" && o.interval?.decimals != null) optDecimals = String(o.interval.decimals);
    if (type === "sparkline") sparklineEditor?.hydrateFromSpec(o);
    if (type === "custom" && o.events?.showPct != null) optShowPct = !!o.events.showPct;
  }

  function hydrateOptionsFromExisting(ex: ColumnSpec) {
    resetOptions();
    if (ex.options) hydrateOptionsFromBundle(ex.type, ex.options);
    if (ex.type === "viz_bar" || ex.type === "viz_boxplot" || ex.type === "viz_violin") {
      // vizEditor is mounted conditionally; schedule the hydrate for
      // after the next tick so the bind:this ref is in place.
      queueMicrotask(() => vizEditor?.hydrateFromSpec(ex));
    }
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

  // Every required slot is filled. For viz_* types (which use the
  // multi-effect editor, not slots) we require at least one effect with
  // its minimum data binding(s) filled in.
  const canCommit = $derived.by(() => {
    if (!currentDef) return false;
    if (selectedType === "viz_bar" || selectedType === "viz_boxplot" || selectedType === "viz_violin") {
      return vizEditor?.isPrimaryValueResolved() ?? false;
    }
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
    // viz_* columns have empty slot lists (effects live in their own
    // editor). For those, fall back to the first effect's data field so
    // the spec gets a non-empty id/field on insert. We read this via the
    // editor's bind:this ref since vizEffects state lives there now.
    const isViz = selectedType === "viz_bar" || selectedType === "viz_boxplot" || selectedType === "viz_violin";
    const vizFirstField = isViz ? (vizEditor?.getFirstEffectField() ?? "") : "";
    const primaryField = primary ? slotValues[primary] : vizFirstField;
    // Default id scheme mirrors R's `<type>_<field>` (v0.21+). `mintUniqueColumnId`
    // will disambiguate with a `_2` suffix if the id is already taken — the
    // error-on-collision behavior only applies to R-authored specs, not
    // interactive inserts where the user can't edit R source to fix a clash.
    const proposedId = primaryField ? `${selectedType}_${primaryField}` : selectedType;
    const baseId = target?.mode === "configure" && target.existing ? target.existing.id : proposedId;
    // Header alignment is an explicit control now. Default suggestion on
    // insert: right for numeric/pvalue (numeric readability), center for
    // forest/bar-like viz columns, left otherwise. Users override via the
    // Header row's alignment segmented.
    const inferredAlign =
      selectedType === "numeric" || selectedType === "pvalue" ? "right" :
      selectedType === "forest" || selectedType === "bar" || selectedType === "viz_bar" ||
      selectedType === "viz_boxplot" || selectedType === "viz_violin" || selectedType === "sparkline"
        ? "center"
        : "left";
    const align =
      target?.mode === "configure"
        ? optAlign
        : inferredAlign;

    const spec: ColumnSpec = {
      id: baseId,
      header: headerText || primaryField,
      field: primaryField,
      type: selectedType,
      align,
      // `headerAlign` stays nullish when the user hasn't diverged from
      // content alignment; renderers fall back to `align` in that case.
      headerAlign: optHeaderAlign,
      sortable: true,
      isGroup: false,
      showHeader,
    };

    const options: ColumnSpec["options"] = {};
    switch (selectedType) {
      case "numeric": {
        const num = numericEditor?.build() ?? {};
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
        const bar = barEditor?.build() ?? {};
        if (Object.keys(bar).length > 0) options.bar = bar as NonNullable<NonNullable<ColumnSpec["options"]>["bar"]>;
        break;
      }
      case "progress": {
        const prog = progressEditor?.build() ?? {};
        if (Object.keys(prog).length > 0) options.progress = prog as NonNullable<NonNullable<ColumnSpec["options"]>["progress"]>;
        break;
      }
      case "heatmap": {
        const hm = (heatmapEditor?.build() ?? {}) as NonNullable<NonNullable<ColumnSpec["options"]>["heatmap"]>;
        if (optDecimals !== "") {
          hm.decimals = Number(optDecimals);
          hm.showValue = true;
        }
        if (Object.keys(hm).length > 0) options.heatmap = hm;
        break;
      }
      case "stars": {
        const st = starsEditor?.build() ?? {};
        if (Object.keys(st).length > 0) options.stars = st;
        break;
      }
      case "sparkline":
        if (sparklineEditor) options.sparkline = sparklineEditor.build();
        break;
      case "forest": {
        if (forestEditor) {
          options.forest = forestEditor.build({
            point: slotValues.point,
            lower: slotValues.lower,
            upper: slotValues.upper,
          });
        }
        break;
      }
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
      case "viz_bar": {
        const built = vizEditor?.build() as { type: string; effects: unknown[] } | undefined;
        if (built) options.bar = built as NonNullable<NonNullable<ColumnSpec["options"]>["bar"]>;
        break;
      }
      case "viz_boxplot": {
        const built = vizEditor?.build() as { type: string; effects: unknown[] } | undefined;
        if (built) options.boxplot = built as NonNullable<NonNullable<ColumnSpec["options"]>["boxplot"]>;
        break;
      }
      case "viz_violin": {
        const built = vizEditor?.build() as { type: string; effects: unknown[] } | undefined;
        if (built) options.violin = built as NonNullable<NonNullable<ColumnSpec["options"]>["violin"]>;
        break;
      }
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
        <!-- Compact slot rows: "Label: [field select]" on one line, same
             idiom as the advanced-settings fields. Optional flag trails
             the label in a muted hue so the eye catches required vs. not. -->
        {#each currentDef.slots as slot, i (slot.key)}
          {@const choices = slotChoices[slot.key] ?? []}
          <div class="slot-row">
            <span class="slot-label">
              {slot.label}{#if !slot.required}<span class="slot-optional"> optional</span>{/if}
            </span>
            <select
              class="slot-select"
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
          </div>
        {/each}

        <!-- Compact header row: "Header: [ name box ] [✓ show]". The
             alignment controls moved to a dedicated row below so Cell vs
             Header align can be distinguished. -->
        <div class="header-row">
          <span class="editor-label">Header</span>
          <input
            type="text"
            class="header-input"
            bind:value={headerText}
            placeholder={slotValues[currentDef.slots[0]?.key] ?? "Column header"}
            disabled={!showHeader}
          />
          <label class="show-check" title="Show column header">
            <input type="checkbox" bind:checked={showHeader} />
            <span>show</span>
          </label>
        </div>

        <!-- Alignment row: two independent segments. Cell = content (data
             cells), Header = column header (inherits Cell by default).
             `optHeaderAlign = null` means "inherit" — rendered as the
             dimmed segment state. -->
        <div class="align-row">
          <span class="editor-label">Align</span>
          <div class="align-seg" role="radiogroup" aria-label="Cell alignment">
            {#each (["left", "center", "right"] as const) as a (a)}
              <button
                type="button"
                class:selected={optAlign === a}
                onclick={() => (optAlign = a)}
                title={`Cell align ${a}`}
                aria-label={`Cell align ${a}`}
              >
                {#if a === "left"}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
                {:else if a === "center"}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
                {/if}
              </button>
            {/each}
          </div>
          <span class="editor-label ml">Header</span>
          <div class="align-seg align-seg-header" role="radiogroup" aria-label="Header alignment">
            <button
              type="button"
              class="inherit-btn"
              class:selected={optHeaderAlign == null}
              onclick={() => (optHeaderAlign = null)}
              title="Inherit from cell alignment"
              aria-label="Inherit header alignment from cell"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            </button>
            {#each (["left", "center", "right"] as const) as a (a)}
              <button
                type="button"
                class:selected={optHeaderAlign === a}
                onclick={() => (optHeaderAlign = a)}
                title={`Header align ${a}`}
                aria-label={`Header align ${a}`}
              >
                {#if a === "left"}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
                {:else if a === "center"}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Type-specific options -->
        {#if selectedType === "heatmap" || selectedType === "interval"}
          <!-- heatmap and interval still use the parent-owned optDecimals;
               their full options editors will land in follow-up C3 PRs. -->
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
          <NumericOptionsEditor bind:this={numericEditor} />
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

        {#if selectedType === "bar"}
          <NumericDomainOptionsEditor type="bar" bind:this={barEditor} />
        {/if}
        {#if selectedType === "progress"}
          <NumericDomainOptionsEditor type="progress" bind:this={progressEditor} />
        {/if}
        {#if selectedType === "heatmap"}
          <NumericDomainOptionsEditor type="heatmap" bind:this={heatmapEditor} />
        {/if}

        {#if selectedType === "stars"}
          <StarsOptionsEditor bind:this={starsEditor} />
        {/if}

        {#if selectedType === "forest"}
          <ForestOptionsEditor bind:this={forestEditor} />
        {/if}

        {#if selectedType === "sparkline"}
          <SparklineOptionsEditor bind:this={sparklineEditor} />
        {/if}

        {#if selectedType === "custom"}
          <label class="editor-check">
            <input type="checkbox" bind:checked={optShowPct} />
            <span>Show percentage</span>
          </label>
        {/if}

        <!-- ─ Multi-effect viz editor ─────────────────────────────── -->
        <!-- viz_bar / viz_boxplot / viz_violin columns carry a list of
             effects. Full CRUD lives in VizOptionsEditor (Phase 0c-C3). -->
        {#if selectedType === "viz_bar" || selectedType === "viz_boxplot" || selectedType === "viz_violin"}
          <VizOptionsEditor
            type={selectedType}
            {available}
            bind:this={vizEditor}
          />
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
    width: 360px;
    max-height: 580px;
    padding: 10px;
    background: var(--tv-bg, #ffffff);
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.16);
    z-index: 10003;
    font-family: inherit;
    font-size: 12px;
    color: var(--tv-fg, #1a1a1a);
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
    border-bottom: 1px solid var(--tv-border, #e2e8f0);
  }
  .editor-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    min-width: 0;
  }
  .mode-label {
    color: var(--tv-text-muted, #64748b);
    font-weight: 500;
  }
  .type-badge {
    font-weight: 600;
    color: var(--tv-fg, #1a1a1a);
    background: color-mix(in srgb, var(--tv-accent, #3b82f6) 12%, transparent);
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
    color: var(--tv-accent, #3b82f6);
    font-size: 11px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    font-family: inherit;
    white-space: nowrap;
  }
  .change-type-link:hover {
    background: var(--tv-hover, #eef2ff);
  }
  /* `.editor-row`, `.editor-row .editor-field`, `.check-row`, and
     `.editor-advanced` (+ its descendants) all moved into per-type
     sub-components in Phase 0c-C3 (ForestOptionsEditor,
     NumericOptionsEditor, etc.). */

  /* Compact single-line "Header: [input] [✓show]" row. */
  .header-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }

  /* Alignment row: `Align: [seg]  Header: [inherit|seg]`. Lets the user
     pick cell and header alignment independently. */
  .align-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }
  .align-row .editor-label.ml {
    margin-left: 6px;
  }
  .align-seg-header .inherit-btn[class] {
    opacity: 0.6;
  }
  .align-seg-header .inherit-btn.selected {
    opacity: 1;
  }
  .editor-label {
    font-size: 11px;
    color: var(--tv-text-muted, #64748b);
    font-weight: 500;
  }
  .header-input {
    flex: 1;
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 12px;
  }
  .header-input:disabled {
    opacity: 0.45;
  }
  .align-seg {
    display: inline-flex;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    overflow: hidden;
  }
  .align-seg button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--tv-text-muted, #64748b);
    cursor: pointer;
  }
  .align-seg button + button {
    border-left: 1px solid var(--tv-border, #e2e8f0);
  }
  .align-seg button.selected {
    background: color-mix(in srgb, var(--tv-accent, #3b82f6) 18%, var(--tv-bg, #ffffff));
    color: var(--tv-accent, #3b82f6);
  }
  .show-check {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 10.5px;
    color: var(--tv-text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    cursor: pointer;
  }
  .editor-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  /* Compact inline layout: `label | control`. Labels sit to the left in a
     fixed column so consecutive fields line up. Two-up rows nest via
     `.editor-row` which switches to a flex layout with `gap`. */
  .editor-field {
    display: grid;
    grid-template-columns: 90px 1fr;
    align-items: center;
    gap: 8px;
    padding: 1px 0;
  }
  .editor-field > span {
    font-size: 11px;
    color: var(--tv-text-muted, #64748b);
    font-weight: 500;
  }
  /* Horizontal-editor-row override (Prefix | Suffix etc.) moved into
     per-type sub-components (Phase 0c-C3). */
  .col-editor-popover input[type="text"],
  .col-editor-popover input[type="number"],
  .col-editor-popover select {
    width: 100%;
    padding: 5px 7px;
    font-size: 12px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-family: inherit;
    box-sizing: border-box;
  }
  .col-editor-popover input:focus,
  .col-editor-popover select:focus {
    outline: none;
    border-color: var(--tv-accent, #2563eb);
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
    color: var(--tv-text-muted, #64748b);
    padding: 6px 2px;
  }
  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    border-top: 1px solid var(--tv-border, #e2e8f0);
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
    background: var(--tv-accent, #2563eb);
    border: 1px solid var(--tv-accent, #2563eb);
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
    border: 1px solid var(--tv-border, #e2e8f0);
    color: var(--tv-fg, #1a1a1a);
  }
  .editor-footer .secondary:hover {
    background: var(--tv-border, #f1f5f9);
  }

  /* ─ Compact slot rows ──────────────────────────────────────────── */
  .slot-row {
    display: grid;
    grid-template-columns: 72px 1fr;
    align-items: center;
    gap: 8px;
    padding: 1px 0;
  }
  .slot-label {
    font-size: 11px;
    color: var(--tv-text-muted, #64748b);
    font-weight: 500;
  }
  .slot-optional {
    font-weight: 400;
    opacity: 0.7;
    font-size: 10px;
  }
  .slot-select {
    width: 100%;
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 12px;
    font-family: inherit;
  }

  /* All `.effects-*` and `.effect-*` styles moved into
     VizOptionsEditor.svelte in Phase 0c-C3. */
</style>

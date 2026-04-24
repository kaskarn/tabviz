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
  let showHeader = $state(true);
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
  // Forest column per-column options (beyond scale). These live on the
  // ColumnSpec.options.forest slot and override theme.axis equivalents
  // for that specific column — a per-column forest plot's axis config
  // is inherently column-specific.
  let optForestNullValue = $state<string>("");
  let optForestAxisLabel = $state<string>("");
  let optForestShowAxis = $state<boolean>(true);
  let optForestAxisGridlines = $state<boolean>(false);
  let optForestAxisRangeMin = $state<string>("");
  let optForestAxisRangeMax = $state<string>("");
  let optForestAxisTicks = $state<string>(""); // comma-separated
  // Content alignment (per-column) — drives the column's `align` property
  // (cell text alignment). Shown in the header row alongside the header
  // text input and the "show header" checkbox.
  let optAlign = $state<"left" | "center" | "right">("left");
  // Header-specific alignment override. `null` = inherit from `optAlign`.
  // Surfaces as a secondary segmented button row so users can differ
  // header text alignment from cell alignment when needed.
  let optHeaderAlign = $state<"left" | "center" | "right" | null>(null);

  // ─ Multi-effect viz editor state ──────────────────────────────────────
  //
  // viz_bar / viz_boxplot / viz_violin columns render a list of "effects"
  // (each effect = one bar / box / violin stacked in the cell). The editor
  // keeps a raw list of effect records and a per-type schema; UI renders
  // each row dynamically based on the active type.
  //
  // Effects are stored as plain records here (stringly-typed field refs)
  // and converted back into the strongly-typed VizBarEffect /
  // VizBoxplotEffect / VizViolinEffect on commit.
  type VizEffectRow = {
    label?: string;
    color?: string;
    opacity?: string; // stringified for the number input; empty = "no override"
    value?: string; // viz_bar
    data?: string; // viz_boxplot / viz_violin
    min?: string; q1?: string; median?: string; q3?: string; max?: string; outliers?: string; // viz_boxplot
  };
  let vizEffects = $state<VizEffectRow[]>([]);
  // viz_boxplot has two data modes: "array" uses a single `data` column;
  // "stats" uses the five precomputed stats columns. UI exposes a
  // toggle so users don't have to guess which slots to fill.
  let vizBoxplotMode = $state<"array" | "stats">("array");

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
      // Apply any seed options provided by the type menu (e.g. Integer → decimals=0).
      if (target.seedOptions) hydrateOptionsFromBundle(selectedType, target.seedOptions);
      // viz_* columns start with a single blank effect row so the user
      // has something to fill in. Insert a second via the "Add effect"
      // button.
      if (selectedType === "viz_bar" || selectedType === "viz_boxplot" || selectedType === "viz_violin") {
        vizEffects = [newEffect()];
      }
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
    optForestNullValue = "";
    optForestAxisLabel = "";
    optForestShowAxis = true;
    optForestAxisGridlines = false;
    optForestAxisRangeMin = "";
    optForestAxisRangeMax = "";
    optForestAxisTicks = "";
    optAlign = "left";
    optHeaderAlign = null;
    vizEffects = [];
    vizBoxplotMode = "array";
  }

  /** Seed a new effect with sensible defaults for the active viz type. */
  function newEffect(): VizEffectRow {
    return {};
  }

  /** Hydrate the vizEffects array from an existing ColumnSpec's options. */
  function hydrateVizEffectsFromExisting(ex: ColumnSpec) {
    const o = ex.options ?? {};
    if (ex.type === "viz_bar") {
      const effs = (o.bar?.effects ?? []) as Array<Record<string, unknown>>;
      vizEffects = effs.map((e) => ({
        value: (e.value as string) ?? "",
        label: (e.label as string) ?? "",
        color: (e.color as string) ?? "",
        opacity: e.opacity != null ? String(e.opacity) : "",
      }));
    } else if (ex.type === "viz_boxplot") {
      const effs = (o.boxplot?.effects ?? []) as Array<Record<string, unknown>>;
      // Detect mode from the first effect — array if `data` is set,
      // stats if the five stat columns are present.
      const first = effs[0] ?? {};
      vizBoxplotMode = first.data ? "array" : "stats";
      vizEffects = effs.map((e) => ({
        data: (e.data as string) ?? "",
        min: (e.min as string) ?? "",
        q1: (e.q1 as string) ?? "",
        median: (e.median as string) ?? "",
        q3: (e.q3 as string) ?? "",
        max: (e.max as string) ?? "",
        outliers: (e.outliers as string) ?? "",
        label: (e.label as string) ?? "",
        color: (e.color as string) ?? "",
        opacity: e.opacity != null ? String(e.opacity) : "",
      }));
    } else if (ex.type === "viz_violin") {
      const effs = (o.violin?.effects ?? []) as Array<Record<string, unknown>>;
      vizEffects = effs.map((e) => ({
        data: (e.data as string) ?? "",
        label: (e.label as string) ?? "",
        color: (e.color as string) ?? "",
        opacity: e.opacity != null ? String(e.opacity) : "",
      }));
    }
  }

  function addEffect() {
    vizEffects = [...vizEffects, newEffect()];
  }
  function removeEffect(idx: number) {
    vizEffects = vizEffects.filter((_, i) => i !== idx);
  }
  function moveEffect(idx: number, delta: number) {
    const next = [...vizEffects];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    vizEffects = next;
  }
  function updateEffect(idx: number, patch: Partial<VizEffectRow>) {
    vizEffects = vizEffects.map((e, i) => (i === idx ? { ...e, ...patch } : e));
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
    if (type === "forest") {
      if (o.forest?.scale) optScale = o.forest.scale;
      if (o.forest?.nullValue != null) optForestNullValue = String(o.forest.nullValue);
      if (o.forest?.axisLabel != null) optForestAxisLabel = o.forest.axisLabel;
      if (o.forest?.showAxis != null) optForestShowAxis = !!o.forest.showAxis;
      if (o.forest?.axisGridlines != null) optForestAxisGridlines = !!o.forest.axisGridlines;
      if (Array.isArray(o.forest?.axisRange) && o.forest.axisRange.length === 2) {
        optForestAxisRangeMin = String(o.forest.axisRange[0]);
        optForestAxisRangeMax = String(o.forest.axisRange[1]);
      }
      if (Array.isArray(o.forest?.axisTicks)) {
        optForestAxisTicks = o.forest.axisTicks.join(", ");
      }
    }
    if (type === "interval" && o.interval?.decimals != null) optDecimals = String(o.interval.decimals);
    if (type === "sparkline" && o.sparkline?.type) optSparklineType = o.sparkline.type;
    if (type === "custom" && o.events?.showPct != null) optShowPct = !!o.events.showPct;
  }

  function hydrateOptionsFromExisting(ex: ColumnSpec) {
    resetOptions();
    if (ex.options) hydrateOptionsFromBundle(ex.type, ex.options);
    if (ex.type === "viz_bar" || ex.type === "viz_boxplot" || ex.type === "viz_violin") {
      hydrateVizEffectsFromExisting(ex);
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
    if (selectedType === "viz_bar") {
      return vizEffects.length > 0 && vizEffects.every((e) => !!e.value);
    }
    if (selectedType === "viz_boxplot") {
      if (vizEffects.length === 0) return false;
      if (vizBoxplotMode === "array") {
        return vizEffects.every((e) => !!e.data);
      }
      return vizEffects.every(
        (e) => !!e.min && !!e.q1 && !!e.median && !!e.q3 && !!e.max,
      );
    }
    if (selectedType === "viz_violin") {
      return vizEffects.length > 0 && vizEffects.every((e) => !!e.data);
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
    // the spec gets a non-empty id/field on insert.
    const isViz = selectedType === "viz_bar" || selectedType === "viz_boxplot" || selectedType === "viz_violin";
    const vizFirstField = isViz ? (vizEffects[0]?.value ?? vizEffects[0]?.data ?? vizEffects[0]?.median ?? "") : "";
    const primaryField = primary ? slotValues[primary] : vizFirstField;
    const baseId = target?.mode === "configure" && target.existing ? target.existing.id : primaryField;
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
      case "forest": {
        const forest: NonNullable<NonNullable<ColumnSpec["options"]>["forest"]> = {
          point: slotValues.point,
          lower: slotValues.lower,
          upper: slotValues.upper,
          scale: optScale,
          nullValue: optForestNullValue !== ""
            ? Number(optForestNullValue)
            : (optScale === "log" ? 1 : 0),
          axisLabel: optForestAxisLabel,
          showAxis: optForestShowAxis,
        };
        if (optForestAxisGridlines) forest.axisGridlines = true;
        const rMin = optForestAxisRangeMin !== "" ? Number(optForestAxisRangeMin) : null;
        const rMax = optForestAxisRangeMax !== "" ? Number(optForestAxisRangeMax) : null;
        if (rMin != null && rMax != null && Number.isFinite(rMin) && Number.isFinite(rMax)) {
          forest.axisRange = [rMin, rMax];
        }
        if (optForestAxisTicks.trim() !== "") {
          const ticks = optForestAxisTicks
            .split(/[,\s]+/)
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n));
          if (ticks.length > 0) forest.axisTicks = ticks;
        }
        options.forest = forest;
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
        // Strip empty-string fields so the emitted options object is clean.
        const effects = vizEffects
          .filter((e) => e.value)
          .map((e) => {
            const out: Record<string, unknown> = { value: e.value };
            if (e.label)  out.label = e.label;
            if (e.color)  out.color = e.color;
            if (e.opacity && Number.isFinite(Number(e.opacity))) {
              out.opacity = Number(e.opacity);
            }
            return out;
          });
        options.bar = { type: "bar", effects };
        break;
      }
      case "viz_boxplot": {
        const effects = vizEffects.map((e) => {
          const out: Record<string, unknown> = {};
          if (vizBoxplotMode === "array") {
            if (e.data) out.data = e.data;
          } else {
            if (e.min)      out.min = e.min;
            if (e.q1)       out.q1 = e.q1;
            if (e.median)   out.median = e.median;
            if (e.q3)       out.q3 = e.q3;
            if (e.max)      out.max = e.max;
            if (e.outliers) out.outliers = e.outliers;
          }
          if (e.label) out.label = e.label;
          if (e.color) out.color = e.color;
          if (e.opacity && Number.isFinite(Number(e.opacity))) {
            out.opacity = Number(e.opacity);
          }
          return out;
        });
        options.boxplot = { type: "boxplot", effects };
        break;
      }
      case "viz_violin": {
        const effects = vizEffects
          .filter((e) => e.data)
          .map((e) => {
            const out: Record<string, unknown> = { data: e.data };
            if (e.label) out.label = e.label;
            if (e.color) out.color = e.color;
            if (e.opacity && Number.isFinite(Number(e.opacity))) {
              out.opacity = Number(e.opacity);
            }
            return out;
          });
        options.violin = { type: "violin", effects };
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
          <div class="editor-row">
            <label class="editor-field">
              <span>Scale</span>
              <select bind:value={optScale}>
                <option value="linear">Linear</option>
                <option value="log">Log</option>
              </select>
            </label>
            <label class="editor-field">
              <span>Null value</span>
              <input
                type="number"
                step="any"
                bind:value={optForestNullValue}
                placeholder={optScale === "log" ? "1" : "0"}
              />
            </label>
          </div>
          <label class="editor-field">
            <span>Axis label</span>
            <input
              type="text"
              bind:value={optForestAxisLabel}
              placeholder="Effect"
            />
          </label>
          <div class="editor-row">
            <label class="editor-field">
              <span>Axis min</span>
              <input type="number" step="any" bind:value={optForestAxisRangeMin} placeholder="auto" />
            </label>
            <label class="editor-field">
              <span>Axis max</span>
              <input type="number" step="any" bind:value={optForestAxisRangeMax} placeholder="auto" />
            </label>
          </div>
          <label class="editor-field">
            <span>Axis ticks</span>
            <input
              type="text"
              bind:value={optForestAxisTicks}
              placeholder="auto, or e.g. 0.5, 1, 2"
            />
          </label>
          <div class="check-row">
            <label class="editor-check">
              <input type="checkbox" bind:checked={optForestShowAxis} />
              <span>Show axis</span>
            </label>
            <label class="editor-check">
              <input type="checkbox" bind:checked={optForestAxisGridlines} />
              <span>Gridlines</span>
            </label>
          </div>
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

        <!-- ─ Multi-effect viz editor ─────────────────────────────── -->
        <!-- viz_bar / viz_boxplot / viz_violin columns carry a list of
             effects. Each row is one bar / box / violin in the cell.
             Full CRUD: add, remove, reorder, edit per-effect fields. -->
        {#if selectedType === "viz_bar" || selectedType === "viz_boxplot" || selectedType === "viz_violin"}
          {#if selectedType === "viz_boxplot"}
            <div class="slot-row">
              <span class="slot-label">Data shape</span>
              <select
                class="slot-select"
                value={vizBoxplotMode}
                onchange={(e) => (vizBoxplotMode = (e.currentTarget as HTMLSelectElement).value as "array" | "stats")}
              >
                <option value="array">Array column (raw values)</option>
                <option value="stats">Precomputed stats (min/Q1/median/Q3/max)</option>
              </select>
            </div>
          {/if}

          <div class="effects-section">
            <div class="effects-header">
              <span class="section-title">Effects ({vizEffects.length})</span>
              <button type="button" class="add-effect" onclick={addEffect}>+ Add effect</button>
            </div>

            {#each vizEffects as eff, idx (idx)}
              <div class="effect-card">
                <div class="effect-top">
                  <span class="effect-num">#{idx + 1}</span>
                  <input
                    type="text"
                    class="effect-label"
                    placeholder="Label (optional)"
                    value={eff.label ?? ""}
                    oninput={(e) => updateEffect(idx, { label: (e.currentTarget as HTMLInputElement).value })}
                  />
                  <div class="effect-actions">
                    <button
                      type="button"
                      class="effect-move"
                      disabled={idx === 0}
                      title="Move up"
                      aria-label="Move effect up"
                      onclick={() => moveEffect(idx, -1)}
                    >▲</button>
                    <button
                      type="button"
                      class="effect-move"
                      disabled={idx === vizEffects.length - 1}
                      title="Move down"
                      aria-label="Move effect down"
                      onclick={() => moveEffect(idx, 1)}
                    >▼</button>
                    <button
                      type="button"
                      class="effect-remove"
                      title="Remove effect"
                      aria-label="Remove effect"
                      onclick={() => removeEffect(idx)}
                    >×</button>
                  </div>
                </div>

                <!-- Data slot(s) per viz type -->
                {#if selectedType === "viz_bar"}
                  <div class="slot-row">
                    <span class="slot-label">Value</span>
                    <select
                      class="slot-select"
                      value={eff.value ?? ""}
                      onchange={(e) => updateEffect(idx, { value: (e.currentTarget as HTMLSelectElement).value })}
                    >
                      <option value="" disabled>Select a field…</option>
                      {#each available as f (f.field)}
                        <option value={f.field}>{f.label}</option>
                      {/each}
                    </select>
                  </div>
                {:else if selectedType === "viz_violin"}
                  <div class="slot-row">
                    <span class="slot-label">Data</span>
                    <select
                      class="slot-select"
                      value={eff.data ?? ""}
                      onchange={(e) => updateEffect(idx, { data: (e.currentTarget as HTMLSelectElement).value })}
                    >
                      <option value="" disabled>Select an array field…</option>
                      {#each available as f (f.field)}
                        <option value={f.field}>{f.label}</option>
                      {/each}
                    </select>
                  </div>
                {:else if selectedType === "viz_boxplot"}
                  {#if vizBoxplotMode === "array"}
                    <div class="slot-row">
                      <span class="slot-label">Data</span>
                      <select
                        class="slot-select"
                        value={eff.data ?? ""}
                        onchange={(e) => updateEffect(idx, { data: (e.currentTarget as HTMLSelectElement).value })}
                      >
                        <option value="" disabled>Select an array field…</option>
                        {#each available as f (f.field)}
                          <option value={f.field}>{f.label}</option>
                        {/each}
                      </select>
                    </div>
                  {:else}
                    {#each (["min","q1","median","q3","max","outliers"] as const) as k (k)}
                      <div class="slot-row">
                        <span class="slot-label">{k === "outliers" ? "Outliers (optional)" : k.toUpperCase()}</span>
                        <select
                          class="slot-select"
                          value={(eff as Record<string, string | undefined>)[k] ?? ""}
                          onchange={(e) => updateEffect(idx, { [k]: (e.currentTarget as HTMLSelectElement).value })}
                        >
                          <option value="">Select a field…</option>
                          {#each available as f (f.field)}
                            <option value={f.field}>{f.label}</option>
                          {/each}
                        </select>
                      </div>
                    {/each}
                  {/if}
                {/if}

                <!-- Visual overrides (color + opacity) common to all viz types -->
                <div class="effect-visuals">
                  <label class="effect-color">
                    <span>Color</span>
                    <input
                      type="color"
                      value={eff.color && /^#[0-9a-f]{6}$/i.test(eff.color) ? eff.color : "#3b82f6"}
                      oninput={(e) => updateEffect(idx, { color: (e.currentTarget as HTMLInputElement).value })}
                      aria-label="Effect color"
                    />
                    <input
                      type="text"
                      class="color-hex"
                      placeholder="auto"
                      value={eff.color ?? ""}
                      oninput={(e) => updateEffect(idx, { color: (e.currentTarget as HTMLInputElement).value })}
                    />
                  </label>
                  <label class="effect-opacity">
                    <span>Opacity</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      placeholder="auto"
                      value={eff.opacity ?? ""}
                      oninput={(e) => updateEffect(idx, { opacity: (e.currentTarget as HTMLInputElement).value })}
                    />
                  </label>
                </div>
              </div>
            {/each}

            {#if vizEffects.length === 0}
              <div class="effects-empty">No effects. Click "+ Add effect" to start.</div>
            {/if}
          </div>
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
  .check-row {
    display: flex;
    gap: 14px;
  }

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
    color: var(--wf-secondary, #64748b);
    font-weight: 500;
  }
  .header-input {
    flex: 1;
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 4px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-size: 12px;
  }
  .header-input:disabled {
    opacity: 0.45;
  }
  .align-seg {
    display: inline-flex;
    border: 1px solid var(--wf-border, #e2e8f0);
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
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
  }
  .align-seg button + button {
    border-left: 1px solid var(--wf-border, #e2e8f0);
  }
  .align-seg button.selected {
    background: color-mix(in srgb, var(--wf-primary, #3b82f6) 18%, var(--wf-bg, #ffffff));
    color: var(--wf-primary, #3b82f6);
  }
  .show-check {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 10.5px;
    color: var(--wf-secondary, #64748b);
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
    color: var(--wf-secondary, #64748b);
    font-weight: 500;
  }
  /* When editor-fields are arranged horizontally (e.g. Prefix | Suffix),
     drop the wide label column — the grid would eat the row width. */
  .editor-row .editor-field {
    grid-template-columns: auto 1fr;
  }
  .editor-row .editor-field > span {
    white-space: nowrap;
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
    color: var(--wf-secondary, #64748b);
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
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 4px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-size: 12px;
    font-family: inherit;
  }

  /* ─ Multi-effect editor ────────────────────────────────────────── */
  .effects-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--wf-border, #e2e8f0);
    padding-top: 8px;
  }
  .effects-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--wf-secondary, #64748b);
  }
  .add-effect {
    padding: 2px 8px;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 20%, var(--wf-border, #e2e8f0));
    border-radius: 4px;
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 8%, var(--wf-bg, #ffffff));
    color: var(--wf-primary, #2563eb);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .add-effect:hover {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 16%, var(--wf-bg, #ffffff));
  }

  .effect-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 6px;
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 3%, var(--wf-bg, #ffffff));
  }
  .effect-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .effect-num {
    font-size: 10px;
    font-weight: 600;
    color: var(--wf-secondary, #64748b);
    font-variant-numeric: tabular-nums;
    min-width: 18px;
  }
  .effect-label {
    flex: 1;
    min-width: 0;
    padding: 2px 6px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 4px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-size: 11px;
    font-family: inherit;
  }
  .effect-actions {
    display: inline-flex;
    gap: 2px;
  }
  .effect-actions button {
    width: 20px;
    height: 20px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 3px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-secondary, #64748b);
    font-size: 10px;
    cursor: pointer;
    font-family: inherit;
  }
  .effect-actions button:hover:not(:disabled) {
    color: var(--wf-primary, #2563eb);
    border-color: color-mix(in srgb, var(--wf-primary, #2563eb) 40%, var(--wf-border, #e2e8f0));
  }
  .effect-actions button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .effect-remove {
    color: #dc2626 !important;
    font-size: 14px !important;
    font-weight: 600;
    line-height: 1;
  }
  .effect-remove:hover:not(:disabled) {
    background: rgba(220, 38, 38, 0.08) !important;
    border-color: #dc2626 !important;
  }

  .effect-visuals {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .effect-color,
  .effect-opacity {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--wf-secondary, #64748b);
  }
  .effect-color input[type="color"] {
    width: 22px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 3px;
    cursor: pointer;
    background: var(--wf-bg, #ffffff);
  }
  .color-hex {
    width: 70px;
    padding: 2px 4px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 3px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
  }
  .effect-opacity input[type="number"] {
    width: 52px;
    padding: 2px 4px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 3px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-size: 10px;
    font-family: inherit;
  }

  .effects-empty {
    padding: 10px;
    text-align: center;
    border: 1px dashed var(--wf-border, #e2e8f0);
    border-radius: 6px;
    color: var(--wf-secondary, #64748b);
    font-size: 11px;
    font-style: italic;
  }
</style>

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
  import {
    getColumnSchema,
    type EditorState,
    type FieldDescriptor,
    type VizEffectRow,
  } from "$lib/column-editor-schema";
  // Side-effect import: registers all built-in schemas at module load.
  import { COMMON_FIELDS } from "$lib/column-editor-schema-builtins";
  import EditorSection from "./ColumnEditor/EditorSection.svelte";
  import SchemaField from "./ColumnEditor/SchemaField.svelte";
  import FieldPicker from "./ColumnEditor/FieldPicker.svelte";
  import VizEffectsEditor from "./ColumnEditor/effects/VizEffectsEditor.svelte";

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

  // Selected column type — drives schema lookup and the editor body.
  let selectedType = $state<ColumnType>("numeric");

  // ─ Multi-effect viz editor state ──────────────────────────────────────
  // viz_bar / viz_boxplot / viz_violin columns render a list of effects
  // (each effect = one bar / box / violin in the cell). Stored as plain
  // records and converted to strongly-typed VizBarEffect / VizBoxplotEffect /
  // VizViolinEffect on commit. The schema's customRenderer === "viz-effects"
  // discriminator drives whether VizEffectsEditor renders.
  let vizEffects = $state<VizEffectRow[]>([]);
  // viz_boxplot has two data modes: "array" uses a single `data` column;
  // "stats" uses the five precomputed stats columns.
  let vizBoxplotMode = $state<"array" | "stats">("array");

  let popoverEl: HTMLDivElement | null = $state(null);
  let resolvedLeft = $state(0);
  let resolvedTop = $state(0);
  let resolvedMaxH = $state<number | null>(null);

  // ─ Schema-driven editor state ─────────────────────────────────────────
  // For column types with a registered schema in column-editor-schema-builtins,
  // all option values live on this single object instead of being scattered
  // across `opt*` $state vars. As types migrate, their entries here grow and
  // the legacy vars + {#if} branches shrink. Once every type has a schema,
  // the legacy state model goes away.
  let editorState = $state<EditorState>({
    type: "numeric",
    slots: {},
    spec: {},
    options: {},
  });

  function inferAlignForType(t: ColumnType): "left" | "center" | "right" {
    if (t === "numeric" || t === "pvalue") return "right";
    if (
      t === "forest" || t === "bar" || t === "viz_bar" ||
      t === "viz_boxplot" || t === "viz_violin" || t === "sparkline"
    ) return "center";
    return "left";
  }

  function readPath(state: EditorState, path: readonly string[]): unknown {
    if (path[0] === "spec") {
      return (state.spec as Record<string, unknown>)[path[1]];
    }
    if (path[0] === "options") {
      const opts = state.options as Record<string, unknown>;
      if (path.length === 2) return opts[path[1]];
      const bucket = (opts[path[1]] as Record<string, unknown> | undefined) ?? {};
      return bucket[path[2]];
    }
    return undefined;
  }

  // Lower-level write used inside buildSpecFromSchema: walks the path into
  // an arbitrary options-shaped record. Mirrors writePath() but doesn't
  // discriminate "spec" vs "options" — the caller has already chosen.
  function writePathInto(
    target: Record<string, unknown>,
    path: readonly string[],
    value: unknown,
  ): void {
    if (path[0] !== "options") return;
    if (path.length === 2) {
      target[path[1]] = value;
      return;
    }
    const bucket = (target[path[1]] as Record<string, unknown> | undefined) ?? {};
    bucket[path[2]] = value;
    target[path[1]] = bucket;
  }

  function writePath(state: EditorState, path: readonly string[], value: unknown): void {
    if (path[0] === "spec") {
      (state.spec as Record<string, unknown>)[path[1]] = value;
      return;
    }
    if (path[0] === "options") {
      const opts = state.options as Record<string, unknown>;
      if (path.length === 2) {
        if (value === undefined) delete opts[path[1]];
        else opts[path[1]] = value;
        return;
      }
      const typeKey = path[1];
      const fieldKey = path[2];
      const bucket =
        (opts[typeKey] as Record<string, unknown> | undefined) ?? {};
      if (value === undefined) {
        delete bucket[fieldKey];
      } else {
        bucket[fieldKey] = value;
      }
      if (Object.keys(bucket).length === 0) delete opts[typeKey];
      else opts[typeKey] = bucket;
    }
  }

  function freshEditorStateForInsert(
    type: ColumnType,
    schema: ReturnType<typeof getColumnSchema>,
  ): EditorState {
    const state: EditorState = {
      type,
      slots: {},
      spec: {
        align: inferAlignForType(type),
        headerAlign: null,
        showHeader: true,
        sortable: true,
      },
      options: {},
    };
    if (schema) {
      for (const d of [...COMMON_FIELDS, ...schema.fields]) {
        if (d.defaultOnInsert !== undefined) {
          writePath(state, d.path, d.defaultOnInsert);
        }
      }
    }
    return state;
  }

  function hydrateEditorStateFromExisting(ex: ColumnSpec): EditorState {
    return {
      type: ex.type,
      slots: slotsFromExistingSpec(ex),
      spec: {
        header: ex.header,
        align: ex.align,
        headerAlign: ex.headerAlign ?? null,
        showHeader: resolveShowHeader(ex.showHeader, ex.header),
        wrap: ex.wrap,
        sortable: ex.sortable,
      },
      options: structuredClone(ex.options ?? {}) as EditorState["options"],
    };
  }

  // Initialize editor state from target (configure-existing or insert).
  $effect(() => {
    if (!target) return;
    const isViz = (t: ColumnType) =>
      t === "viz_bar" || t === "viz_boxplot" || t === "viz_violin";
    if (target.mode === "configure" && target.existing) {
      const ex = target.existing;
      selectedType = ex.type;
      editorState = hydrateEditorStateFromExisting(ex);
      vizEffects = [];
      vizBoxplotMode = "array";
      if (isViz(ex.type)) hydrateVizEffectsFromExisting(ex);
    } else {
      selectedType = target.type ?? "text";
      const schema = getColumnSchema(selectedType);
      editorState = freshEditorStateForInsert(selectedType, schema);
      vizEffects = isViz(selectedType) ? [newEffect()] : [];
      vizBoxplotMode = "array";
      if (target.seedOptions) {
        // Apply preset options (e.g. Integer → decimals=0) on top of the
        // schema's defaultOnInsert values.
        for (const [bucketKey, bucket] of Object.entries(target.seedOptions)) {
          if (bucket && typeof bucket === "object") {
            for (const [k, v] of Object.entries(bucket as Record<string, unknown>)) {
              writePath(editorState, ["options", bucketKey, k], v);
            }
          }
        }
      }
    }
  });

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
  // All non-viz types are now schema-driven; this hook is a no-op kept around
  // until the viz_* migration lets us delete the legacy hydrate path entirely.
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

  // The schema for the currently-selected type, or undefined for legacy
  // types still rendered through the {#if selectedType === ...} ladder.
  const currentSchema = $derived(getColumnSchema(selectedType));

  // Visible field descriptors composed from COMMON_FIELDS + schema.fields.
  // Filtered through `visibleWhen` if present.
  const visibleDescriptors = $derived.by<FieldDescriptor[]>(() => {
    if (!currentSchema) return [];
    const all = [...COMMON_FIELDS, ...currentSchema.fields];
    return all.filter((d) => !d.visibleWhen || d.visibleWhen(editorState));
  });

  // Group descriptors by section for the EditorSection blocks.
  const fieldsBySection = $derived.by(() => {
    const data: FieldDescriptor[] = [];
    const format: FieldDescriptor[] = [];
    const advanced: FieldDescriptor[] = [];
    for (const d of visibleDescriptors) {
      (d.section === "data" ? data : d.section === "advanced" ? advanced : format).push(d);
    }
    return { data, format, advanced };
  });

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
    // Schema-driven types: required slots live on editorState.slots.
    if (currentSchema) {
      // Viz custom-renderer types validate effects, not slots.
      if (currentSchema.customRenderer === "viz-effects") {
        if (vizEffects.length === 0) return false;
        if (selectedType === "viz_bar") {
          return vizEffects.every((e) => !!e.value);
        }
        if (selectedType === "viz_boxplot") {
          if (vizBoxplotMode === "array") {
            return vizEffects.every((e) => !!e.data);
          }
          return vizEffects.every(
            (e) => !!e.min && !!e.q1 && !!e.median && !!e.q3 && !!e.max,
          );
        }
        if (selectedType === "viz_violin") {
          return vizEffects.every((e) => !!e.data);
        }
        return true;
      }
      for (const s of currentSchema.slots) {
        if (s.required && !editorState.slots[s.key]) return false;
      }
      return true;
    }
    return false;
  });

  // When the primary slot changes, auto-pair the others (unless the user has
  // already set them to a non-empty value), and seed editorState.spec.header
  // from the primary field label when the user hasn't typed one.
  function onSchemaPrimarySlotChange(slotKey: string, value: string) {
    if (!currentDef) return;
    const paired = autoPairSlots(currentDef, slotKey, value, available);
    const nextSlots = { ...editorState.slots, [slotKey]: value };
    for (const [k, v] of Object.entries(paired)) {
      if (k === slotKey) continue;
      if (!nextSlots[k]) nextSlots[k] = v;
    }
    editorState.slots = nextSlots;
    if (!editorState.spec.header) {
      const fld = available.find((f) => f.field === value);
      editorState.spec.header = fld?.label ?? value;
    }
  }

  // Build a ColumnSpec out of schema-driven editor state. Mirrors the
  // existing legacy buildSpec() in shape (id minting, alignment defaults,
  // header fallback) but reads from editorState instead of opt* vars.
  function buildSpecFromSchema(): ColumnSpec {
    const schema = currentSchema!;
    const primaryKey = schema.slots[0]?.key ?? "value";
    // Viz custom-renderer types have empty slots; their identity comes
    // from the first effect's primary data binding.
    const isVizCustom = schema.customRenderer === "viz-effects";
    const vizFirstField = isVizCustom
      ? (vizEffects[0]?.value ?? vizEffects[0]?.data ?? vizEffects[0]?.median ?? "")
      : "";
    const primaryField = isVizCustom
      ? vizFirstField
      : (editorState.slots[primaryKey] ?? "");
    const proposedId = primaryField ? `${editorState.type}_${primaryField}` : editorState.type;
    const baseId =
      target?.mode === "configure" && target.existing
        ? target.existing.id
        : proposedId;

    // Non-primary slot values write into options.<type>.<slotKey> by default.
    // Schemas can override per-slot via `slotPaths` (e.g. range: min →
    // ["options", "range", "minField"]; custom: events bucket).
    const optionsCopy: Record<string, unknown> =
      structuredClone(editorState.options) as Record<string, unknown>;
    for (const slot of schema.slots.slice(1)) {
      const v = editorState.slots[slot.key];
      if (!v) continue;
      const path =
        schema.slotPaths?.[slot.key] ?? ["options", editorState.type, slot.key];
      writePathInto(optionsCopy, path, v);
    }
    // Also honor slotPaths for the primary slot when set, so custom (events
    // bucket) gets options.events.eventsField populated alongside spec.field.
    if (schema.slotPaths?.[primaryKey] && primaryField) {
      writePathInto(optionsCopy, schema.slotPaths[primaryKey], primaryField);
    }

    // Viz custom-renderer types: assemble the effects bundle into the
    // appropriate options bucket. Mirrors the legacy buildSpec viz_* cases.
    if (isVizCustom) {
      if (editorState.type === "viz_bar") {
        const effects = vizEffects
          .filter((e) => e.value)
          .map((e) => {
            const out: Record<string, unknown> = { value: e.value };
            if (e.label) out.label = e.label;
            if (e.color) out.color = e.color;
            if (e.opacity && Number.isFinite(Number(e.opacity))) {
              out.opacity = Number(e.opacity);
            }
            return out;
          });
        optionsCopy.bar = { type: "bar", effects };
      } else if (editorState.type === "viz_boxplot") {
        const effects = vizEffects.map((e) => {
          const out: Record<string, unknown> = {};
          if (vizBoxplotMode === "array") {
            if (e.data) out.data = e.data;
          } else {
            if (e.min) out.min = e.min;
            if (e.q1) out.q1 = e.q1;
            if (e.median) out.median = e.median;
            if (e.q3) out.q3 = e.q3;
            if (e.max) out.max = e.max;
            if (e.outliers) out.outliers = e.outliers;
          }
          if (e.label) out.label = e.label;
          if (e.color) out.color = e.color;
          if (e.opacity && Number.isFinite(Number(e.opacity))) {
            out.opacity = Number(e.opacity);
          }
          return out;
        });
        optionsCopy.boxplot = { type: "boxplot", effects };
      } else if (editorState.type === "viz_violin") {
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
        optionsCopy.violin = { type: "violin", effects };
      }
    }
    for (const k of Object.keys(optionsCopy)) {
      const v = optionsCopy[k];
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v as Record<string, unknown>).length === 0
      ) {
        delete optionsCopy[k];
      }
    }

    const align =
      (editorState.spec.align as "left" | "center" | "right" | undefined) ??
      inferAlignForType(editorState.type);
    const spec: ColumnSpec = {
      id: baseId,
      header: (editorState.spec.header as string | undefined) || primaryField,
      field: primaryField,
      type: editorState.type,
      align,
      headerAlign:
        (editorState.spec.headerAlign as "left" | "center" | "right" | null | undefined) ??
        null,
      sortable: editorState.spec.sortable ?? true,
      isGroup: false,
      showHeader: editorState.spec.showHeader ?? true,
    };
    if (editorState.spec.wrap !== undefined) spec.wrap = editorState.spec.wrap;
    if (Object.keys(optionsCopy).length > 0) {
      spec.options = optionsCopy as ColumnSpec["options"];
    }
    return spec;
  }

  function commit() {
    if (!target || !canCommit || !currentSchema) return;
    const spec = buildSpecFromSchema();
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

    <!-- Schema-driven body: renders types with a registered schema in
         column-editor-schema-builtins.ts. Migrates the {#if selectedType
         === ...} ladder one type at a time. -->
    {#if currentSchema}
      <div class="editor-body">
        <!-- Data: slot field-pickers. -->
        <EditorSection title="Data" empty={currentSchema.slots.length === 0 && fieldsBySection.data.length === 0}>
          {#each currentSchema.slots as slot, i (slot.key)}
            {@const choices = slotChoices[slot.key] ?? []}
            <FieldPicker
              label={slot.label}
              value={editorState.slots[slot.key] ?? ""}
              available={choices}
              suffix={slot.required ? undefined : "optional"}
              onchange={(v) => {
                if (i === 0) onSchemaPrimarySlotChange(slot.key, v);
                else editorState.slots = { ...editorState.slots, [slot.key]: v };
              }}
            />
          {/each}
          {#each fieldsBySection.data as d (d.key)}
            <SchemaField
              descriptor={d}
              value={readPath(editorState, d.path)}
              {available}
              onchange={(v) => writePath(editorState, d.path, v)}
            />
          {/each}
        </EditorSection>

        <EditorSection title="Format" empty={fieldsBySection.format.length === 0}>
          {#each fieldsBySection.format as d (d.key)}
            <SchemaField
              descriptor={d}
              value={readPath(editorState, d.path)}
              {available}
              onchange={(v) => writePath(editorState, d.path, v)}
            />
          {/each}
        </EditorSection>

        <EditorSection
          title="Advanced"
          defaultOpen={false}
          empty={fieldsBySection.advanced.length === 0}
        >
          {#each fieldsBySection.advanced as d (d.key)}
            <SchemaField
              descriptor={d}
              value={readPath(editorState, d.path)}
              {available}
              onchange={(v) => writePath(editorState, d.path, v)}
            />
          {/each}
        </EditorSection>

        {#if currentSchema.customRenderer === "viz-effects"}
          <VizEffectsEditor
            type={selectedType}
            effects={vizEffects}
            boxplotMode={vizBoxplotMode}
            {available}
            onAdd={addEffect}
            onRemove={removeEffect}
            onMove={moveEffect}
            onUpdate={updateEffect}
            onBoxplotModeChange={(m) => (vizBoxplotMode = m)}
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
  .editor-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
</style>

<!--
  ColumnEditorV2 — the new schema-driven column editor.

  Anatomy (top-to-bottom):

    ┌─────────────────────────────────────────────────────┐
    │  ▦ glyph    NUMERIC COLUMN                       ×  │   header
    ├─────────────────────────────────────────────────────┤
    │  ▤ DATA                                             │   slot pickers
    │     # Value     [estimate ▾]                        │
    ├─────────────────────────────────────────────────────┤
    │  Ⓗ HEADER & LAYOUT                                 │
    │     Header    [Estimate          ]                  │
    │     Align     [L|C|R]   ●                           │
    │     Width     [▰▰▰▰▰▰▰▰▰▰] 120 px                  │
    │     Sortable  [off|on]                              │
    ├─────────────────────────────────────────────────────┤
    │  ▸ # Numeric options                       ● 2      │   leaf-first accordion
    │  ▸ Aa Text options                                  │   ↑ schema cascade
    │  ▸ Base options                                     │   ↓ base last
    └─────────────────────────────────────────────────────┘

  Decisions:
  - Leaf-first schema cascade (opposite of v1's general-first). The
    user's UX intent: the most-specific options for the column you're
    editing read first; structural/universal ones (BASE) are at the
    bottom and usually folded.
  - DATA and HEADER & LAYOUT are always-open Sections (not Accordions).
    They're the "above the fold" controls.
  - Schema cascade is Accordions, all closed by default except the
    most-specific (= the schema being edited).
  - Override-pinned dot lights up for any value diverging from default
    or from null. Clicking the dot resets to default.
  - Auto-commits on every change via `oncommit(updatedColumn)`.

  This is the working flagship. Splitting into smaller subcomponents
  (DataSection, HeaderLayoutSection, SchemaCascade) is a refactor for
  later — when boundaries are forced by reuse, not speculation.
-->
<script lang="ts">
  import type { ColumnSchema, OptionSpec } from "../../schema/types";
  import type { AvailableField, ColumnSpec } from "../../types";
  import { resolveSchema } from "../../schema/resolve";
  import { schemaGlyph, slotGlyphFor } from "../../schema/glyph-utils";
  import { SCHEMA_REGISTRY } from "../../schema/columns";

  import Pill   from "../primitives/v2/Pill.svelte";
  import Knob   from "../primitives/v2/Knob.svelte";
  import Field  from "../primitives/v2/Field.svelte";
  import Section   from "../primitives/v2/Section.svelte";
  import Accordion from "../primitives/v2/Accordion.svelte";
  import Picker from "../primitives/v2/Picker.svelte";
  import Swatch from "../primitives/v2/Swatch.svelte";
  import Mode   from "../primitives/v2/Mode.svelte";
  import VariantPicker from "../primitives/v2/VariantPicker.svelte";
  import ColumnPreview from "../primitives/v2/ColumnPreview.svelte";
  import TextField from "../ui/TextField.svelte";
  import type { PickerItem, ThemeSwatch, MappedMode } from "../primitives/v2/types";

  interface Props {
    /** Schema for the column being edited. */
    schema: ColumnSchema;
    /** Current column spec (a partial of ColumnSpec is fine for new columns). */
    column: Partial<ColumnSpec>;
    /** Available data fields for slot + field-control pickers. */
    available: AvailableField[];
    /** Optional theme-anchored swatches for Swatch controls. */
    swatches?: ThemeSwatch[];
    /** Called with the updated column on every change. Caller decides
     *  whether to commit immediately (live edit) or buffer (save button). */
    oncommit?: (next: Partial<ColumnSpec>) => void;
    /** Close button handler. */
    onclose?: () => void;
    /** Explicit save / insert handler. When provided, renders a
     *  primary button in the editor masthead alongside the close X.
     *  Label is "Save" by default; pass `saveLabel` for "Insert". */
    onsave?: () => void;
    /** Label for the save button. Defaults to "Save". */
    saveLabel?: string;
  }

  let {
    schema,
    column = $bindable(),
    available,
    swatches = [],
    oncommit,
    onclose,
    onsave,
    saveLabel = "Save",
  }: Props = $props();

  // ── Resolved schema cascade ─────────────────────────────────────
  // resolveSchema returns BASE-first → leaf-last; we render in that
  // order. Base sits immediately after the Data section (most general
  // options first — header text, align, width, sortable — since they
  // apply uniformly to every column type and most authors edit them).
  // Type-specific accordions land below, ending at the leaf schema.
  const cascade = $derived(resolveSchema(schema));

  // Single-open accordion: only one cascade section is expanded at a
  // time. Initial open is the LEAF (cascade[last]) so insert flows land
  // on the type-specific knobs without an extra click. Users can swap
  // to Base via one click — but if they wanted Base by default they'd
  // also have been one click away under the multi-open behavior.
  let openAccordionKey = $state<string | null>(null);
  $effect(() => {
    // Initialize once the cascade resolves; don't override user toggles.
    if (openAccordionKey === null && cascade.length > 0) {
      openAccordionKey = cascade[cascade.length - 1].key;
    }
  });
  function toggleAccordion(key: string, next: boolean) {
    openAccordionKey = next ? key : null;
  }

  // Effective option list with optionOverrides applied — keyed by
  // option.key; tracks which cascade layer the option originated in.
  const effective = $derived.by(() => {
    const out = new Map<string, { layerKey: string; opt: OptionSpec }>();
    for (const s of cascade.slice().reverse()) {           // most-general first
      for (const opt of s.options) {
        out.set(opt.key, { layerKey: s.key, opt: { ...opt } });
      }
    }
    // optionOverrides — most-specific schema wins, so iterate same order.
    for (const s of cascade.slice().reverse()) {
      if (!s.optionOverrides) continue;
      for (const [k, v] of Object.entries(s.optionOverrides)) {
        const cur = out.get(k);
        if (cur) cur.opt = { ...cur.opt, default: v as never };
      }
    }
    // Apply suppressedOptions from the leaf schema (and any
    // intermediate) — these get removed entirely.
    for (const s of cascade) {
      if (!s.suppressedOptions) continue;
      for (const k of s.suppressedOptions) out.delete(k);
    }
    return out;
  });

  function optionsFor(layerKey: string): OptionSpec[] {
    const out: OptionSpec[] = [];
    for (const { layerKey: lk, opt } of effective.values()) {
      if (lk === layerKey) out.push(opt);
    }
    return out;
  }

  // ── Bucket helpers — wire-shape addressing ──────────────────────
  // OptionSpec.at determines where the value lives on the wire:
  //   "fixed" → column[key]                  (header, align, width, …)
  //   "top"   → column.options[key]          (legacy: naText, …)
  //   default → column.options[bucket][key]
  const BUCKET = $derived(schema.bucket);

  function readValue(opt: OptionSpec): unknown {
    const c = column as Record<string, unknown>;
    const o = (c.options ?? {}) as Record<string, unknown>;
    if (opt.at === "fixed") return c[opt.key];
    if (opt.at === "top")   return o[opt.key];
    if (!BUCKET) return undefined;
    const b = (o[BUCKET] ?? {}) as Record<string, unknown>;
    return b[opt.key];
  }
  function writeValue(opt: OptionSpec, v: unknown): Partial<ColumnSpec> {
    const next: Record<string, unknown> = { ...(column as Record<string, unknown>) };
    next.options = { ...((column as Record<string, unknown>).options ?? {}) as Record<string, unknown> };
    if (opt.at === "fixed") {
      next[opt.key] = v;
    } else if (opt.at === "top") {
      (next.options as Record<string, unknown>)[opt.key] = v;
    } else if (BUCKET) {
      const b = { ...((next.options as Record<string, unknown>)[BUCKET] ?? {}) as Record<string, unknown> };
      b[opt.key] = v;
      (next.options as Record<string, unknown>)[BUCKET] = b;
    }
    return next as Partial<ColumnSpec>;
  }

  /** True when the value differs from the schema default. */
  function isPinned(opt: OptionSpec): boolean {
    const v = readValue(opt);
    if (v === undefined || v === null) return false;
    return v !== opt.default;
  }
  function pinCount(layerKey: string): number {
    let n = 0;
    for (const opt of optionsFor(layerKey)) if (isPinned(opt)) n++;
    return n;
  }

  function commit(opt: OptionSpec, v: unknown) {
    const next = writeValue(opt, v);
    column = next;
    oncommit?.(next);
  }
  function reset(opt: OptionSpec) {
    commit(opt, opt.default);
  }

  function readVariant(layer: ColumnSchema): string | null {
    if (!layer.bucket) return null;
    const opts = (column.options ?? {}) as Record<string, Record<string, unknown>>;
    const b = opts[layer.bucket] ?? {};
    return (b.variant as string | undefined) ?? null;
  }
  function writeVariant(layer: ColumnSchema, id: string) {
    if (!layer.bucket) return;
    const next: Record<string, unknown> = { ...(column as Record<string, unknown>) };
    next.options = { ...((column as Record<string, unknown>).options ?? {}) as Record<string, unknown> };
    const b = { ...(((next.options as Record<string, unknown>)[layer.bucket] ?? {}) as Record<string, unknown>) };
    b.variant = id;
    (next.options as Record<string, unknown>)[layer.bucket] = b;
    column = next as Partial<ColumnSpec>;
    oncommit?.(next as Partial<ColumnSpec>);
  }

  // ── MappedValue (value-or-field) — local mode state per option ──
  // The wire format for these styling options is a tagged union; for
  // now we track the mode in-editor and write a simple shape (theme:
  // null/omit, static: literal, field: string field-ref). Conditions
  // are bound to a known condition name from banks (deferred).
  const mappedModes: Record<string, MappedMode> = $state({});
  function detectMode(v: unknown): MappedMode {
    if (v === null || v === undefined) return "theme";
    if (typeof v === "object" && v && "kind" in v) {
      const k = (v as { kind: string }).kind;
      if (k === "static" || k === "field" || k === "condition" || k === "theme") return k;
    }
    return "static";
  }
  function readMapped(opt: OptionSpec): unknown {
    return readValue(opt);
  }
  function writeMappedMode(opt: OptionSpec, m: MappedMode) {
    mappedModes[opt.key] = m;
    // Reset value to a sensible empty when mode changes; caller can
    // then fill in via the follow-up control.
    if (m === "theme") commit(opt, null);
    else if (m === "static") commit(opt, opt.default ?? null);
    else if (m === "field") commit(opt, { kind: "field", field: null });
    else if (m === "condition") commit(opt, { kind: "condition", name: null });
  }
  function writeMappedStatic(opt: OptionSpec, v: unknown) {
    commit(opt, v);
  }
  function writeMappedField(opt: OptionSpec, field: string | null) {
    commit(opt, field == null ? null : { kind: "field", field });
  }

  // ── Slot pickers ────────────────────────────────────────────────
  function slotItems(accepts: AvailableField["category"][]): PickerItem<string>[] {
    return available
      .filter((f) => accepts.length === 0 || accepts.includes(f.category))
      .map((f) => ({
        value: f.field,
        label: f.label,
        glyph: ((): never | undefined => {
          // Map field category to glyph token name (using same convention
          // as slotGlyphFor); we go through the FIELD_CATEGORY_GLYPH
          // table indirectly by computing slotGlyphFor with a single
          // category. Cheaper than re-importing the map here.
          const g = slotGlyphFor([f.category]);
          return g as never;
        })(),
        secondary: f.category,
      }));
  }
  // Slot ↔ wire mapping is per-schema. Most slots land in one of three
  // canonical locations; we probe them in priority order and remember
  // which one matched (for the symmetric write):
  //   1. column[slotKey]                       — text/numeric primary "field"
  //   2. column.options[bucket][slotKey]       — interval point/lower/upper
  //   3. column.options[bucket][slotKey + "Field"] — events eventsField/nField
  //
  // A future revision should put the wire-key on the SlotSpec itself;
  // until then this heuristic covers every concrete schema in tree.
  type SlotLoc = { kind: "top"; key: string }
               | { kind: "bucket"; bucket: string; key: string };

  function locateSlot(slotKey: string): SlotLoc {
    const c = column as Record<string, unknown>;
    const opts = (c.options ?? {}) as Record<string, Record<string, unknown>>;
    const b = BUCKET ? opts[BUCKET] : undefined;
    // Schema-declared wire key wins for fresh columns (no existing
    // value to introspect). Events: slot `events` → wireKey
    // `eventsField` → write to options.custom.eventsField. Without this,
    // `add events column` writes options.custom.events (wrong key) and
    // the renderer reads undefined.
    const slotDef = schema.slots?.find((s) => s.key === slotKey);
    const wire = slotDef?.wireKey ?? slotKey;

    if (typeof c[slotKey] === "string") return { kind: "top", key: slotKey };
    if (BUCKET && b && typeof b[wire] === "string") {
      return { kind: "bucket", bucket: BUCKET, key: wire };
    }
    // Back-compat: existing wire shapes that wrote the bare slot key
    // (legacy serializers, hand-written specs) — still locate them so
    // they show up in the editor and round-trip cleanly.
    if (BUCKET && b && typeof b[slotKey] === "string" && slotKey !== wire) {
      return { kind: "bucket", bucket: BUCKET, key: slotKey };
    }
    // No existing value — default to bucket-scoped slot using the wire
    // key (or fall back to top-level for slot-less buckets so the most
    // common case — col_text `field` — still works on fresh columns).
    if (BUCKET) return { kind: "bucket", bucket: BUCKET, key: wire };
    return { kind: "top", key: slotKey };
  }

  function readSlot(slotKey: string): string | null {
    const loc = locateSlot(slotKey);
    const c = column as Record<string, unknown>;
    if (loc.kind === "top") return (c[loc.key] as string | undefined) ?? null;
    const b = ((c.options ?? {}) as Record<string, Record<string, unknown>>)[loc.bucket];
    return (b?.[loc.key] as string | undefined) ?? null;
  }
  function writeSlot(slotKey: string, fieldName: string | null) {
    const loc = locateSlot(slotKey);
    const next = { ...(column as Record<string, unknown>) };
    if (loc.kind === "top") {
      next[loc.key] = fieldName ?? undefined;
    } else {
      const allOpts = { ...((next.options ?? {}) as Record<string, unknown>) };
      const bucket = { ...((allOpts[loc.bucket] ?? {}) as Record<string, unknown>) };
      bucket[loc.key] = fieldName ?? undefined;
      allOpts[loc.bucket] = bucket;
      next.options = allOpts as ColumnSpec["options"];
    }
    column = next as Partial<ColumnSpec>;
    oncommit?.(next as Partial<ColumnSpec>);
  }

  // ── Header bits ────────────────────────────────────────────────
  const headerGlyph = $derived(schemaGlyph(schema, SCHEMA_REGISTRY));
</script>

<div class="editor" data-tv-v2>
  <!-- Title row — uses the same Section masthead idiom as the settings
       panel (small-caps title, hairline-under, italic-i info mark) so
       the column-editor surface reads as a vertical slice of the same
       editorial system. The save button (when given) and close X
       hang together in the top-right of the masthead — they share
       the "exit this dialog" mental column rather than splitting
       across top+bottom. -->
  {#if onsave || onclose}
    <div class="editor-actions">
      {#if onsave}
        <button class="editor-save" type="button" onclick={onsave}>{saveLabel}</button>
      {/if}
      {#if onclose}
        <button class="editor-close" type="button" aria-label="Close" onclick={onclose}>×</button>
      {/if}
    </div>
  {/if}

  <div class="body">
    <Section glyph={headerGlyph} title={schema.label} hint={`${schema.label} column — edit its options below.`} />
    <!-- ── Live preview ──────────────────────────────────────────── -->
    <ColumnPreview {schema} {column} />

    <!-- ── DATA — slot pickers ──────────────────────────────────── -->
    {#if schema.slots && schema.slots.length > 0}
      <Section glyph="section.data" title="Data">
        {#each schema.slots as slot (slot.key)}
          {@const cur = readSlot(slot.key)}
          {@const items = slotItems(slot.accepts)}
          {@const sg = slotGlyphFor(slot.accepts)}
          <Field
            label={slot.label}
            glyph={sg}
            pinned={cur != null}
            onreset={() => writeSlot(slot.key, null)}
          >
            <Picker
              value={cur}
              items={items}
              placeholder={slot.required ? "Pick a field…" : "—"}
              ariaLabel={slot.label}
              onchange={(v) => writeSlot(slot.key, v)}
            />
          </Field>
        {/each}
      </Section>
    {/if}

    <!-- ── Schema cascade — base-first, leaf-last ──────────────────
         Base (header text, align, width, sortable) sits right after
         Data — covered the use-cases the legacy "Header & Layout"
         Section duplicated. Cascade is rendered base→leaf so the
         general options precede the specialized ones, and a true
         single-open accordion enforces "one section visible at a time"
         to limit vertical sprawl. -->
    {#each cascade as layer (layer.key)}
      {@const opts = optionsFor(layer.key)}
      {@const isLeaf = layer === schema}
      {@const hasVariants = isLeaf && layer.variants && layer.variants.length > 0}
      {#if opts.length > 0 || hasVariants}
        {@const layerGlyph = schemaGlyph(layer, SCHEMA_REGISTRY)}
        <Accordion
          title={`${layer.label} options`}
          glyph={layerGlyph}
          open={openAccordionKey === layer.key}
          onchange={(next) => toggleAccordion(layer.key, next)}
          count={pinCount(layer.key)}
        >
          {#if hasVariants}
            <Field label="Variant">
              <VariantPicker
                value={readVariant(layer)}
                variants={layer.variants!}
                onchange={(id) => writeVariant(layer, id)}
              />
            </Field>
          {/if}
          {#each opts as opt (opt.key)}
            {@const cur = readValue(opt)}
            {@const pinned = isPinned(opt)}
            <Field
              label={opt.label}
              hint={opt.hint}
              pinned={pinned}
              onreset={() => reset(opt)}
            >
              {#if opt.control === "toggle"}
                <Pill
                  value={(cur as boolean) ?? (opt.default as boolean) ?? false}
                  segments={[
                    { value: false, label: "off" },
                    { value: true,  label: "on" },
                  ]}
                  ariaLabel={opt.label}
                  onchange={(v) => commit(opt, v)}
                />
              {:else if opt.control === "segmented"}
                <Pill
                  value={(cur as string) ?? (opt.default as string)}
                  segments={(opt.segments as never) ?? []}
                  ariaLabel={opt.label}
                  onchange={(v) => commit(opt, v)}
                />
              {:else if opt.control === "number" || opt.control === "integer"}
                <Knob
                  value={(cur as number) ?? (opt.default as number) ?? null}
                  min={opt.min}
                  max={opt.max}
                  step={opt.step ?? (opt.control === "integer" ? 1 : undefined)}
                  integer={opt.control === "integer"}
                  track={opt.min != null && opt.max != null}
                  onchange={(v) => commit(opt, v)}
                />
              {:else if opt.control === "slider"}
                <Knob
                  value={(cur as number) ?? (opt.default as number) ?? null}
                  min={opt.min ?? 0}
                  max={opt.max ?? 100}
                  step={opt.step ?? 1}
                  track
                  onchange={(v) => commit(opt, v)}
                />
              {:else if opt.control === "color"}
                <Swatch
                  value={(cur as string | null) ?? (opt.default as string | null)}
                  {swatches}
                  onchange={(v) => commit(opt, v)}
                />
              {:else if opt.control === "field"}
                <Picker
                  value={(cur as string | null) ?? null}
                  items={slotItems(opt.accepts ?? [])}
                  placeholder="Pick a field…"
                  ariaLabel={opt.label}
                  onchange={(v) => commit(opt, v)}
                />
              {:else if opt.control === "value-or-field"}
                <!-- Composite: Mode pill + follow-up control. Mode is
                     detected from the current value's shape on first
                     render and tracked locally afterward. -->
                {@const mappedCur = readMapped(opt)}
                {@const m = mappedModes[opt.key] ?? detectMode(mappedCur)}
                <span class="mapped">
                  <Mode
                    value={m}
                    onchange={(next) => writeMappedMode(opt, next as MappedMode)}
                  />
                  {#if m === "static"}
                    {#if opt.valueControl === "color"}
                      <Swatch
                        value={(mappedCur as string | null) ?? null}
                        {swatches}
                        onchange={(v) => writeMappedStatic(opt, v)}
                      />
                    {:else if opt.valueControl === "toggle"}
                      <Pill
                        value={(mappedCur as boolean) ?? false}
                        segments={[
                          { value: false, label: "off" },
                          { value: true,  label: "on" },
                        ]}
                        ariaLabel={opt.label}
                        onchange={(v) => writeMappedStatic(opt, v)}
                      />
                    {:else if opt.valueControl === "number" || opt.valueControl === "integer"}
                      <Knob
                        value={(mappedCur as number) ?? null}
                        min={opt.min}
                        max={opt.max}
                        step={opt.step ?? (opt.valueControl === "integer" ? 1 : undefined)}
                        integer={opt.valueControl === "integer"}
                        onchange={(v) => writeMappedStatic(opt, v)}
                      />
                    {:else}
                      <TextField
                        label=""
                        value={String(mappedCur ?? "")}
                        oninput={(v) => writeMappedStatic(opt, v || null)}
                      />
                    {/if}
                  {:else if m === "field"}
                    <Picker
                      value={(mappedCur as { kind: string; field?: string } | null)?.field ?? null}
                      items={slotItems(opt.accepts ?? [])}
                      placeholder="Pick a field…"
                      ariaLabel={opt.label}
                      onchange={(v) => writeMappedField(opt, v)}
                    />
                  {:else if m === "condition"}
                    <span class="mapped-follow">(condition picker — TBD)</span>
                  {:else}
                    <span class="mapped-follow">inherits theme</span>
                  {/if}
                </span>
              {:else}
                <!-- Fallback: text input via shared TextField primitive
                     with label="" (skips the inner Field wrapper since
                     we're already inside one). Empty string commits
                     as null so the pinned-override gutter clears. -->
                <TextField
                  label=""
                  value={String(cur ?? opt.default ?? "")}
                  oninput={(v) => commit(opt, v || null)}
                />
              {/if}
            </Field>
          {/each}
        </Accordion>
      {/if}
    {/each}
  </div>
</div>

<style>
  /* Editor surface — flat, paper-on-paper. The previous design
     wrapped the editor in a card with paper-2 head, paper-2 foot,
     drop-shadow, and rounded corners. That read as "dialog" rather
     than "editorial column". Now: same paper layer as the host,
     hairlines only, masthead via <Section> like the settings panel.
     The popover shell still owns the spatial-detachment shadow; the
     editor body stays flat. */
  .editor {
    width: 400px;
    max-height: min(640px, calc(100vh - 24px));
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--v2-paper, #faf7f0);
    font: 13px/1.45 var(--v2-font-sans, system-ui, sans-serif);
    color: var(--v2-ink, #15140e);
    position: relative;
  }
  /* Top-right action cluster: [save] + [×]. Lives in absolute
     positioning above the masthead Section so it doesn't push the
     section header down. Save is the prominent primary button;
     the close X is a quiet ink-3 glyph. */
  .editor-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .editor-save {
    appearance: none;
    border: 0;
    padding: 4px 12px;
    border-radius: var(--v2-r-soft, 3px);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-body, 11.5px);
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: 0.08em;
    background: var(--v2-ink, #15140e);
    color: var(--v2-paper, #faf7f0);
    cursor: pointer;
    line-height: 1;
    transition: background var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .editor-save:hover { background: var(--v2-ink-2, #4a463c); }
  .editor-close {
    appearance: none;
    background: transparent;
    border: 0;
    width: 22px;
    height: 22px;
    border-radius: var(--v2-r-soft, 3px);
    color: var(--v2-ink-3, #8a8478);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .editor-close:hover {
    background: var(--v2-hover-tint, rgba(21, 20, 14, 0.05));
    color: var(--v2-ink, #15140e);
  }

  .body {
    padding: 0 14px 12px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    flex: 1 1 auto;
  }

  /* (Local .text-input retired — uses shared TextField primitive via
     label="" to skip the inner Field wrapper.) */

  .mapped {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .mapped-follow {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
    font-size: var(--v2-text-small, 10.5px);
  }

  /* (.variant-wrap retired — the variant picker is now a regular
     <Field label="Variant"> row inside the leaf accordion, sharing
     the spine with every other Field.) */
</style>

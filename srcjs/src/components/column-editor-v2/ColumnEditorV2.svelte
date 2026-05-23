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
  import { glyph as glyphChar } from "../../lib/ui-glyphs";

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
  }

  let {
    schema,
    column = $bindable(),
    available,
    swatches = [],
    oncommit,
    onclose,
  }: Props = $props();

  // ── Resolved schema cascade ─────────────────────────────────────
  // resolveSchema returns BASE-first → leaf-last; we render leaf-first.
  const cascade = $derived(resolveSchema(schema).slice().reverse());

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

  // ── Variants — recipe selector ──────────────────────────────────
  // Variants land at column.options[bucket].variant. We surface the
  // selector at the top of the leaf-most accordion's body (the schema
  // that owns the variants). If the same key is inherited up the
  // chain, the deepest-declaring layer wins.
  function variantOwner(): ColumnSchema | null {
    for (const layer of cascade) {
      if (layer.variants && layer.variants.length > 0) return layer;
    }
    return null;
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
  function readSlot(slotKey: string): string | null {
    const c = column as Record<string, unknown>;
    return ((c[`${slotKey}Col`] as string | undefined) ?? (c[slotKey] as string | undefined) ?? null);
  }
  function writeSlot(slotKey: string, fieldName: string | null) {
    // Most slots are exposed as `<slotKey>Col` in wire (e.g. `pointCol`,
    // `lowerCol`); the canonical primary slot is sometimes just `field`.
    // We mirror whichever key is present in the existing column; default
    // to `<slotKey>Col` for new columns.
    const wireKey =
      slotKey in (column as Record<string, unknown>)
        ? slotKey
        : `${slotKey}Col`;
    const next = { ...(column as Record<string, unknown>) };
    next[wireKey] = fieldName ?? undefined;
    column = next as Partial<ColumnSpec>;
    oncommit?.(next as Partial<ColumnSpec>);
  }

  // ── Section pin counts ─────────────────────────────────────────
  const FIXED_KEYS = ["header", "align", "width", "sortable", "headerAlign", "showHeader"];

  // ── Header bits ────────────────────────────────────────────────
  const headerGlyph = $derived(schemaGlyph(schema, SCHEMA_REGISTRY));
</script>

<div class="editor" data-tv-v2>
  <!-- ── Header ──────────────────────────────────────────────── -->
  <header class="head">
    <span class="head-glyph">{headerGlyph ? glyphChar(headerGlyph) : "◌"}</span>
    <span class="head-flag">{schema.label}</span>
    <span class="head-sep">column</span>
    {#if onclose}
      <button class="head-close" type="button" aria-label="Close" onclick={onclose}>×</button>
    {/if}
  </header>

  <div class="body">
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
            />
          </Field>
        {/each}
      </Section>
    {/if}

    <!-- ── HEADER & LAYOUT ─────────────────────────────────────── -->
    <Section glyph="section.header" title="Header & Layout">
      <!-- Header text -->
      <Field
        label="Header"
        pinned={(column.header ?? null) !== null && column.header !== undefined && column.header !== schema.label}
        onreset={() => { column = { ...column, header: undefined }; oncommit?.({ ...column, header: undefined }); }}
      >
        <input
          class="text-input"
          type="text"
          value={column.header ?? ""}
          placeholder={schema.label}
          oninput={(e) => {
            const v = (e.target as HTMLInputElement).value || undefined;
            column = { ...column, header: v };
            oncommit?.({ ...column, header: v });
          }}
        />
      </Field>

      <!-- Align -->
      <Field
        label="Align"
        glyph="align.center"
        tight
        pinned={!!column.align}
        onreset={() => { const { align: _drop, ...rest } = column; column = rest; oncommit?.(rest); }}
      >
        <Pill
          value={column.align ?? "left"}
          segments={[
            { value: "left",   glyph: "align.left",   title: "Left" },
            { value: "center", glyph: "align.center", title: "Center" },
            { value: "right",  glyph: "align.right",  title: "Right" },
          ]}
          ariaLabel="Align"
          onchange={(v) => { column = { ...column, align: v as "left" | "center" | "right" }; oncommit?.(column); }}
        />
      </Field>

      <!-- Width -->
      <Field
        label="Width"
        pinned={(column.width ?? null) !== null}
        onreset={() => { const { width: _drop, ...rest } = column; column = rest; oncommit?.(rest); }}
      >
        <Knob
          value={(column.width as number) ?? null}
          min={40}
          max={400}
          step={4}
          track
          suffix="px"
        />
      </Field>

      <!-- Sortable -->
      {#if schema.fixed?.sortable === undefined}
        <Field label="Sortable" glyph="sort.unsorted" tight>
          <Pill
            value={column.sortable ?? true}
            segments={[
              { value: false, label: "off" },
              { value: true,  label: "on" },
            ]}
            ariaLabel="Sortable"
            onchange={(v) => { column = { ...column, sortable: v as boolean }; oncommit?.(column); }}
          />
        </Field>
      {/if}
    </Section>

    <!-- ── Schema cascade — leaf-first ──────────────────────────── -->
    {#each cascade as layer, idx (layer.key)}
      {@const opts = optionsFor(layer.key)}
      {@const isLeaf = layer === schema}
      {@const hasVariants = isLeaf && layer.variants && layer.variants.length > 0}
      {#if opts.length > 0 || hasVariants}
        {@const layerGlyph = schemaGlyph(layer, SCHEMA_REGISTRY)}
        <Accordion
          title={`${layer.label} options`}
          glyph={layerGlyph}
          open={idx === 0}
          count={pinCount(layer.key)}
        >
          {#if hasVariants}
            <div class="variant-wrap">
              <div class="variant-flag">variants</div>
              <VariantPicker
                value={readVariant(layer)}
                variants={layer.variants!}
                onchange={(id) => writeVariant(layer, id)}
              />
            </div>
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
                />
              {:else if opt.control === "slider"}
                <Knob
                  value={(cur as number) ?? (opt.default as number) ?? null}
                  min={opt.min ?? 0}
                  max={opt.max ?? 100}
                  step={opt.step ?? 1}
                  track
                />
              {:else if opt.control === "color"}
                <Swatch
                  value={(cur as string | null) ?? (opt.default as string | null)}
                  {swatches}
                />
              {:else if opt.control === "field"}
                <Picker
                  value={(cur as string | null) ?? null}
                  items={slotItems(opt.accepts ?? [])}
                  placeholder="Pick a field…"
                  ariaLabel={opt.label}
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
                      />
                    {:else}
                      <input
                        class="text-input"
                        type="text"
                        value={String(mappedCur ?? "")}
                        oninput={(e) => writeMappedStatic(opt, (e.target as HTMLInputElement).value || null)}
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
                <!-- Fallback: text input -->
                <input
                  class="text-input"
                  type="text"
                  value={String(cur ?? opt.default ?? "")}
                  oninput={(e) => commit(opt, (e.target as HTMLInputElement).value || null)}
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
  .editor {
    width: 400px;
    background: var(--v2-paper, #faf7f0);
    border-radius: var(--v2-r-large, 6px);
    box-shadow:
      0 1px 0 var(--v2-rule, #d6d0c1),
      0 8px 28px rgba(21, 20, 14, 0.10),
      0 32px 80px rgba(21, 20, 14, 0.06);
    overflow: hidden;
    font: 13px/1.45 var(--v2-font-sans, system-ui, sans-serif);
    color: var(--v2-ink, #15140e);
  }

  /* ── Header ───────────────────────────────────────────────── */
  .head {
    display: grid;
    grid-template-columns: 22px 1fr auto auto;
    align-items: baseline;
    gap: 8px;
    padding: 12px 14px 10px;
    background: var(--v2-paper-2, #f3efe5);
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
  }
  .head-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 15px;
    line-height: 1;
    color: var(--v2-ink, #15140e);
    align-self: center;
  }
  .head-flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink, #15140e);
  }
  .head-sep {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-micro, 9.5px);
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink-3, #8a8478);
  }
  .head-close {
    appearance: none;
    background: transparent;
    border: 0;
    width: 22px;
    height: 22px;
    border-radius: 3px;
    color: var(--v2-ink-3, #8a8478);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .head-close:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }

  .body {
    padding: 0 14px 12px;
    display: flex;
    flex-direction: column;
  }

  /* ── Inline controls ─────────────────────────────────────── */
  .text-input {
    flex: 1;
    min-width: 0;
    height: var(--v2-control-h, 22px);
    padding: 0 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font: inherit;
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    outline: none;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .text-input:hover { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .text-input:focus { box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e); }
  .text-input::placeholder {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }

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

  /* ── Variant picker block ─────────────────────────────────── */
  .variant-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0 8px;
    border-bottom: 1px solid var(--v2-rule-soft, #e6e0d1);
    margin-bottom: 6px;
  }
  .variant-flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
  }
</style>

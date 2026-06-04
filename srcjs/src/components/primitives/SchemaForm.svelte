<!--
  SchemaForm — renders a column-schema-driven editor body. Walks the
  schema's inheritance chain and renders one AccordionSection per
  ancestor, one FieldRow per option, picking the primitive by
  `control` kind.

  Behavior contract:
  - Bindable `state: Record<string, unknown>` holds the in-flight
    editor values, keyed by option key. Initial state comes from the
    schema's effective defaults (caller is responsible for hydrating
    from an existing ColumnSpec when configuring).
  - Section order: most-general first (BASE), most-specific last.
    Matches topological resolution; the user's design wanted
    specific-first in the editor, but stacking general-at-top reads
    better when "Layout & header" is the truly-universal section that
    shrinks to a single collapsed line. We can flip this if needed.
  - Sections collapsed by default unless `defaultOpen: true` on the
    schema.

  This component is feature-flagged into the column editor in Phase 6.
-->
<script lang="ts">
  import type { ColumnSchema, OptionSpec } from "../../schema/types";
  import { resolveSchema } from "../../schema/resolve";
  import type { AvailableField } from "$types";

  import AccordionSection from "./AccordionSection.svelte";
  import FieldRow from "./FieldRow.svelte";
  import Toggle from "./Toggle.svelte";
  import Segmented from "./Segmented.svelte";
  import NumberInput from "./NumberInput.svelte";
  import TextInput from "./TextInput.svelte";
  import SliderValue from "./SliderValue.svelte";
  import ColorChip from "./ColorChip.svelte";
  import FieldSelect from "./FieldSelect.svelte";
  import MappedValue from "./MappedValue.svelte";
  import type { MappedState } from "./mapped-value";

  interface Props {
    schema: ColumnSchema;
    /** In-flight editor state, keyed by option key. Bindable. */
    state: Record<string, unknown>;
    /** Available data fields (drives field-control dropdowns). */
    available?: AvailableField[];
    /** Optional theme-anchored swatches for ColorChip options. */
    swatches?: string[];
  }

  let {
    schema,
    state = $bindable(),
    available = [],
    swatches,
  }: Props = $props();

  const resolved = $derived(resolveSchema(schema));

  // Apply optionOverrides (from any schema in the chain — most-specific
  // wins) on top of the layer's own option default. Yields the effective
  // OptionSpec the editor renders for that key.
  const effective = $derived.by(() => {
    const out = new Map<string, { layerKey: string; opt: OptionSpec }>();
    for (const s of resolved) {
      for (const opt of s.options) {
        out.set(opt.key, { layerKey: s.key, opt: { ...opt } });
      }
    }
    for (const s of resolved) {
      if (!s.optionOverrides) continue;
      for (const [k, v] of Object.entries(s.optionOverrides)) {
        const cur = out.get(k);
        if (cur) cur.opt = { ...cur.opt, default: v as never };
      }
    }
    return out;
  });

  /** Options belonging to a given layer key, in declaration order. */
  function optionsFor(layerKey: string): OptionSpec[] {
    const out: OptionSpec[] = [];
    for (const { layerKey: lk, opt } of effective.values()) {
      if (lk === layerKey) out.push(opt);
    }
    return out;
  }

  /** Number of options whose current state differs from default. */
  function overrideCount(layerKey: string): number {
    let n = 0;
    for (const opt of optionsFor(layerKey)) {
      const cur = state[opt.key];
      if (cur === undefined || cur === null) continue;
      if (cur !== opt.default) n++;
    }
    return n;
  }
</script>

<div class="schema-form">
  {#each resolved as layer (layer.key)}
    {@const opts = optionsFor(layer.key)}
    {#if opts.length > 0}
      <AccordionSection
        title={layer.label}
        open={layer.defaultOpen ?? false}
        overrideCount={overrideCount(layer.key)}
      >
        {#each opts as opt (opt.key)}
          <FieldRow label={opt.label} hint={opt.hint} forId={`opt-${opt.key}`}>
            {#if opt.control === "toggle"}
              <Toggle bind:value={state[opt.key] as boolean} ariaLabel={opt.label} />
            {:else if opt.control === "segmented"}
              <Segmented
                bind:value={state[opt.key] as never}
                segments={(opt.segments ?? []) as never}
                ariaLabel={opt.label}
              />
            {:else if opt.control === "number"}
              <NumberInput
                id={`opt-${opt.key}`}
                bind:value={state[opt.key] as number | null}
                min={opt.min}
                max={opt.max}
                step={opt.step}
                placeholder={opt.default == null ? "" : String(opt.default)}
              />
            {:else if opt.control === "integer"}
              <NumberInput
                id={`opt-${opt.key}`}
                bind:value={state[opt.key] as number | null}
                integer
                min={opt.min}
                max={opt.max}
                step={opt.step ?? 1}
                placeholder={opt.default == null ? "" : String(opt.default)}
              />
            {:else if opt.control === "slider"}
              <SliderValue
                id={`opt-${opt.key}`}
                bind:value={state[opt.key] as number}
                min={opt.min ?? 0}
                max={opt.max ?? 100}
                step={opt.step ?? 1}
              />
            {:else if opt.control === "color"}
              <ColorChip id={`opt-${opt.key}`} bind:value={state[opt.key] as string | null} {swatches} />
            {:else if opt.control === "field"}
              <FieldSelect
                id={`opt-${opt.key}`}
                bind:value={state[opt.key] as string | null}
                {available}
                accepts={opt.accepts}
              />
            {:else if opt.control === "value-or-field"}
              <MappedValue
                id={`opt-${opt.key}`}
                bind:value={state[opt.key] as MappedState<never>}
                valueControl={opt.valueControl ?? "text"}
                segments={(opt.segments ?? []) as never}
                {available}
                accepts={opt.accepts}
                {swatches}
              />
            {:else}
              <!-- text, select, custom — TextInput is a sensible fallback -->
              <TextInput
                id={`opt-${opt.key}`}
                bind:value={state[opt.key] as string | null}
                placeholder={opt.default == null ? "" : String(opt.default)}
              />
            {/if}
          </FieldRow>
        {/each}
      </AccordionSection>
    {/if}
  {/each}
</div>

<style>
  .schema-form {
    width: 320px;
    padding: 0 12px;
    background: var(--tv-surface-bg, #fff);
    color: var(--tv-text, #1f1f1f);
    font-family: inherit;
  }
</style>

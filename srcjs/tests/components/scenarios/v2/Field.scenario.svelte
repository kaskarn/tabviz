<!--
  v2 Field scenario — the layout row. Combines Field with Pill, Knob,
  and a plain text input slot to validate label/control alignment +
  override-dot gutter + hint.
-->
<script lang="ts">
  import Field from "../../../../src/components/primitives/v2/Field.svelte";
  import Pill  from "../../../../src/components/primitives/v2/Pill.svelte";
  import Knob  from "../../../../src/components/primitives/v2/Knob.svelte";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  type Align = "left" | "center" | "right";

  let sortable: boolean = $state(true);
  let align: Align       = $state("left");
  let width: number | null = $state(120);
  let decimals: number | null = $state(2);

  function logChange<T>(key: string, prev: T, next: T, kind: string) {
    if (prev !== next) {
      harnessState[key] = next;
      recordChange(key, prev, next, kind);
    }
  }

  $effect(() => { logChange("sortable", harnessState.sortable, sortable, "field"); });
  $effect(() => { logChange("align",    harnessState.align,    align,    "field"); });
  $effect(() => { logChange("width",    harnessState.width,    width,    "field"); });
  $effect(() => { logChange("decimals", harnessState.decimals, decimals, "field"); });

  // Pinned state: an option is "pinned" when it differs from a notional
  // default. Here we treat `decimals !== null && decimals !== 0` as
  // pinned, and provide a reset to demonstrate the reset-to-default UX.
  const decimalsPinned = $derived(decimals !== null && decimals !== 0);
</script>

<div class="sheet">
  <Field label="Sortable" glyph="sort.unsorted" tight>
    <Pill
      bind:value={sortable}
      segments={[
        { value: false, label: "off" },
        { value: true,  label: "on" },
      ]}
      ariaLabel="Sortable"
    />
  </Field>

  <Field label="Header align" glyph="align.center" tight hint="follows column align if unset">
    <Pill
      bind:value={align}
      segments={[
        { value: "left",   label: "L", glyph: "align.left" },
        { value: "center", label: "C", glyph: "align.center" },
        { value: "right",  label: "R", glyph: "align.right" },
      ]}
      ariaLabel="Header align"
    />
  </Field>

  <Field label="Width" glyph="action.dragger">
    <Knob bind:value={width} min={40} max={400} step={4} track suffix="px" />
  </Field>

  <Field
    label="Decimals"
    glyph="type.numeric"
    pinned={decimalsPinned}
    onreset={() => { decimals = 0; }}
    hint={decimalsPinned ? "click ● to reset" : "default"}
  >
    <Knob bind:value={decimals} min={0} max={6} step={1} pinned={decimalsPinned} />
  </Field>

  <Field label="A long-ish label that wraps if the column is narrow">
    <Knob bind:value={width} min={40} max={400} step={4} track suffix="px" />
  </Field>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 420px;
  }
</style>

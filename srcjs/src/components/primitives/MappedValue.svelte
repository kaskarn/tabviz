<!--
  MappedValue — composite control for styling options that can either
  hold a static value OR reference a data column (per-row mapped).
  Three modes:
    - off:    no override; theme/default applies
    - static: explicit value entered via the sub-control (Toggle,
              ColorChip, NumberInput, TextInput, …)
    - field:  reference to a data field; renderer reads per-row values

  Internal state is the discriminated form below. The schema option's
  `valueControl` picks which primitive renders the static sub-control.

  Wire-shape flattening (mapping this state to JSON for the spec)
  happens in Phase 3 when we lift styleMapping into schema options.
-->
<script lang="ts" generics="T extends string | number | boolean | null">
  import type { AvailableField, FieldCategory } from "$types";
  import type { ControlKind } from "../../schema/types";
  import type { MappedState } from "./mapped-value";

  import Toggle from "./Toggle.svelte";
  import NumberInput from "./NumberInput.svelte";
  import TextInput from "./TextInput.svelte";
  import ColorChip from "./ColorChip.svelte";
  import FieldSelect from "./FieldSelect.svelte";
  import Segmented from "./Segmented.svelte";

  interface Props {
    value: MappedState<T>;
    /** Sub-control for the static-value entry. */
    valueControl: ControlKind;
    available: AvailableField[];
    accepts?: FieldCategory[];
    swatches?: string[];
    /** For valueControl="segmented" or "select" — the enum values. */
    segments?: { value: T; label: string }[];
    id?: string;
  }

  let {
    value = $bindable(),
    valueControl,
    available,
    accepts,
    swatches,
    segments,
    id,
  }: Props = $props();

  const mode = $derived(value.mode);

  function setMode(next: "off" | "static" | "field") {
    if (next === value.mode) return;
    if (next === "off") value = { mode: "off" };
    else if (next === "static") value = { mode: "static", value: null as T };
    else value = { mode: "field", field: "" };
  }

  // Per-mode value bindings. We mediate through getter/setter pairs so
  // each sub-control sees a stable bindable target; the parent state
  // object stays immutable on its `mode` discriminant.
  let staticVal = $state<T | null>(null);
  let fieldVal  = $state<string | null>(null);

  $effect(() => {
    if (value.mode === "static") staticVal = value.value;
    else if (value.mode === "field") fieldVal = value.field;
  });

  $effect(() => {
    if (value.mode === "static" && staticVal !== value.value) {
      value = { mode: "static", value: staticVal as T };
    }
    if (value.mode === "field" && fieldVal !== value.field) {
      value = { mode: "field", field: fieldVal ?? "" };
    }
  });
</script>

<div class="mapped-value">
  <Segmented
    value={mode}
    onchange={setMode}
    segments={[
      { value: "off", label: "Default" },
      { value: "static", label: "Static" },
      { value: "field", label: "Mapped" },
    ]}
    ariaLabel="Override mode"
  />
  {#if mode === "static"}
    <div class="sub-ctl">
      {#if valueControl === "toggle"}
        <Toggle bind:value={staticVal as boolean} />
      {:else if valueControl === "color"}
        <ColorChip {id} bind:value={staticVal as string | null} {swatches} />
      {:else if valueControl === "number"}
        <NumberInput {id} bind:value={staticVal as number | null} />
      {:else if valueControl === "integer"}
        <NumberInput {id} integer bind:value={staticVal as number | null} />
      {:else if valueControl === "segmented" && segments}
        <Segmented bind:value={staticVal as never} segments={segments as never} ariaLabel="Static value" />
      {:else}
        <TextInput {id} bind:value={staticVal as string | null} />
      {/if}
    </div>
  {:else if mode === "field"}
    <div class="sub-ctl">
      <FieldSelect {id} bind:value={fieldVal} {available} {accepts} />
    </div>
  {/if}
</div>

<style>
  .mapped-value {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    flex-wrap: wrap;
  }
  .sub-ctl {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
</style>

<!--
  SegmentedField — settings-panel n-segment enum row. v2-skinned:
  composes Field + Pill. Caller API unchanged (`options` instead of
  `segments` is preserved for backward compat).
-->
<script lang="ts" generics="T extends string | number | boolean | null">
  import Field from "$components/primitives/v2/Field.svelte";
  import Pill from "$components/primitives/v2/Pill.svelte";

  interface Props {
    label: string;
    hint?: string;
    value: T;
    /** Options to display, in order. `label` is shown; `value` is what's emitted. */
    options: { label: string; value: T }[];
    onchange: (value: T) => void;
  }

  let { label, hint, value, options, onchange }: Props = $props();

  const segments = $derived(options.map((o) => ({ value: o.value, label: o.label })));
</script>

<div class="sf-row" data-tv-v2>
  <!-- `tight` previously sized the column to max-content so the Pill
       sat at its intrinsic width. That made Color rows (Swatch
       stretches) and Pill rows (intrinsic) misaligned. Field default
       lets the Pill fill its column, matching the Swatch behavior. -->
  <Field {label} {hint}>
    <Pill
      {value}
      {segments}
      ariaLabel={label}
      onchange={(v) => onchange(v as T)}
    />
  </Field>
</div>

<style>
  .sf-row { display: contents; }
</style>

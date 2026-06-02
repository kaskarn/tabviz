<!--
  NumberField — settings-panel slider row. The settings UX wants a
  light "drag the thumb" affordance (rgc-design idiom), not the
  heavier edit-and-scrub Knob the column editor uses. Slider is the
  right tool here.
-->
<script lang="ts">
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";

  interface Props {
    label: string;
    hint?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onchange: (value: number) => void;
  }

  const { label, hint, value, min, max, step = 1, unit, onchange }: Props = $props();

  let local: number = $state(0);
  $effect(() => { local = value; });
  $effect(() => {
    if (local !== value) onchange(local);
  });
</script>

<div class="nf-row" data-tv-v2>
  <Field {label} {hint}>
    <Slider
      bind:value={local}
      {min}
      {max}
      {step}
      suffix={unit}
      ariaLabel={label}
    />
  </Field>
</div>

<style>
  .nf-row { display: contents; }
</style>

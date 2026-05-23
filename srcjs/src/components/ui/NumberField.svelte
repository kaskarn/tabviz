<!--
  NumberField — settings-panel number row with inline slider track.
  v2-skinned: composes Field + Knob (track mode). Caller API unchanged.
-->
<script lang="ts">
  import Field from "$components/primitives/v2/Field.svelte";
  import Knob from "$components/primitives/v2/Knob.svelte";

  interface Props {
    label: string;
    hint?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    /** Unit label rendered as a muted mono suffix in the value chip. */
    unit?: string;
    onchange: (value: number) => void;
  }

  let { label, hint, value, min, max, step = 1, unit, onchange }: Props = $props();

  // Bridge: Knob owns its own value via bind; we mirror it to the
  // upstream prop and re-fire onchange on user edits.
  let local: number | null = $state<number | null>(null);
  $effect(() => { local = value; });
  $effect(() => {
    if (local != null && local !== value) onchange(local);
  });
</script>

<div class="nf-row" data-tv-v2>
  <Field {label} {hint}>
    <Knob
      bind:value={local}
      {min}
      {max}
      {step}
      track
      suffix={unit}
    />
  </Field>
</div>

<style>
  .nf-row { display: contents; }
</style>

<!--
  BooleanField — settings-panel boolean row. v2-skinned: composes the
  v2 Field row + Pill (2-segment off/on). Caller API unchanged.
-->
<script lang="ts">
  import Field from "$components/primitives/v2/Field.svelte";
  import Pill from "$components/primitives/v2/Pill.svelte";

  interface Props {
    /** Visible label for the field. */
    label: string;
    /** Optional secondary hint shown under the label. */
    hint?: string;
    /** Current value. */
    value: boolean;
    /** Fired on click / keypress toggle. */
    onchange: (value: boolean) => void;
  }

  let { label, hint, value, onchange }: Props = $props();
</script>

<div class="bf-row" data-tv-v2>
  <Field {label} {hint} tight>
    <Pill
      {value}
      segments={[
        { value: false, label: "off" },
        { value: true,  label: "on" },
      ]}
      ariaLabel={label}
      onchange={(v) => onchange(v as boolean)}
    />
  </Field>
</div>

<style>
  /* Wrap the field in a v2-tokens scope so the settings-panel host
     (which doesn't yet set data-tv-v2 itself) inherits the cascade.
     Once SettingsPanel.svelte sets data-tv-v2 on its body the wrapper
     is redundant but harmless. */
  .bf-row {
    display: contents;
  }
</style>

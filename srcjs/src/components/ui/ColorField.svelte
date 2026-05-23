<!--
  ColorField — settings-panel color row. v2-skinned: Field + Swatch.
  The Swatch primitive already has theme palette + hex + native picker
  + unset diagonal-stripe, so the wrapper is thin. Caller API preserved
  (string[] swatches, overridden, onreset, onchange).
-->
<script lang="ts">
  import Field from "$components/primitives/v2/Field.svelte";
  import Swatch from "$components/primitives/v2/Swatch.svelte";
  import type { ThemeSwatch } from "$components/primitives/v2/types";

  interface Props {
    label: string;
    hint?: string;
    value: string;
    onchange: (value: string) => void;
    /** Optional theme palette — wrapped as ThemeSwatch[] for the v2 primitive. */
    swatches?: string[];
    overridden?: boolean;
    onreset?: () => void;
  }

  let { label, hint, value, onchange, swatches, overridden, onreset }: Props = $props();

  // Map flat string[] (the historical API) to ThemeSwatch[] (the v2
  // primitive's typed form). Token labels are 1-indexed positional —
  // the caller can swap in a richer mapping later by changing how
  // they invoke ColorField, no need to thread token names everywhere.
  const themeSwatches: ThemeSwatch[] = $derived(
    (swatches ?? []).map((color, i) => ({ color, token: `theme-${i + 1}` })),
  );

  let local: string | null = $state<string | null>(null);
  $effect(() => { local = value; });
  $effect(() => {
    if (local != null && local !== value) onchange(local);
  });
</script>

<div class="cf-row" data-tv-v2>
  <Field
    {label}
    {hint}
    pinned={overridden}
    onreset={overridden && onreset ? onreset : undefined}
  >
    <Swatch
      bind:value={local}
      swatches={themeSwatches}
      allowUnset={false}
    />
  </Field>
</div>

<style>
  .cf-row { display: contents; }
</style>

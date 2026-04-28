<script lang="ts">
  import { FONT_PRESETS, matchPresetStack } from "$lib/font-presets";
  import TextField from "./TextField.svelte";

  interface Props {
    label: string;
    hint?: string;
    value: string;
    onchange: (value: string) => void;
  }

  let { label, hint, value, onchange }: Props = $props();

  // Sentinel for the "Custom..." entry — keeps the <select> value
  // distinct from any real preset stack.
  const CUSTOM = "__custom__";

  // The select's effective value is either the matching preset's stack
  // or the CUSTOM sentinel (when the current font-family isn't a preset).
  const selectValue = $derived(matchPresetStack(value) ?? CUSTOM);
  const isCustom = $derived(selectValue === CUSTOM);

  function handleSelect(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    if (v === CUSTOM) {
      // Switching INTO custom: keep the existing value as the seed for
      // the text field. If we're already custom (because value matched
      // nothing), there's nothing to do — the field is already shown.
      // If we're switching from a preset, keep the preset value as the
      // starting point so the user can edit it instead of typing from
      // scratch.
      return;
    }
    onchange(v);
  }
</script>

<div class="font-picker" title={hint}>
  <span class="label">{label}</span>
  <select
    class="select"
    value={selectValue}
    onchange={handleSelect}
    aria-label={label}
  >
    {#each FONT_PRESETS as preset (preset.name)}
      <option value={preset.stack} style:font-family={preset.stack}>
        {preset.name}{preset.hint ? ` — ${preset.hint}` : ""}
      </option>
    {/each}
    <option value={CUSTOM}>Custom…</option>
  </select>
</div>

{#if isCustom}
  <TextField
    label="Custom"
    hint="Any CSS font-family stack, e.g. Georgia, serif"
    {value}
    onchange={(v) => onchange(v)}
  />
{/if}

<style>
  .font-picker {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .label {
    font-size: 0.75rem;
    color: var(--tv-fg, #1a1a1a);
    font-weight: 500;
    line-height: 1.2;
    min-width: 0;
  }

  .select {
    width: 180px;
    padding: 3px 6px;
    border: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 12%, var(--tv-border, #e2e8f0));
    border-radius: 4px;
    font-size: 0.75rem;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    cursor: pointer;
  }

  .select:focus {
    border-color: var(--tv-accent, #2563eb);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--tv-accent, #2563eb) 15%, transparent);
  }
</style>

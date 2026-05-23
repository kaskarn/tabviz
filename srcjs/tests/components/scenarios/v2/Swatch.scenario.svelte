<!--
  v2 Swatch scenario — color input with theme palette + recents.
-->
<script lang="ts">
  import Swatch from "../../../../src/components/primitives/v2/Swatch.svelte";
  import type { ThemeSwatch } from "../../../../src/components/primitives/v2/types";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  const themeSwatches: ThemeSwatch[] = [
    { color: "#15140e", token: "ink" },
    { color: "#4a463c", token: "ink-2" },
    { color: "#8a8478", token: "muted" },
    { color: "#b53a1f", token: "accent" },
    { color: "#faf7f0", token: "paper" },
    { color: "#a07b3d", token: "olive" },
    { color: "#3d6e8e", token: "blue" },
    { color: "#69806b", token: "moss" },
  ];

  const recents = ["#c44a2f", "#264653", "#e9c46a"];

  let primary: string | null   = $state("#b53a1f");
  let secondary: string | null = $state(null);
  let pinned: string | null    = $state("#3d6e8e");

  $effect(() => {
    const b = harnessState.primary;
    if (b !== primary) { harnessState.primary = primary; recordChange("primary", b, primary, "swatch"); }
  });
  $effect(() => {
    const b = harnessState.secondary;
    if (b !== secondary) { harnessState.secondary = secondary; recordChange("secondary", b, secondary, "swatch"); }
  });
  $effect(() => {
    const b = harnessState.pinned;
    if (b !== pinned) { harnessState.pinned = pinned; recordChange("pinned", b, pinned, "swatch"); }
  });
</script>

<div class="sheet">
  <div class="row">
    <span class="flag">primary</span>
    <Swatch bind:value={primary} swatches={themeSwatches} {recents} />
    <span class="note">theme palette + recents</span>
  </div>

  <div class="row">
    <span class="flag">unset</span>
    <Swatch bind:value={secondary} swatches={themeSwatches} />
    <span class="note">no value · diagonal-stripe chip</span>
  </div>

  <div class="row">
    <span class="flag">bare</span>
    <Swatch bind:value={pinned} />
    <span class="note">no palette — hex + native picker only</span>
  </div>

  <div class="row">
    <span class="flag">disabled</span>
    <Swatch value="#15140e" disabled swatches={themeSwatches} />
    <span class="note">read-only</span>
  </div>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 600px;
  }
  .row {
    display: grid;
    grid-template-columns: 100px auto 1fr;
    align-items: center;
    gap: 16px;
  }
  .flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .note {
    font-family: var(--v2-font-sans, system-ui);
    font-size: 10.5px;
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }
</style>

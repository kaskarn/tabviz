<!--
  ThemePanel — the shared theme-authoring surface used by both the widget
  cog-icon settings panel and the tabviz_studio() gadget.

  Layout (top to bottom):
    1. Controls strip (sticky) — anchors + polarity/mode + shell/texture
       + type + density. Every primary Tier-1 input lives here.
    2. Inspect toggle — off by default. When off, only the controls strip
       shows. Flipping it on reveals the cascade visualization below.
    3. Tier 1 ramps — three 11-step swatch strips with OKLCH labels.
    4. Tier 2 spine — role tokens pinned on their bound (ramp, grade).
    5. Tier 3 aliases — component-token chain, grouped by cluster.

  Reading the panel top to bottom IS reading the cascade.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { resolveTheme } from "$lib/theme/resolve-theme";
  import { createWire } from "$lib/theme/theme-wire";

  import SectionLabel from "./cascade/SectionLabel.svelte";
  import AnchorControls from "./controls/AnchorControls.svelte";
  import PolarityModeControls from "./controls/PolarityModeControls.svelte";
  import ShellTextureControls from "./controls/ShellTextureControls.svelte";
  import TypeControls from "./controls/TypeControls.svelte";
  import DensityControls from "./controls/DensityControls.svelte";
  import Tier1Ramps from "./cascade/Tier1Ramps.svelte";
  import Tier2Spine from "./cascade/Tier2Spine.svelte";
  import Tier3Aliases from "./cascade/Tier3Aliases.svelte";
  import TraceInspector from "./cascade/TraceInspector.svelte";

  const {
    inputs,
    onchange,
    /** Resolved theme to drive the cascade viz. When omitted, ThemePanel
     *  resolves locally — useful when the consumer doesn't already hold a
     *  resolved blob. */
    resolved,
    /** Initial state of the Inspect disclosure. Default: off (controls
     *  only — matches the widget settings panel's footprint). */
    inspectDefault = false,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
    resolved?: ResolvedTheme;
    inspectDefault?: boolean;
  } = $props();

  // Initialize from prop default; subsequent toggles are local-only.
  // eslint-disable-next-line svelte/no-state-referenced-locally
  let inspect = $state(inspectDefault);

  const localResolved = $derived<ResolvedTheme>(
    resolved ?? resolveTheme(createWire(inputs, "custom")),
  );
</script>

<div class="theme-panel" class:inspect-on={inspect}>
  <div class="controls" aria-label="Theme inputs">
    <AnchorControls {inputs} {onchange} />
    <div class="block">
      <PolarityModeControls {inputs} {onchange} />
    </div>
    <div class="block">
      <ShellTextureControls {inputs} {onchange} />
    </div>
    <div class="block">
      <TypeControls {inputs} {onchange} />
    </div>
    <div class="block">
      <DensityControls {inputs} {onchange} />
    </div>
  </div>

  <div class="inspect-toggle">
    <button type="button" class:on={inspect}
            onclick={() => (inspect = !inspect)}
            aria-pressed={inspect}>
      <span class="caret">{inspect ? "▾" : "▸"}</span>
      <span>Inspect the cascade</span>
      <span class="aside">Tier 1 ramps · Tier 2 spine · Tier 3 aliases</span>
    </button>
  </div>

  {#if inspect}
    <section class="cascade">
      <SectionLabel
        tier="1"
        kind="Color"
        heading="Primitives — generated scales"
        prose="Three 11-step ramps interpolated in OKLCH from your anchors. Click any grade to trace it through the cascade."
      />
      <Tier1Ramps resolved={localResolved} />

      <SectionLabel
        tier="2"
        kind="Binding"
        heading="Role spine — pins on each scale"
        prose="Each role binds to a grade on a ramp. Drag up/down to change grade, sideways to rebind ramp. Hover to light up consumers; click to trace."
      />
      <Tier2Spine resolved={localResolved} />

      <SectionLabel
        tier="3"
        kind="Component tokens"
        heading="Scoped aliases"
        prose="Component-level overrides — pure aliases of Tier 2 roles. This is the surface the widget actually reads. Click any token to trace its full chain."
      />
      <Tier3Aliases resolved={localResolved} />
    </section>

    <TraceInspector />
  {/if}
</div>

<style>
  .theme-panel {
    display: flex;
    flex-direction: column;
    min-width: 320px;
    background: var(--tp-bg, #ffffff);
    color: var(--tp-fg, #1c1a17);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    --tp-bg: #ffffff;
    --tp-fg: #1c1a17;
    --tp-muted: #6b6760;
    --tp-rule: #e8e6e1;
    --tp-input-bg: #ffffff;
    --tp-row-active: #f6f3ed;
    --tp-chip-bg: #faf9f6;
    --tp-chip-rule: #d8d4cc;
    --tp-chip-fg: #66635c;
    --tp-rhs: #5e51a3;
    --tp-swatch-rule: #c8c4bd;
  }
  .controls {
    display: flex;
    flex-direction: column;
    padding: 12px 0 6px;
    border-bottom: 1px solid var(--tp-rule, #e8e6e1);
  }
  .block {
    border-top: 1px solid var(--tp-rule, #e8e6e1);
    padding-top: 4px;
    margin-top: 4px;
  }
  .inspect-toggle {
    padding: 8px 18px;
    background: var(--tp-input-bg, #faf9f6);
    border-bottom: 1px solid var(--tp-rule, #e8e6e1);
  }
  .inspect-toggle button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    color: var(--tp-fg, #1c1a17);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 4px;
  }
  .inspect-toggle button:hover { background: var(--tp-row-active, #f6f3ed); }
  .inspect-toggle .caret { width: 14px; text-align: center; color: var(--tp-muted, #6b6760); }
  .inspect-toggle .aside {
    margin-left: auto;
    font-weight: 400;
    font-size: 11px;
    color: var(--tp-muted, #6b6760);
    font-style: italic;
  }
  .cascade {
    display: flex;
    flex-direction: column;
  }
  /* .theme-panel.inspect-on is currently identity — consumers wrap us in
     their own layout when inspect is on. Class kept for future hooks. */
</style>

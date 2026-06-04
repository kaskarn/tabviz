<!--
  ThemePanel — the shared theme-authoring surface used by both the widget
  cog-icon settings drawer and the studio gadget.

  Layout (top to bottom):
    1. Controls strip (sticky) — anchors + polarity/mode + shell/texture
       + type + density. Every Tier-1 input lives here.
    2. Inspect toggle — off by default. When off, only the controls strip
       shows. Flipping it on reveals the cascade visualization below.
    3. Cascade visualization. Each section is a `CascadeStep` with a
       (category, facet) chip + heading + prose + a single viz primitive:

         TIER 1 · COLOR        RampPlateGrid
         TIER 2 · BINDING      SpineDiagram + OffTheScales
         TIER 2 · COLOR        AliasTable mode="role"   (side-by-side w/ above)
         TIER 3 · COLOR        AliasTable mode="token"
         SCALE  · TYPE         TypeRolePreview
         RESILIENCE · FALLBACK ResilienceTriptych

    The trace inspector docks in the right rail.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { resolveTheme } from "$lib/theme/resolve-theme";
  import { createWire } from "$lib/theme/theme-wire";

  import CascadeStep from "./cascade/CascadeStep.svelte";
  import RampPlateGrid from "./cascade/RampPlateGrid.svelte";
  import SpineDiagram from "./cascade/SpineDiagram.svelte";
  import OffTheScales from "./cascade/OffTheScales.svelte";
  import AliasTable from "./cascade/AliasTable.svelte";
  import TypeRolePreview from "./cascade/TypeRolePreview.svelte";
  import ResilienceTriptych from "./cascade/ResilienceTriptych.svelte";
  import TraceInspector from "./cascade/TraceInspector.svelte";

  import AnchorControls from "./controls/AnchorControls.svelte";
  import PolarityModeControls from "./controls/PolarityModeControls.svelte";
  import ShellTextureControls from "./controls/ShellTextureControls.svelte";
  import TypeControls from "./controls/TypeControls.svelte";
  import DensityControls from "./controls/DensityControls.svelte";

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
      <span class="aside">primitives · roles · component tokens · type · resilience</span>
    </button>
  </div>

  {#if inspect}
    <section class="cascade">
      <!-- TIER 1 · COLOR — primitives -->
      <CascadeStep
        category="TIER 1"
        facet="COLOR"
        heading="Primitives — generated scales"
        prose="Three 11-step ramps interpolated in OKLCH from your <strong>paper</strong>, <strong>ink</strong>, <strong>brand</strong>, and <strong>accent</strong> anchors. Top row = solid grades; bottom row = the alpha companion (one ink/brand color at rising opacity) shown over <em>paper</em>. Click any grade to trace it through the cascade."
      >
        <RampPlateGrid resolved={localResolved} />
      </CascadeStep>

      <!-- TIER 2 — Binding spine + role contract side-by-side -->
      <div class="row two-up">
        <CascadeStep
          category="TIER 2"
          facet="BINDING"
          heading="Role spine — drag tokens along & across the scales"
          prose="Three generated scales — <strong>neutral</strong>, <strong>brand</strong>, <strong>accent</strong> — top (paper-ward) to bottom (ink-ward). Every role token sits at the grade it binds to. <strong>Hover a token to light up what it paints</strong>; click to trace. Status & computed roles live in the tray below — they don't bind to a grade."
        >
          <SpineDiagram resolved={localResolved} />
          <div class="off-tray">
            <OffTheScales resolved={localResolved} />
          </div>
        </CascadeStep>

        <CascadeStep
          category="TIER 2"
          facet="COLOR"
          heading="Semantic roles — the component contract"
          prose="Components reference roles by <em>function</em>, never raw grades. Dark mode & high-contrast remap this layer in one place. Click a role to trace it; its binding lives on the spine to the left."
        >
          <AliasTable mode="role" resolved={localResolved} />
        </CascadeStep>
      </div>

      <!-- TIER 3 · COLOR — component-token aliases -->
      <CascadeStep
        category="TIER 3"
        facet="COLOR"
        heading="Component tokens — scoped aliases"
        prose="Per-component overrides. Pure aliases of Tier-2 roles, so the widget can be fine-tuned without touching the global layer. <strong>This is the only surface the widget itself reads.</strong> Click a token to trace its full chain."
      >
        <AliasTable mode="token" resolved={localResolved} />
      </CascadeStep>

      <!-- SCALE · TYPE — typography roles -->
      <CascadeStep
        category="SCALE"
        facet="TYPE"
        heading="Type roles — family × modular scale × weight"
        prose="One base size × ratio generates the size ladder; each role composes a family slot, a step on the ladder, and a weight. Sampled live in the active theme's fonts."
      >
        <TypeRolePreview resolved={localResolved} />
      </CascadeStep>

      <!-- RESILIENCE · FALLBACK — the mode triptych -->
      <CascadeStep
        category="RESILIENCE"
        facet="FALLBACK"
        heading="One encoding, three rendering modes"
        prose="The highlighted row carries meaning. Standard uses a translucent brand wash; <strong>reduced-transparency</strong> swaps it for an opaque tint; <strong>high-contrast</strong> drops the fill entirely and re-encodes with a weight + bar marker. The signal never depends on a single channel."
      >
        <ResilienceTriptych {inputs} />
      </CascadeStep>
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
    --tp-fg-muted: #4d4a45;
    --tp-muted: #6b6760;
    --tp-rule: #e8e6e1;
    --tp-rule-faint: #f1efea;
    --tp-input-bg: #faf9f6;
    --tp-row-active: #f6f3ed;
    --tp-chip-bg: #faf9f6;
    --tp-chip-rule: #d8d4cc;
    --tp-chip-fg: #66635c;
    --tp-rhs: #5e51a3;
    --tp-swatch-rule: #c8c4bd;
    --tp-trace-rule: #4a90e2;
    --tp-trace-bg: #eef4fb;
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
  .row.two-up {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    align-items: start;
  }
  .row.two-up > :global(.cascade-step) {
    border-top: 1px solid var(--tp-rule, #e8e6e1);
  }
  .row.two-up > :global(.cascade-step + .cascade-step) {
    border-left: 1px solid var(--tp-rule, #e8e6e1);
  }
  .off-tray { margin-top: 18px; }

  /* When the panel narrows, collapse the side-by-side back to stacked. */
  @media (max-width: 1100px) {
    .row.two-up { grid-template-columns: 1fr; }
    .row.two-up > :global(.cascade-step + .cascade-step) {
      border-left: 0;
    }
  }
</style>

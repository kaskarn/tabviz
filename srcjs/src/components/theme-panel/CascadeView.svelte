<!--
  CascadeView — the pedagogical surface of the v4 cascade.

  This is the studio-only didactic component. It does not edit; it
  visualizes. Reading the view top-to-bottom IS reading the cascade
  resolution flow:

    TIER 1 · COLOR         RampPlateGrid
    TIER 1 · GEOMETRY      GeometrySamples
    TIER 1 · EFFECTS       EffectsPreview
    TIER 2 · BINDING       SpineDiagram + OffTheScales
    TIER 2 · COLOR         AliasTable mode="role"
    TIER 3 · COLOR         AliasTable mode="token"
    SCALE  · TYPE          TypeRolePreview
    RESILIENCE · FALLBACK  ResilienceTriptych

  The widget cog-icon drawer mounts ThemeControlsStrip directly; this
  component is not used there.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { resolveTheme } from "$lib/theme/resolve-theme";
  import { createWire } from "$lib/theme/theme-wire";

  import CascadeStep from "./cascade/CascadeStep.svelte";
  import RampPlateGrid from "./cascade/RampPlateGrid.svelte";
  import GeometrySamples from "./cascade/GeometrySamples.svelte";
  import EffectsPreview from "./cascade/EffectsPreview.svelte";
  import SpineDiagram from "./cascade/SpineDiagram.svelte";
  import OffTheScales from "./cascade/OffTheScales.svelte";
  import AliasTable from "./cascade/AliasTable.svelte";
  import TypeRolePreview from "./cascade/TypeRolePreview.svelte";
  import ResilienceTriptych from "./cascade/ResilienceTriptych.svelte";
  import TraceInspector from "./cascade/TraceInspector.svelte";

  const {
    inputs,
    /** Resolved theme to drive the cascade viz. When omitted, CascadeView
     *  resolves locally — convenient when the consumer doesn't already
     *  hold a resolved blob. */
    resolved,
  }: {
    inputs: ThemeInputs;
    resolved?: ResolvedTheme;
  } = $props();

  const localResolved = $derived<ResolvedTheme>(
    resolved ?? resolveTheme(createWire(inputs, "custom")),
  );
</script>

<div class="cascade-view">
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

    <!-- TIER 1 · GEOMETRY — radius + border-width scales -->
    <CascadeStep
      category="TIER 1"
      facet="GEOMETRY"
      heading="Geometry — radius & border-width scales"
      prose="Two numeric scales drive corner softness and line weight across the widget. <strong>Radius</strong>: sm → md → lg → pill. <strong>Border-width</strong>: hair → thin → regular → thick. HC mode bumps every border-width by +1px (the hair token swaps to border-strong) so structural cues survive the colour drop."
    >
      <GeometrySamples {inputs} resolved={localResolved} />
    </CascadeStep>

    <!-- TIER 1 · EFFECTS — glow + gradient + elevation -->
    <CascadeStep
      category="TIER 1"
      facet="EFFECTS"
      heading="Effects — glow, gradient, elevation"
      prose="Optional browser-additive layers. <strong>Glow</strong> reads the chosen anchor ramp at its chroma peak; intensity controls blur + spread. <strong>Gradient shell</strong> paints a two-stop brand → accent sweep on the outer surface. <strong>Elevation</strong> stacks a near + far hue-tinted shadow. HC mode drops every effect; RT keeps glow but flattens the gradient."
    >
      <EffectsPreview resolved={localResolved} />
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
</div>

<style>
  .cascade-view {
    display: flex;
    flex-direction: column;
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
  .cascade { display: flex; flex-direction: column; }
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
  @media (max-width: 1100px) {
    .row.two-up { grid-template-columns: 1fr; }
    .row.two-up > :global(.cascade-step + .cascade-step) {
      border-left: 0;
    }
  }
</style>

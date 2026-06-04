<!--
  ThemeControlsStrip — pure Tier-1 controls. No cascade visualization.

  This is the shared authoring surface mounted by:
    - The widget's cog-icon settings drawer (compact, no teaching)
    - The studio gadget's controls rail (alongside CascadeView)

  Each category is its own component file so the order, layout, and
  presence can be configured per host. The strip itself does no
  orchestration beyond stacking the categories vertically.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";

  import AnchorControls from "./controls/AnchorControls.svelte";
  import PolarityModeControls from "./controls/PolarityModeControls.svelte";
  import ShellControls from "./controls/ShellControls.svelte";
  import TextureControls from "./controls/TextureControls.svelte";
  import TypeControls from "./controls/TypeControls.svelte";
  import DensityControls from "./controls/DensityControls.svelte";
  import GeometryControls from "./controls/GeometryControls.svelte";
  import EffectsControls from "./controls/EffectsControls.svelte";

  const {
    inputs,
    onchange,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
  } = $props();

  // The order is canonical: identity → polarity → shell → texture →
  // type → density → geometry → effects. Mirrors the rgc tab pattern
  // (Color / Size / Effects) grouped one-level-deeper.
  const CATEGORIES = [
    { key: "anchors",   label: "Identity",   Comp: AnchorControls },
    { key: "polarity",  label: "Polarity",   Comp: PolarityModeControls },
    { key: "shell",     label: "Shell",      Comp: ShellControls },
    { key: "texture",   label: "Texture",    Comp: TextureControls },
    { key: "type",      label: "Typography", Comp: TypeControls },
    { key: "density",   label: "Density",    Comp: DensityControls },
    { key: "geometry",  label: "Geometry",   Comp: GeometryControls },
    { key: "effects",   label: "Effects",    Comp: EffectsControls },
  ] as const;
</script>

<div class="theme-controls-strip" aria-label="Theme inputs">
  {#each CATEGORIES as cat (cat.key)}
    <section class="category" data-category={cat.key}>
      <header>{cat.label}</header>
      <cat.Comp {inputs} {onchange} />
    </section>
  {/each}
</div>

<style>
  .theme-controls-strip {
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
  .category {
    border-top: 1px solid var(--tp-rule, #e8e6e1);
    padding-top: 4px;
  }
  .category:first-child { border-top: 0; padding-top: 12px; }
  header {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tp-muted, #6b6760);
    padding: 6px 18px 0;
  }
</style>

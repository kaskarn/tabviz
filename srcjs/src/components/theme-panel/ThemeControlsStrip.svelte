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
    onpreview,
    only,
    layout = "flat",
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
    /** C53: drag-time preview channel (no history / no re-measure).
     *  Slider-bearing controls use it; falls back to onchange. */
    onpreview?: (next: ThemeInputs) => void;
    /** D14 (wire-audit Pass 4): optional category filter. The widget cog
     *  drawer mounts the curated everyday subset (presets + polarity +
     *  density); the studio mounts the full strip. */
    only?: readonly string[];
    /** D5/C14 (wire-audit 4c): "tabs" renders the five-tab rail
     *  (Color / Type / Size / Shell / Effects) with the ARIA tablist
     *  pattern; "flat" (default) stacks categories — the widget drawer
     *  and `only`-filtered hosts use flat. */
    layout?: "flat" | "tabs";
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

  const visible = $derived(
    only ? CATEGORIES.filter((c) => only.includes(c.key)) : CATEGORIES,
  );

  // D5 LOCKED tab IA (C14). Geometry rides inside Size behind a native
  // <details> disclosure (C50 — power knobs tucked, common knobs flat).
  // Polarity is NOT a tab: it's a constant-use mode flip, surfaced flat
  // at the top of the rail (C50's "lift out of the Color tab").
  const TABS = [
    { key: "color",   label: "Color",   cats: ["anchors"] },
    { key: "type",    label: "Type",    cats: ["type"] },
    { key: "size",    label: "Size",    cats: ["density", "geometry"] },
    { key: "shell",   label: "Shell",   cats: ["shell", "texture"] },
    { key: "effects", label: "Effects", cats: ["effects"] },
  ] as const;
  /** Categories that render inside a collapsed <details> disclosure. */
  const ADVANCED = new Set(["geometry"]);

  let activeTab = $state<(typeof TABS)[number]["key"]>("color");

  function catComp(key: string) {
    return CATEGORIES.find((c) => c.key === key);
  }

  // ARIA tablist arrow-key nav (C16).
  function onTabKeydown(e: KeyboardEvent, idx: number): void {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(idx + delta + TABS.length) % TABS.length]!;
    activeTab = next.key;
    const el = document.getElementById(`tv-theme-tab-${next.key}`);
    el?.focus();
  }
</script>

<div class="theme-controls-strip" aria-label="Theme inputs">
  {#if layout === "tabs"}
    <!-- Polarity flat above the tabs — a mode flip, not a color edit. -->
    <section class="category polarity-flat" data-category="polarity">
      <PolarityModeControls {inputs} {onchange} />
    </section>
    <div class="tabs" role="tablist" aria-label="Theme input groups">
      {#each TABS as tab, i (tab.key)}
        <button
          type="button"
          role="tab"
          id="tv-theme-tab-{tab.key}"
          aria-selected={activeTab === tab.key}
          aria-controls="tv-theme-panel-{tab.key}"
          tabindex={activeTab === tab.key ? 0 : -1}
          class:on={activeTab === tab.key}
          onclick={() => (activeTab = tab.key)}
          onkeydown={(e) => onTabKeydown(e, i)}
        >{tab.label}</button>
      {/each}
    </div>
    {#each TABS as tab (tab.key)}
      <div
        role="tabpanel"
        id="tv-theme-panel-{tab.key}"
        aria-labelledby="tv-theme-tab-{tab.key}"
        hidden={activeTab !== tab.key}
      >
        {#each tab.cats as key (key)}
          {@const cat = catComp(key)}
          {#if cat}
            {#if ADVANCED.has(key)}
              <details class="advanced">
                <summary>{cat.label}</summary>
                <cat.Comp {inputs} {onchange} {onpreview} />
              </details>
            {:else}
              <section class="category" data-category={cat.key}>
                <header>{cat.label}</header>
                <cat.Comp {inputs} {onchange} {onpreview} />
              </section>
            {/if}
          {/if}
        {/each}
      </div>
    {/each}
  {:else}
    {#each visible as cat (cat.key)}
      <section class="category" data-category={cat.key}>
        <header>{cat.label}</header>
        <cat.Comp {inputs} {onchange} {onpreview} />
      </section>
    {/each}
  {/if}
</div>

<style>
  .tabs {
    display: flex;
    gap: 2px;
    padding: 6px 12px 0;
    border-bottom: 1px solid var(--tp-rule, #e8e6e1);
    position: sticky;
    top: 0;
    background: var(--tp-bg, #ffffff);
    z-index: 1;
  }
  .tabs button {
    flex: 1;
    padding: 6px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--tp-muted, #6b6760);
    cursor: pointer;
    border-radius: 4px 4px 0 0;
  }
  .tabs button.on {
    color: var(--tp-fg, #1c1a17);
    border-bottom-color: var(--tp-fg, #1c1a17);
  }
  .tabs button:focus-visible { outline: 2px solid #4a90e2; outline-offset: -2px; }
  .polarity-flat { border-bottom: 1px solid var(--tp-rule, #e8e6e1); }
  details.advanced {
    margin: 4px 12px 10px;
    border: 1px dashed var(--tp-rule, #e8e6e1);
    border-radius: 6px;
    padding: 2px 6px;
  }
  details.advanced summary {
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tp-muted, #6b6760);
    padding: 5px 6px;
  }

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

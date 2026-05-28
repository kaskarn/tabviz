<!--
  Settings Panel scaffold — renders each menu of the settings panel
  in isolation against a fake-but-fully-resolved spec, so we can
  iterate on the visual design without standing up a widget/table.

  Pure design surface. Click a tab name on the right to swap which
  Control is rendered in the left panel; the panel mimics the same
  width clamp (320–440 px) as in production.
-->
<script lang="ts">
  import { tabviz } from "$authoring/tabviz";
  import { createTabvizStore, type TabvizStore } from "$stores/tabvizStore.svelte";

  import AccordionGroup  from "$components/primitives/v2/AccordionGroup.svelte";
  import BasicsControl    from "$components/ui/BasicsControl.svelte";
  import ThemeControl     from "$components/ui/ThemeControl.svelte";
  import LayoutControl    from "$components/ui/LayoutControl.svelte";
  import SpacingControl   from "$components/ui/SpacingControl.svelte";
  import MarksControl     from "$components/ui/MarksControl.svelte";
  import TextControl      from "$components/ui/TextControl.svelte";
  import TokensControl    from "$components/ui/TokensControl.svelte";
  import WatermarkControl from "$components/ui/WatermarkControl.svelte";

  // Sample data — six rows, a few columns. Enough that the rendered
  // store has realistic shape; the actual values don't show up in the
  // settings panel UI, just in the cascade.
  const sampleSpec = tabviz({
    data: [
      { study: "PIONEER-3",  n: 2840, hr: 0.72, lo: 0.61, hi: 0.85, pval: 0.0003 },
      { study: "ARISTOTLE-II", n: 4120, hr: 0.84, lo: 0.74, hi: 0.95, pval: 0.0091 },
      { study: "REVEAL-CAD", n: 3580, hr: 0.79, lo: 0.67, hi: 0.93, pval: 0.0048 },
      { study: "DIAMOND-AF", n: 2210, hr: 0.68, lo: 0.55, hi: 0.84, pval: 0.0004 },
      { study: "VANGUARD",   n: 5400, hr: 0.82, lo: 0.71, hi: 0.94, pval: 0.0067 },
      { study: "Pooled",     n: 18150, hr: 0.78, lo: 0.73, hi: 0.84, pval: 1.2e-8 },
    ],
    label: "study",
    title: "Pooled efficacy across CV outcome trials",
    columns: [
      { field: "n",  type: "n",        header: "No." },
      { field: "hr", type: "interval", options: { interval: { point: "hr", lower: "lo", upper: "hi" } }, header: "HR (95% CI)" },
      { field: "pval", type: "pvalue", header: "P value" },
    ],
    theme: "jama",
  });

  const store: TabvizStore = createTabvizStore();
  store.setSpec(sampleSpec);

  type TabId = "basics" | "theme" | "layout" | "spacing" | "viz" | "text" | "tokens" | "watermark";

  const TABS: { id: TabId; label: string }[] = [
    { id: "theme",     label: "Theme" },
    { id: "layout",    label: "Layout" },
    { id: "spacing",   label: "Spacing" },
    { id: "viz",       label: "Marks" },
    { id: "text",      label: "Text" },
    { id: "tokens",    label: "Tokens" },
    { id: "basics",    label: "Labels" },
    { id: "watermark", label: "Watermark" },
  ];

  let activeTab = $state<TabId>("theme");
</script>

<div class="scaffold" data-tv-v2>
  <!-- The panel mimics SettingsPanel's positioning + chrome at the
       actual production width. No backdrop, no widget — the panel is
       the only thing on the stage. -->
  <aside class="panel">
    <header class="panel-bar">
      <span class="bar-title">Settings</span>
    </header>
    <div class="panel-body">
      {#if activeTab === "theme"}
        <AccordionGroup><ThemeControl {store} /></AccordionGroup>
      {:else if activeTab === "layout"}
        <AccordionGroup>
          <LayoutControl {store} />
          <BasicsControl {store} />
          <WatermarkControl {store} />
        </AccordionGroup>
      {:else if activeTab === "spacing"}
        <AccordionGroup><SpacingControl {store} /></AccordionGroup>
      {:else if activeTab === "viz"}
        <AccordionGroup><MarksControl {store} /></AccordionGroup>
      {:else if activeTab === "text"}
        <AccordionGroup><TextControl {store} /></AccordionGroup>
      {:else if activeTab === "tokens"}
        <AccordionGroup><TokensControl {store} /></AccordionGroup>
      {:else if activeTab === "basics"}
        <AccordionGroup><BasicsControl {store} /></AccordionGroup>
      {:else if activeTab === "watermark"}
        <AccordionGroup><WatermarkControl {store} /></AccordionGroup>
      {/if}
    </div>
  </aside>

  <!-- Tab picker, sits to the right of the panel. Lets a designer
       jump between menus without going through the in-panel TabSelect. -->
  <nav class="picker">
    <header class="picker-h">Menu</header>
    {#each TABS as t (t.id)}
      <button
        type="button"
        class="picker-btn"
        class:active={activeTab === t.id}
        onclick={() => (activeTab = t.id)}
      >
        {t.label}
      </button>
    {/each}
  </nav>
</div>

<style>
  .scaffold {
    display: grid;
    grid-template-columns: clamp(320px, 40%, 440px) 1fr;
    gap: 24px;
    padding: 24px;
    background: #ece6d8;
    min-height: 100%;
    box-sizing: border-box;
  }

  /* Panel: mimics SettingsPanel chrome — paper background, soft shadow,
     left ink-rule. No backdrop, no animation; this is a static stage. */
  .panel {
    background:
      radial-gradient(120% 60% at 50% 0%, rgba(255, 255, 255, 0.5) 0%, transparent 65%),
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.08  0 0 0 0 0.07  0 0 0 0 0.05  0 0 0 0.045 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"),
      #faf7f0;
    box-shadow:
      -2px 0 0 0 rgba(0, 0, 0, 0.06),
      0 12px 32px -8px rgba(15, 14, 10, 0.18);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 4px;
  }
  .panel-bar {
    display: flex;
    align-items: center;
    min-height: 34px;
    padding: 0 12px;
    border-bottom: 1px solid rgba(214, 208, 193, 0.6);
  }
  .bar-title {
    font-family: "EB Garamond", "Palatino Linotype", Palatino, Georgia, serif;
    font-size: 0.95rem;
    font-weight: 500;
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: 0.14em;
    color: #15140e;
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 12px 12px;
  }

  /* Tab picker — sits in the wide gutter, gives us one-click access to
     each menu. Editorial vertical list, no chrome. */
  .picker {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding-top: 24px;
  }
  .picker-h {
    font-family: "Inter", system-ui, sans-serif;
    font-size: 9.5px;
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: 0.14em;
    color: #8a8478;
    font-weight: 600;
    padding: 0 8px 6px;
  }
  .picker-btn {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 5px 10px;
    font-family: "Inter", system-ui, sans-serif;
    font-size: 13px;
    color: #4a463c;
    cursor: pointer;
    border-radius: 3px;
    text-align: left;
    transition: background 80ms ease, color 80ms ease;
  }
  .picker-btn:hover {
    background: rgba(21, 20, 14, 0.05);
    color: #15140e;
  }
  .picker-btn.active {
    background: #15140e;
    color: #faf7f0;
  }
</style>

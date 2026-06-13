<!--
  Settings Panel scaffold — renders the D21 redesign tabs (Variations /
  Labels / Identity + the interim figure band) STACKED in isolation
  against a fake-but-fully-resolved spec, so the visual design iterates
  without standing up a widget/table. 400px production width.
-->
<script lang="ts">
  import { tabviz } from "$authoring/tabviz";
  import { createTabvizStore } from "$stores/tabvizStore.svelte";
  import VariationsTab from "$components/ui/settings/VariationsTab.svelte";
  import LabelsTab from "$components/ui/settings/LabelsTab.svelte";
  import IdentityTab from "$components/ui/settings/IdentityTab.svelte";
  import FigureBand from "$components/ui/settings/FigureBand.svelte";
  import "$components/primitives/v2/tokens.css";

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
    theme: "nejm",
  });

  const store = createTabvizStore();
  store.setSpec(sampleSpec);
</script>

<div class="scaffold">
  <div class="panel" data-tv-v2>
    <VariationsTab {store} />
    <LabelsTab {store} />
    <IdentityTab {store} />
    <FigureBand {store} />
  </div>
</div>

<style>
  .scaffold {
    display: flex;
    justify-content: center;
    padding: 24px;
    background: #e8e6e1;
    min-height: 100vh;
  }
  .panel {
    width: 400px;
    background: var(--v2-paper, #faf7f0);
    border: 1px solid var(--v2-rule, #d6d0c1);
    overflow-y: auto;
    max-height: 90vh;
  }
</style>

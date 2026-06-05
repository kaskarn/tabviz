<!--
  Stage 3 — StudioChart.svelte
  Live chart rendering: mounts TabvizPlot bound to a tabvizStore whose
  spec.theme is replaced on every studioStore.inputs change.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { studioStore } from "./studio-store.svelte";
  import { createTabvizStore } from "../stores/tabvizStore.svelte";
  import { buildTheme } from "../lib/theme/theme-adapter";
  import TabvizPlot from "../svelte/TabvizPlot.svelte";
  import type { WebSpec } from "../types";
  import { inspectorStore } from "../stores/inspector-store.svelte";
  import { TOKENS_BY_VAR } from "../lib/theme/component-tokens";

  const { spec }: { spec: unknown } = $props();

  // The widget store fed to TabvizPlot. Initialized on mount with the
  // initial spec; spec.theme is replaced on every studioStore.inputs change.
  const store = createTabvizStore();
  let initialized = $state(false);

  onMount(() => {
    const initialSpec = spec as WebSpec;
    if (initialSpec) {
      store.setSpec(initialSpec);
      initialized = true;
    }
  });

  // Reactive: whenever studio inputs change, rebuild the theme and patch
  // spec. The read of `store.spec` is untracked — otherwise this effect
  // would re-trigger itself (it writes to store.spec via setSpec), creating
  // an infinite loop that hangs the main thread.
  $effect(() => {
    if (!initialized) return;
    if (!studioStore.inputs) return;
    const inputs = studioStore.inputs;
    const baseName = studioStore.baseName;
    untrack(() => {
      const currentSpec = store.spec;
      if (!currentSpec) return;
      try {
        const newTheme = buildTheme(inputs, baseName) as unknown as WebSpec["theme"];
        store.setSpec({ ...currentSpec, theme: newTheme });
      } catch (e) {
        console.warn("[StudioChart] buildTheme failed:", e);
      }
    });
  });
  // ── C15/C52 (wire-audit 4b): Alt+click-to-trace ─────────────────────
  // The lab's signature pedagogy: point at a painted element, see its
  // token light up through the cascade. Alt+click (not plain click) so
  // the widget's own interactions — paint, sort, collapse — keep working.
  //
  // DOM region → representative cssVar. Ordered specific → general; the
  // first selector matching an ancestor of the click target wins. Every
  // cssVar is VALIDATED against the manifest at module load so a token
  // rename breaks loudly here instead of rotting silently (C52 — this is
  // why the map lives next to TOKENS_BY_VAR, not hand-scattered through
  // 14 cell components).
  const TRACE_TARGETS: ReadonlyArray<readonly [string, string]> = [
    [".pvalue-stars", "--tv-ink2"],
    [".tv-caption-chip", "--tv-caption-chip-bg"],
    [".shell-strip", "--tv-brand-gradient"],
    [".plot-title", "--tv-text-title-family"],
    [".plot-subtitle", "--tv-text-subtitle-family"],
    [".header-cell", "--tv-header-bg"],
    [".plot-cell", "--tv-plot-axis-line"],
    [".primary-cell", "--tv-text"],
    [".data-cell", "--tv-row-base-bg"],
    [".tv-paper", "--tv-paper-bg"],
    [".tv-shell", "--tv-shell-bg"],
  ];
  for (const [sel, cssVar] of TRACE_TARGETS) {
    if (!TOKENS_BY_VAR.has(cssVar)) {
      throw new Error(
        `StudioChart TRACE_TARGETS: ${cssVar} (for ${sel}) is not in the ` +
        `component-tokens manifest — update the trace map.`,
      );
    }
  }

  function handleTraceClick(e: MouseEvent): void {
    if (!e.altKey) return;
    const resolved = studioStore.resolved;
    if (!resolved) return;
    const target = e.target as Element | null;
    if (!target) return;
    for (const [sel, cssVar] of TRACE_TARGETS) {
      if (target.closest(sel)) {
        e.preventDefault();
        e.stopPropagation();
        inspectorStore.trace(cssVar, resolved);
        return;
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="studio-chart" onclickcapture={handleTraceClick}
     title="Alt+click any element to trace its theme token">
  {#if initialized && store.spec}
    <TabvizPlot {store} />
  {:else}
    <p class="loading">Loading chart…</p>
  {/if}
</div>

<style>
  .studio-chart {
    overflow: auto;
    padding: 12px;
    background: #fafafa;
  }
  .loading {
    color: #94a3b8;
    font-style: italic;
    text-align: center;
    padding: 48px;
  }
</style>

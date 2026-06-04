<!--
  Stage 3 — StudioShell.svelte
  The studio gadget's root layout. Hosts:
  - Preset header strip (sticky top)
  - Settings rail (left, tab-organized)
  - Live chart canvas (center)
  - Inspector/Spine rail (right; visible when active)
  - Live R-snippet strip (sticky bottom)
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { studioStore } from "./studio-store.svelte";
  import PresetHeader from "./PresetHeader.svelte";
  import StudioChart from "./StudioChart.svelte";
  import SnippetStrip from "./SnippetStrip.svelte";
  import ThemeControlsStrip from "../components/theme-panel/ThemeControlsStrip.svelte";
  import CascadeView from "../components/theme-panel/CascadeView.svelte";
  import { buildSnippetSteps, formatSnippet } from "./snippet-generator";

  // Initial spec + theme come from data-* attributes on the mount element.
  const {
    initialSpec,
    initialTheme,
  }: {
    initialSpec: unknown;
    initialTheme: unknown;
  } = $props();

  onMount(() => {
    // Bootstrap the store from the initial inputs.
    const theme = initialTheme as { authoringInputs?: unknown; name?: string };
    const inputs = theme.authoringInputs as import("../types/theme-inputs").ThemeInputs | undefined;
    if (inputs) {
      const baseName = theme.name ?? "(default)";
      studioStore.init(inputs, baseName);
    }
    // Wire keyboard shortcuts (Cmd/Ctrl-Z undo, Shift redo).
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          studioStore.redo();
        } else {
          studioStore.undo();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The base R expression — `web_theme_<name>()` for known presets, or
  // a fallback for user-input themes.
  const baseExpression = $derived(buildBaseExpression(studioStore.baseName));

  function buildBaseExpression(name: string): string {
    // Match R-side preset constructors.
    const KNOWN: Record<string, string> = {
      cochrane: "web_theme_cochrane()",
      lancet: "web_theme_lancet()",
      jama: "web_theme_jama()",
      nejm: "web_theme_nejm()",
      nature: "web_theme_nature()",
      bmj: "web_theme_bmj()",
      dark: "web_theme_dark()",
      bauhaus: "web_theme_bauhaus()",
      swiss: "web_theme_swiss()",
      tufte: "web_theme_tufte()",
      newsprint: "web_theme_newsprint()",
      solarized: "web_theme_solarized()",
      solarized_dark: "web_theme_solarized_dark()",
      tonal: "web_theme_tonal()",
      tonal_dark: "web_theme_tonal_dark()",
      dwarven: "web_theme_dwarven()",
      elvish: "web_theme_elvish()",
      hobbit: "web_theme_hobbit()",
    };
    return KNOWN[name] ?? "your_theme";
  }

  const snippetText = $derived.by(() => {
    if (!studioStore.base || !studioStore.inputs) return baseExpression;
    const steps = buildSnippetSteps(studioStore.base, studioStore.inputs);
    return formatSnippet(baseExpression, steps);
  });

  function handleDone(): void {
    // Bridge to R via Shiny custom input. The serialized resolved theme
    // round-trips through the buildTheme TS → R deserializer.
    const win = window as unknown as { Shiny?: { setInputValue: (k: string, v: unknown, opts?: { priority?: string }) => void } };
    if (win.Shiny && studioStore.resolved) {
      // We pass back the serialized theme blob (the same shape R sent in).
      const serialized = JSON.stringify(studioStore.resolved);
      win.Shiny.setInputValue("studio_done", serialized, { priority: "event" });
    }
  }

  function handleCancel(): void {
    const win = window as unknown as { Shiny?: { setInputValue: (k: string, v: unknown, opts?: { priority?: string }) => void } };
    if (win.Shiny) {
      win.Shiny.setInputValue("studio_cancel", true, { priority: "event" });
    }
  }

  /** Static mode = no Shiny gadget host. Done/Cancel are hidden; Export is
   *  the primary egress. Detected once on mount (the value never changes
   *  during a session). */
  const isStatic = $derived(typeof window !== "undefined"
    && !(window as unknown as { Shiny?: unknown }).Shiny);
</script>

<div class="studio">
  <PresetHeader
    baseName={studioStore.baseName}
    dirty={studioStore.dirty}
    {isStatic}
    snippet={snippetText}
    onRevert={() => studioStore.revert()}
    onDone={handleDone}
    onCancel={handleCancel}
  />

  <div class="studio-main">
    {#if studioStore.inputs}
      <aside class="controls-rail">
        <ThemeControlsStrip
          inputs={studioStore.inputs}
          onchange={(next) => studioStore.apply(next, "Edit")}
        />
      </aside>
      <main class="cascade-main">
        <div class="live-preview">
          <StudioChart spec={initialSpec} />
        </div>
        <CascadeView
          inputs={studioStore.inputs}
          resolved={studioStore.resolved ?? undefined}
        />
      </main>
    {:else}
      <div class="theme-panel-placeholder">Loading theme…</div>
    {/if}
  </div>

  <SnippetStrip
    snippet={snippetText}
    canUndo={studioStore.cursor > 0}
    canRedo={studioStore.cursor < studioStore.history.length - 1}
    onUndo={() => studioStore.undo()}
    onRedo={() => studioStore.redo()}
  />
</div>

<style>
  .studio {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
    background: var(--studio-bg, #ffffff);
    color: var(--studio-fg, #1a1a1a);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
  }

  .studio-main {
    display: grid;
    grid-template-columns: minmax(320px, 380px) 1fr;
    overflow: hidden;
    min-height: 0;
    background: #ffffff;
  }
  .controls-rail {
    overflow-y: auto;
    border-right: 1px solid #e2e8f0;
    background: #ffffff;
  }
  .cascade-main {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: #ffffff;
    min-height: 0;
  }
  .live-preview {
    flex: 0 0 auto;
    height: min(560px, 50vh);
    border-bottom: 1px solid #e2e8f0;
    background: #fafafa;
    overflow: hidden;
  }
  .live-preview > :global(.studio-chart) {
    height: 100%;
  }
  .theme-panel-placeholder {
    padding: 24px;
    color: #475569;
    font-style: italic;
  }

  @media (max-width: 1000px) {
    .studio-main {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
    .controls-rail { border-right: 0; border-bottom: 1px solid #e2e8f0; }
  }
</style>

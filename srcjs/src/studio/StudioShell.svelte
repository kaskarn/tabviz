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
  import StudioRail from "./StudioRail.svelte";
  import PinsPanel from "./PinsPanel.svelte";
  import CascadeView from "../components/theme-panel/CascadeView.svelte";
  import { buildBaseExpression, buildPinSteps, buildRoleOverrideSteps, buildSnippetSteps, describeInputsEdit, formatSnippet } from "./snippet-generator";
  import { resolveTheme } from "../lib/theme/resolve-theme";
  import { createWire } from "../lib/theme/theme-wire";
  import { collectContrastFailures } from "../lib/theme/theme-validate";
  import type { ThemeInputs } from "../types/theme-inputs";

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
    const theme = initialTheme as {
      authoringInputs?: unknown;
      name?: string;
      roleOverrides?: Record<string, { ramp: string; grade: number }>;
      pins?: Record<string, string>;
    };
    const inputs = theme.authoringInputs as import("../types/theme-inputs").ThemeInputs | undefined;
    if (inputs) {
      const baseName = theme.name ?? "(default)";
      studioStore.init(inputs, baseName);
      // The handoff carries the WHOLE artifact (final review P2/DT-12):
      // an R-authored or imported theme arrives with roleOverrides/pins;
      // dropping them at studio entry made "Edit in studio" lossy for
      // exactly the themes that most need the studio.
      if (theme.roleOverrides && Object.keys(theme.roleOverrides).length > 0) {
        studioStore.roleOverrides = theme.roleOverrides as never;
      }
      if (theme.pins && Object.keys(theme.pins).length > 0) {
        studioStore.pins = theme.pins;
      }
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


  const snippetText = $derived.by(() => {
    if (!studioStore.base || !studioStore.inputs) return baseExpression;
    const steps = [
      ...buildSnippetSteps(studioStore.base, studioStore.inputs),
      // Spine rebinds ride the chain too — the snippet must reproduce
      // EVERYTHING the chart shows (P0 artifact honesty).
      ...buildRoleOverrideSteps(studioStore.roleOverrides),
      ...buildPinSteps(studioStore.pins),
    ];
    return formatSnippet(baseExpression, steps);
  });

  function handleDone(): void {
    // Bridge to R via Shiny custom input — the WIRE envelope
    // ({$schema, name, inputs, roleOverrides}), which R re-resolves via
    // resolve_from_inputs(). The old payload sent the ResolvedTheme blob
    // (cssVars/ramps/roles) — NOT the shape deserialize_resolved_theme
    // expects — and dropped roleOverrides entirely (P0 shipped bug).
    const win = window as unknown as { Shiny?: { setInputValue: (k: string, v: unknown, opts?: { priority?: string }) => void } };
    const wire = studioStore.exportWire();
    if (win.Shiny && wire) {
      win.Shiny.setInputValue("studio_done", JSON.stringify(wire), { priority: "event" });
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

  // ── Edit commit with descriptive history label (studio E) ───────────
  // Diff against the last COMMITTED snapshot, not the working copy —
  // slider flows preview-update `inputs` during the drag, so a diff
  // against the working copy at commit time would always be empty.
  function commitEdit(next: ThemeInputs, label?: string): void {
    const committed = studioStore.history[studioStore.cursor]?.inputs ?? studioStore.inputs;
    const resolvedLabel = label ?? (committed ? describeInputsEdit(committed, next) : "Edit");
    studioStore.apply(next, resolvedLabel);
    if (label === "Match brand") {
      flashToast("Hues aligned toward brand — ⌘Z to undo");
    }
  }

  // Lightweight studio-level toast (compound moves like Match brand used
  // to commit with zero feedback — studio E).
  let toastMsg = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  function flashToast(msg: string): void {
    toastMsg = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastMsg = null), 2400);
  }

  // ── Validate matrix (studio E — promote the ResilienceTriptych idea
  // to the REAL chart): polarity × mode grid of the current edits, each
  // cell with its own live contrast verdict. ──────────────────────────
  let validateOpen = $state(false);
  const VALIDATE_CELLS = [
    { key: "light-std", label: "Light · Standard", overrides: { polarity: "light", mode: "standard" } },
    { key: "dark-std",  label: "Dark · Standard",  overrides: { polarity: "dark",  mode: "standard" } },
    { key: "light-hc",  label: "Light · High contrast", overrides: { polarity: "light", mode: "high-contrast" } },
    { key: "dark-hc",   label: "Dark · High contrast",  overrides: { polarity: "dark",  mode: "high-contrast" } },
  ] as const;

  const validateVerdicts = $derived.by<Record<string, number | null>>(() => {
    const out: Record<string, number | null> = {};
    if (!validateOpen || !studioStore.inputs) return out;
    for (const cell of VALIDATE_CELLS) {
      try {
        const merged = { ...studioStore.inputs, ...cell.overrides } as ThemeInputs;
        const resolved = resolveTheme({
          ...createWire(merged, studioStore.baseName),
          roleOverrides: studioStore.roleOverrides,
        });
        out[cell.key] = collectContrastFailures(
          resolved.cssVars as Record<string, string>,
        ).length;
      } catch {
        out[cell.key] = null; // resolve failed — shown as "—"
      }
    }
    return out;
  });
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
        <StudioRail
          onchange={commitEdit}
          onpreview={(next) => studioStore.preview(next)}
        />
        <PinsPanel />
      </aside>
      <main class="cascade-main">
        {#if studioStore.resolveError}
          <!-- Resolve error boundary (Pass 0d-ii): the current inputs fail
               to resolve; the preview below renders the last GOOD
               resolution instead of white-screening (B3 hardening). -->
          <div class="resolve-error-banner" role="alert">
            Theme failed to resolve — showing the last working state.
            <code>{studioStore.resolveError}</code>
          </div>
        {/if}
        {#if studioStore.contrastWarnings.length > 0}
          <!-- Non-blocking contrast banner: the chart renders the failing
               theme (the author needs to SEE the problem) but the failure
               is named instead of silent (R3 studio UX F1 — paper L=0
               produced an unreadable chart with zero feedback). -->
          <div class="contrast-warn-banner" role="status">
            ⚠ Contrast check: {studioStore.contrastWarnings[0]}{studioStore.contrastWarnings.length > 1 ? ` (+${studioStore.contrastWarnings.length - 1} more)` : ""}
          </div>
        {/if}
        <div class="preview-bar">
          <!-- Trace discoverability (studio E): the Alt+click pedagogy
               existed but nothing announced it. -->
          <span class="trace-chip">⌥-click any chart element to trace its token</span>
          <button
            type="button"
            class="validate-toggle"
            class:on={validateOpen}
            onclick={() => (validateOpen = !validateOpen)}
            title="Render the current edits under all polarity × contrast modes"
          >{validateOpen ? "Single view" : "Validate ▦"}</button>
        </div>
        {#if validateOpen}
          <div class="validate-matrix">
            {#each VALIDATE_CELLS as cell (cell.key)}
              {@const n = validateVerdicts[cell.key]}
              <div class="validate-cell">
                <div class="validate-cell-head">
                  <span>{cell.label}</span>
                  {#if n == null}
                    <span class="v-bad">resolve failed</span>
                  {:else if n > 0}
                    <span class="v-bad">⚠ {n} contrast</span>
                  {:else}
                    <span class="v-ok">✓ contrast</span>
                  {/if}
                </div>
                <div class="validate-chart">
                  <StudioChart spec={initialSpec} overrides={cell.overrides} />
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="live-preview">
            <StudioChart spec={initialSpec} />
          </div>
        {/if}
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
    undoLabel={studioStore.cursor > 0 ? studioStore.history[studioStore.cursor]?.label : undefined}
    redoLabel={studioStore.cursor < studioStore.history.length - 1 ? studioStore.history[studioStore.cursor + 1]?.label : undefined}
    onUndo={() => studioStore.undo()}
    onRedo={() => studioStore.redo()}
  />

  {#if toastMsg}
    <div class="studio-toast" role="status">{toastMsg}</div>
  {/if}
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
  .contrast-warn-banner {
    margin: 0 0 10px;
    padding: 7px 12px;
    border-radius: 6px;
    font-size: 12px;
    background: color-mix(in srgb, #d97706 12%, var(--tp-bg, #fff));
    border: 1px solid color-mix(in srgb, #d97706 35%, transparent);
    color: var(--tp-fg, #1c1a17);
  }

  .resolve-error-banner {
    flex: 0 0 auto;
    margin: 8px 12px 0;
    padding: 8px 12px;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    background: #fef2f2;
    color: #991b1b;
    font-size: 12px;
  }
  .resolve-error-banner code {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: #7f1d1d;
    word-break: break-word;
  }
  .preview-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 12px;
    border-bottom: 1px solid #f1f5f9;
    background: #fcfcfc;
  }
  .trace-chip {
    font-size: 11px;
    color: #64748b;
    background: #f1f5f9;
    border-radius: 999px;
    padding: 2px 10px;
  }
  .validate-toggle {
    font-size: 11.5px;
    padding: 3px 10px;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    background: #fff;
    color: #334155;
    cursor: pointer;
  }
  .validate-toggle:hover { background: #f1f5f9; }
  .validate-toggle.on {
    background: #1e293b;
    color: #fff;
    border-color: #1e293b;
  }
  .validate-matrix {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid #e2e8f0;
    background: #fafafa;
  }
  .validate-cell {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
    background: #fff;
    display: flex;
    flex-direction: column;
  }
  .validate-cell-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
  }
  .v-ok  { color: #15803d; font-weight: 500; }
  .v-bad { color: #b45309; font-weight: 500; }
  .validate-chart {
    height: 260px;
    overflow: hidden;
  }
  .validate-chart > :global(.studio-chart) {
    height: 100%;
    transform: scale(0.75);
    transform-origin: top left;
    width: 133.4%;
  }
  .studio-toast {
    position: fixed;
    bottom: 56px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 14px;
    background: #1a1a1a;
    color: #fff;
    border-radius: 6px;
    font-size: 12.5px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 100;
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

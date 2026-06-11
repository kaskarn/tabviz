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
  import RoleSpine from "../components/spine/RoleSpine.svelte";
  import CascadeView from "../components/theme-panel/CascadeView.svelte";
  import { buildBaseExpression, buildPinSteps, buildRoleOverrideSteps, buildSnippetSteps, describeInputsEdit, formatSnippet } from "./snippet-generator";
  import { resolveTheme } from "../lib/theme/resolve-theme";
  import type { WebTheme } from "../types/theme-resolved";
  import { createWire } from "../lib/theme/theme-wire";
  import { collectContrastFailures } from "../lib/theme/theme-validate";
  import { applyTokenPins } from "../lib/theme/consumer-bridge";
  import { TOKENS_BY_VAR } from "../lib/theme/component-tokens";
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
    const theme = initialTheme as WebTheme | null;
    const inputs = theme?.authoringInputs;
    if (inputs) {
      const baseName = theme?.name ?? "(default)";
      // The handoff carries the WHOLE artifact (final review P2/DT-12):
      // an R-authored or imported theme arrives with roleOverrides/pins.
      // Seed them THROUGH init so history[0] captures them (round-2 state
      // review P1: post-init assignment left the base step empty, so the
      // first undo wiped the seeded pins/rebinds).
      studioStore.init(inputs, baseName, {
        roleOverrides: theme?.roleOverrides ?? {},
        pins: theme?.pins ?? {},
        components: theme?.components ?? {},
      });
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
    const pins = studioStore.pins;
    const hasPins = Object.keys(pins).length > 0;
    for (const cell of VALIDATE_CELLS) {
      try {
        const merged = { ...studioStore.inputs, ...cell.overrides } as ThemeInputs;
        const resolved = resolveTheme({
          ...createWire(merged, studioStore.baseName),
          roleOverrides: studioStore.roleOverrides,
        });
        // Judge the PINNED values under each cell's mode — pins on
        // mode-gated tokens drop under high-contrast (the paint-layer
        // ratchet, Wave 0), so the verdict reflects what actually paints.
        const cssVars = hasPins
          ? applyTokenPins({ ...(resolved.cssVars as Record<string, string>) }, pins, merged.mode)
          : (resolved.cssVars as Record<string, string>);
        out[cell.key] = collectContrastFailures(cssVars).length;
      } catch {
        out[cell.key] = null; // resolve failed — shown as "—"
      }
    }
    return out;
  });

  // ── Pin governance surface (theme-rework Wave 1) ────────────────────
  // Pins bypass the cascade — "last resort". Count them, and flag the
  // subset that DROP under high-contrast (token.modes.hc), so the author
  // sees the accessibility cost before shipping. The drop itself happens
  // at paint (consumer-bridge applyTokenPins); this is the lint on top.
  const pinCount = $derived(Object.keys(studioStore.pins).length);
  const pinsDroppedUnderHc = $derived(
    Object.keys(studioStore.pins).filter(
      (v) => TOKENS_BY_VAR.get(v)?.modes?.hc != null,
    ).length,
  );
</script>

<div class="studio" data-tv-v2>
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
        {#if studioStore.resolved}
          <!-- Tier-2 role rebind surface (theme-rework Wave 1): the spine
               was fully store-wired but never mounted. It speaks role
               NAMES; the exported wire serializes the rebind as a name
               alias (Wave 0) — DTCG-shaped + rename-migratable (not
               re-tune-proof; see lib/theme/alias.ts header). -->
          <div class="spine-host">
            <div class="spine-host-head">
              <span>Role spine</span>
              <span class="spine-host-hint">drag or arrow-key a role to rebind · ⌫ resets</span>
            </div>
            <RoleSpine resolved={studioStore.resolved} />
          </div>
        {/if}
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
        {#if pinCount > 0}
          <!-- Pins-are-last-resort banner (theme-rework Wave 1): a pinned
               token bypasses the cascade and may not respond to polarity
               / high-contrast. Name the cost; the studio still ships it. -->
          <div class="pins-warn-banner" role="status">
            📌 This theme has {pinCount} hardcoded pin{pinCount > 1 ? "s" : ""} — pinned tokens bypass the cascade and may not respond to polarity / theme edits.{pinsDroppedUnderHc > 0 ? ` ${pinsDroppedUnderHc} drop under high-contrast.` : ""}
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
                  {#if cell.overrides.mode === "high-contrast" && pinsDroppedUnderHc > 0}
                    <span class="v-bad" title="Pins on mode-gated tokens drop under high-contrast">📌 {pinsDroppedUnderHc} dropped</span>
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
          liveSpine
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
    /* Editorial studio token layer (UX redesign A0). The studio rail lives
       OUTSIDE the widget DOM and can't inherit --tv-*, so the studio chrome
       reads the v2 control palette (the .studio root carries [data-tv-v2], so
       --v2-* resolve here to their warm-cream fallbacks). Single-sourced onto
       --v2-* — no more parallel near-duplicate literals (#ddd7c9 vs #d6d0c1).
       The verdict colors (good/warn/bad/pins) have no v2 twin, so they stay
       literal. Fallbacks preserve the original skin if v2 ever fails to load. */
    --studio-bg: var(--v2-paper, #fbf9f3);              /* warm paper chrome */
    --studio-surface: var(--v2-paper-edge, #ffffff);    /* chart / card surface */
    --studio-paper-2: var(--v2-paper-2, #f3efe5);       /* recessed bands */
    --studio-fg: var(--v2-ink, #15140e);                /* warm ink */
    --studio-fg-2: var(--v2-ink-2, #4a463c);            /* secondary ink */
    --studio-fg-3: var(--v2-ink-3, #8a8478);            /* muted */
    --studio-rule: var(--v2-rule, #ddd7c9);             /* hairline */
    --studio-rule-soft: var(--v2-rule-soft, #ece7da);
    --studio-rule-strong: var(--v2-rule-strong, #15140e);
    --studio-font: var(--v2-font-sans, "Inter Tight", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    --studio-good: #2f7d4f;
    --studio-warn: #b07314;        /* amber ink (verdict / contrast) */
    --studio-warn-tint: #f6ecd6;
    --studio-bad: #a23b2e;
    --studio-bad-tint: #fbeae6;
    --studio-bad-ink: #7a2118;
    --studio-pins: #6b4fb0;
    --studio-pins-tint: #efeaf8;
    --studio-pins-ink: #4c2889;

    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
    background: var(--studio-bg);
    color: var(--studio-fg);
    font-family: var(--studio-font);
    font-size: 13px;
  }

  .studio-main {
    display: grid;
    grid-template-columns: minmax(320px, 380px) 1fr;
    overflow: hidden;
    min-height: 0;
    background: var(--studio-surface);
  }
  .controls-rail {
    overflow-y: auto;
    border-right: 1px solid var(--studio-rule);
    background: var(--studio-bg);
  }
  .cascade-main {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: var(--studio-surface);
    min-height: 0;
  }
  .contrast-warn-banner {
    margin: 0 0 10px;
    padding: 7px 12px;
    border-radius: 6px;
    font-size: 12px;
    background: var(--studio-warn-tint);
    border: 1px solid color-mix(in srgb, var(--studio-warn) 35%, transparent);
    color: var(--studio-warn);
  }
  .pins-warn-banner {
    margin: 8px 12px 0;
    padding: 7px 12px;
    border-radius: 6px;
    font-size: 12px;
    background: var(--studio-pins-tint);
    border: 1px solid color-mix(in srgb, var(--studio-pins) 30%, transparent);
    color: var(--studio-pins-ink);
  }
  .spine-host {
    border-top: 1px solid var(--studio-rule);
    padding: 8px 12px 12px;
  }
  .spine-host-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .spine-host-head > span:first-child {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--studio-fg-2);
  }
  .spine-host-hint {
    font-size: 10.5px;
    color: var(--studio-fg-3);
  }

  .resolve-error-banner {
    flex: 0 0 auto;
    margin: 8px 12px 0;
    padding: 8px 12px;
    border: 1px solid color-mix(in srgb, var(--studio-bad) 40%, transparent);
    border-radius: 6px;
    background: var(--studio-bad-tint);
    color: var(--studio-bad-ink);
    font-size: 12px;
  }
  .resolve-error-banner code {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: var(--studio-bad-ink);
    word-break: break-word;
  }
  .preview-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 12px;
    border-bottom: 1px solid var(--studio-rule-soft);
    background: var(--studio-paper-2);
  }
  .trace-chip {
    font-size: 11px;
    color: var(--studio-fg-3);
    background: var(--studio-paper-2);
    border-radius: 999px;
    padding: 2px 10px;
  }
  .validate-toggle {
    font-size: 11.5px;
    padding: 3px 10px;
    border: 1px solid var(--studio-rule);
    border-radius: 5px;
    background: var(--studio-surface);
    color: var(--studio-fg-2);
    cursor: pointer;
  }
  .validate-toggle:hover { background: var(--studio-paper-2); }
  .validate-toggle.on {
    background: var(--studio-rule-strong);
    color: var(--studio-bg);
    border-color: var(--studio-rule-strong);
  }
  .validate-matrix {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--studio-rule);
    background: var(--studio-paper-2);
  }
  .validate-cell {
    border: 1px solid var(--studio-rule);
    border-radius: 6px;
    overflow: hidden;
    background: var(--studio-surface);
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
    color: var(--studio-fg-2);
    border-bottom: 1px solid var(--studio-rule-soft);
  }
  .v-ok  { color: var(--studio-good); font-weight: 500; }
  .v-bad { color: var(--studio-warn); font-weight: 500; }
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
    background: var(--studio-fg);
    color: var(--studio-bg);
    border-radius: 6px;
    font-size: 12.5px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 100;
  }

  .live-preview {
    flex: 0 0 auto;
    height: min(560px, 50vh);
    border-bottom: 1px solid var(--studio-rule);
    background: var(--studio-paper-2);
    overflow: hidden;
  }
  .live-preview > :global(.studio-chart) {
    height: 100%;
  }
  .theme-panel-placeholder {
    padding: 24px;
    color: var(--studio-fg-2);
    font-style: italic;
  }

  @media (max-width: 1000px) {
    .studio-main {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
    .controls-rail { border-right: 0; border-bottom: 1px solid var(--studio-rule); }
  }
</style>

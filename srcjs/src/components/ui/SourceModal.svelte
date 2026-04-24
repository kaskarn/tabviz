<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import { generateThemeSource } from "$lib/theme-source";
  import Portal from "$lib/Portal.svelte";

  interface Props {
    store: ForestStore;
    open: boolean;
    onclose: () => void;
  }

  let { store, open, onclose }: Props = $props();

  type Tab = "table" | "theme" | "combined";
  let activeTab = $state<Tab>("combined");

  // ---- Theme snapshot (re-uses the v0.19 path) -----------------------
  const themeSource = $derived.by(() => {
    const edits = { ...store.themeEdits };
    const bo = store.bandingOverride;
    if (bo) {
      const bandingStr =
        bo.mode === "none"
          ? "none"
          : bo.mode === "row"
            ? "row"
            : bo.level == null
              ? "group"
              : `group-${bo.level}`;
      edits.layout = { ...(edits.layout ?? {}), banding: bandingStr };
    }
    const code = generateThemeSource(store.baseThemeName, edits);
    const phaseOverride = store.bandingStartsWithBandOverride;
    if (phaseOverride !== null && bo && bo.mode !== "none") {
      const note = phaseOverride
        ? "# Phase override (UI only): banding starts with the band (BABA)."
        : "# Phase override (UI only): banding starts blank (ABAB).";
      return `${code}\n${note}`;
    }
    return code;
  });

  // ---- Table ops (from the recorded log) -----------------------------
  //
  // Baseline: the user's original `tabviz(...)` call if captured.
  // Fallback: a placeholder `widget` the user fills in themselves.
  const originalCall = $derived(store.spec?.originalCall);
  const baselineVar = "tbl";

  /** Extract the fluent-R lines from the recorded log, indented for a pipe. */
  const tableOpsBody = $derived.by(() => {
    const log = store.opLog;
    if (log.length === 0) return "";
    return log.map((r) => `  ${r.rCall}`).join(" |>\n");
  });

  const tableSource = $derived.by(() => {
    const baseline = originalCall
      ? `${baselineVar} <- ${originalCall}`
      : `${baselineVar} <- tabviz(...)`;
    if (!tableOpsBody) {
      return `# No recorded operations yet.\n${baseline}`;
    }
    return `${baseline} |>\n${tableOpsBody}`;
  });

  // ---- Combined (theme assigned, then table ops applied) -------------
  //
  // Format (per user's spec):
  //   mytheme <- <theme chain>
  //   tbl <- tabviz(..., theme = mytheme) |> <ops>
  //
  // If originalCall already specifies `theme = ...`, replace it with
  // `theme = mytheme`. Otherwise append `, theme = mytheme` inside the
  // outermost `tabviz(...)`. The replacement is a regex — we accept the
  // "mess in, mess out" contract the user stated.
  function injectTheme(call: string, themeVar: string): string {
    if (/\btheme\s*=/.test(call)) {
      return call.replace(/\btheme\s*=\s*[^,)]+/, `theme = ${themeVar}`);
    }
    // Insert before the final ')'. Trim trailing whitespace to avoid
    // `tabviz(x, ) )` shapes.
    const m = call.match(/\)\s*$/);
    if (!m) return `${call}  # (could not inject theme)`;
    const cut = call.lastIndexOf(")");
    return `${call.slice(0, cut).trimEnd()}, theme = ${themeVar})`;
  }

  const combinedSource = $derived.by(() => {
    const themeLine = `mytheme <- ${themeSource}`;
    const call = originalCall ?? "tabviz(...)";
    const withTheme = injectTheme(call, "mytheme");
    const tblLine = tableOpsBody
      ? `${baselineVar} <- ${withTheme} |>\n${tableOpsBody}`
      : `${baselineVar} <- ${withTheme}`;
    return `${themeLine}\n\n${tblLine}`;
  });

  // ---- Active tab content --------------------------------------------
  const activeSource = $derived.by(() => {
    if (activeTab === "table") return tableSource;
    if (activeTab === "theme") return themeSource;
    return combinedSource;
  });

  // ---- Copy to clipboard ---------------------------------------------
  let copied = $state(false);
  let copyTimer: number | undefined;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(activeSource);
      copied = true;
      if (copyTimer) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => (copied = false), 1600);
    } catch (err) {
      console.error("Failed to copy source:", err);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <Portal>
    <div class="source-modal" role="dialog" aria-modal="true" aria-label="View source">
      <button
        type="button"
        class="modal-backdrop"
        aria-label="Close"
        tabindex="-1"
        onclick={onclose}
      ></button>

      <div class="modal-card">
        <header class="card-header">
          <div class="title-block">
            <h3>View source</h3>
            <p class="sub">Paste this into R to reproduce the current widget.</p>
          </div>
          <button type="button" class="close" aria-label="Close" onclick={onclose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div class="tab-bar" role="tablist">
          <button
            type="button"
            class="tab"
            class:active={activeTab === "table"}
            role="tab"
            aria-selected={activeTab === "table"}
            onclick={() => (activeTab = "table")}
          >
            Table ops
          </button>
          <button
            type="button"
            class="tab"
            class:active={activeTab === "theme"}
            role="tab"
            aria-selected={activeTab === "theme"}
            onclick={() => (activeTab = "theme")}
          >
            Theme
          </button>
          <button
            type="button"
            class="tab"
            class:active={activeTab === "combined"}
            role="tab"
            aria-selected={activeTab === "combined"}
            onclick={() => (activeTab = "combined")}
          >
            Combined
          </button>
        </div>

        <pre class="code"><code>{activeSource}</code></pre>

        <footer class="card-footer">
          <button type="button" class="copy-btn" onclick={copyToClipboard}>
            {#if copied}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            {/if}
          </button>
        </footer>
      </div>
    </div>
  </Portal>
{/if}

<style>
  .source-modal {
    position: fixed;
    inset: 0;
    z-index: 10050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .modal-backdrop {
    position: absolute;
    inset: 0;
    z-index: 1;
    border: none;
    padding: 0;
    background: color-mix(in srgb, #0f172a 35%, transparent);
    cursor: pointer;
    animation: backdrop-in 0.18s ease;
  }

  .modal-card {
    position: relative;
    z-index: 2;
    pointer-events: auto;
    width: min(640px, 100%);
    max-height: min(82vh, 760px);
    display: flex;
    flex-direction: column;
    background: var(--wf-bg, #ffffff);
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    border-radius: 12px;
    box-shadow:
      0 24px 48px -12px color-mix(in srgb, #0f172a 35%, transparent),
      0 4px 12px -4px color-mix(in srgb, var(--wf-primary, #2563eb) 25%, transparent);
    animation: card-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes card-in {
    from { transform: translateY(10px) scale(0.98); opacity: 0; }
    to   { transform: translateY(0)    scale(1);    opacity: 1; }
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px 8px;
  }

  .title-block h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--wf-fg, #1a1a1a);
  }

  .title-block .sub {
    margin: 2px 0 0 0;
    font-size: 0.75rem;
    color: var(--wf-secondary, #64748b);
  }

  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .close:hover {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 10%, transparent);
    color: var(--wf-fg, #1a1a1a);
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 0 14px;
    border-bottom: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
  }

  .tab {
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: var(--wf-secondary, #64748b);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .tab:hover {
    color: var(--wf-fg, #1a1a1a);
  }

  .tab.active {
    color: var(--wf-primary, #2563eb);
    border-bottom-color: var(--wf-primary, #2563eb);
  }

  .code {
    margin: 0;
    padding: 14px 18px;
    flex: 1;
    min-height: 0;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    line-height: 1.55;
    color: var(--wf-fg, #1a1a1a);
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 5%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
    white-space: pre;
  }

  .card-footer {
    display: flex;
    justify-content: flex-end;
    padding: 10px 14px;
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 18%, var(--wf-border, #e2e8f0));
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--wf-primary, #2563eb);
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 6%, var(--wf-bg, #ffffff));
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .copy-btn:hover {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 14%, var(--wf-bg, #ffffff));
    border-color: color-mix(in srgb, var(--wf-primary, #2563eb) 35%, transparent);
  }
</style>

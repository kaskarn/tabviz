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

  /**
   * Merge banding overrides into the edits map for export. `bandingOverride`
   * is UI state (runtime toggles), but from the user's mental model it *is*
   * part of their customizations — so we fold it into the `layout` section
   * of the emitted R chain. The ABAB/BABA phase is deliberately omitted: it
   * has no R equivalent yet, so we emit a trailing comment note instead.
   */
  const source = $derived.by(() => {
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

  let copied = $state(false);
  let copyTimer: number | undefined;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(source);
      copied = true;
      if (copyTimer) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => (copied = false), 1600);
    } catch (err) {
      console.error("Failed to copy theme source:", err);
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
    <div class="theme-source-modal" role="dialog" aria-modal="true" aria-label="Theme source">
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
            <h3>Theme source</h3>
            <p class="sub">Paste this into R to reproduce the current look.</p>
          </div>
          <button type="button" class="close" aria-label="Close" onclick={onclose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <pre class="code"><code>{source}</code></pre>

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
  .theme-source-modal {
    position: fixed;
    inset: 0;
    z-index: 10050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  /* Explicit z-index + pointer-events so host-page stylesheets can't
     push the backdrop above the card. See ConfirmDialog for the same
     pattern and rationale. */
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
    width: min(560px, 100%);
    max-height: min(80vh, 720px);
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
    padding: 16px 18px 10px;
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
    border-top: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
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

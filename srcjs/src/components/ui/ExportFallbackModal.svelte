<!--
  ExportFallbackModal — surrogate for the download button when the host
  environment silently blocks `<a download>` (VSCode webview, sandboxed
  iframes without `allow-downloads`). The button still does *something*:
  the user gets the SVG source or a PNG preview they can copy/save manually,
  plus a one-line pointer at the scripted R path (`save_plot()`).

  Mirrors ConfirmDialog.svelte conventions: portal, z-index 10060, Esc to
  close, focus trap-light (autofocus primary action, restore on close).
-->
<script lang="ts">
  import Portal from "$lib/Portal.svelte";

  interface Props {
    open: boolean;
    /** "svg" shows source in textarea; "png" shows preview + ClipboardItem write. */
    format: "svg" | "png";
    /** SVG source string (format="svg") or PNG blob (format="png"). */
    payload: string | Blob;
    filename: string;
    onclose: () => void;
  }

  const { open, format, payload, filename, onclose }: Props = $props();

  let primaryRef = $state<HTMLButtonElement | null>(null);
  let lastFocused: Element | null = null;

  $effect(() => {
    if (open) {
      lastFocused = document.activeElement;
      queueMicrotask(() => primaryRef?.focus());
    } else if (lastFocused instanceof HTMLElement) {
      lastFocused.focus();
      lastFocused = null;
    }
  });

  // PNG preview: build object URL when blob arrives, revoke on close/change.
  let pngUrl = $state<string | null>(null);
  $effect(() => {
    if (open && format === "png" && payload instanceof Blob) {
      const url = URL.createObjectURL(payload);
      pngUrl = url;
      return () => {
        URL.revokeObjectURL(url);
        pngUrl = null;
      };
    }
  });

  let copyState = $state<"idle" | "copied" | "failed">("idle");

  async function copySvgText() {
    if (typeof payload !== "string") return;
    try {
      await navigator.clipboard.writeText(payload);
      copyState = "copied";
    } catch {
      // Older webviews block navigator.clipboard; fall back to execCommand.
      const ta = document.createElement("textarea");
      ta.value = payload;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      copyState = ok ? "copied" : "failed";
    }
    setTimeout(() => (copyState = "idle"), 1800);
  }

  async function copyPngImage() {
    if (!(payload instanceof Blob)) return;
    const w = window as unknown as { ClipboardItem?: typeof ClipboardItem };
    if (typeof w.ClipboardItem !== "function" || !navigator.clipboard?.write) {
      copyState = "failed";
      setTimeout(() => (copyState = "idle"), 1800);
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": payload })]);
      copyState = "copied";
    } catch {
      copyState = "failed";
    }
    setTimeout(() => (copyState = "idle"), 1800);
  }

  function openInNewTab() {
    if (payload instanceof Blob) {
      const url = URL.createObjectURL(payload);
      // VSCode webview will block this; harmless when it does.
      window.open(url, "_blank");
      // Don't revoke immediately — the new tab needs the URL alive.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      const blob = new Blob([payload], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }

  const title = $derived(format === "svg" ? "Copy SVG" : "Copy PNG");
  const hint = $derived(
    format === "svg"
      ? "Your viewer blocks direct downloads. Copy the SVG source or open it in a new tab."
      : "Your viewer blocks direct downloads. Copy the image to your clipboard or open it in a new tab.",
  );
  const copyLabel = $derived(
    copyState === "copied"
      ? "Copied"
      : copyState === "failed"
        ? "Copy failed"
        : format === "svg"
          ? "Copy SVG source"
          : "Copy image",
  );
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <Portal>
    <div class="export-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        class="modal-backdrop"
        aria-label="Close"
        tabindex="-1"
        onclick={onclose}
      ></button>

      <div class="modal-card">
        <h3>{title}</h3>
        <p class="hint">{hint}</p>

        {#if format === "svg" && typeof payload === "string"}
          <textarea readonly class="svg-source" rows="6" value={payload}></textarea>
        {:else if format === "png" && pngUrl}
          <div class="png-preview">
            <img src={pngUrl} alt="Plot preview" />
          </div>
        {/if}

        <p class="r-hint">
          Or run <code>save_plot(x, "{filename}")</code> in R for direct file output.
        </p>

        <div class="actions">
          <button type="button" class="ghost-btn" onclick={openInNewTab}>
            Open in new tab
          </button>
          <button
            type="button"
            class="primary-btn"
            bind:this={primaryRef}
            onclick={format === "svg" ? copySvgText : copyPngImage}
          >
            {copyLabel}
          </button>
          <button type="button" class="ghost-btn" onclick={onclose}>
            Close
          </button>
        </div>
      </div>
    </div>
  </Portal>
{/if}

<style>
  .export-modal {
    position: fixed;
    inset: 0;
    z-index: 10060;
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
    width: min(520px, 100%);
    padding: 18px 20px;
    background: var(--tv-surface-bg, #ffffff);
    border: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 15%, var(--tv-border, #e2e8f0));
    border-radius: 12px;
    box-shadow:
      0 24px 48px -12px color-mix(in srgb, #0f172a 35%, transparent),
      0 4px 12px -4px color-mix(in srgb, var(--tv-accent, #2563eb) 25%, transparent);
    animation: card-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes card-in {
    from { transform: translateY(8px) scale(0.98); opacity: 0; }
    to   { transform: translateY(0)   scale(1);    opacity: 1; }
  }

  h3 {
    margin: 0 0 6px 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--tv-text, #1a1a1a);
  }

  .hint {
    margin: 0 0 12px 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--tv-text-muted, #64748b);
  }

  .svg-source {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--tv-text, #1a1a1a);
    background: color-mix(in srgb, var(--tv-border, #e2e8f0) 30%, transparent);
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    resize: vertical;
  }

  .png-preview {
    display: flex;
    justify-content: center;
    padding: 8px;
    background: color-mix(in srgb, var(--tv-border, #e2e8f0) 30%, transparent);
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
  }

  .png-preview img {
    max-width: 100%;
    max-height: 220px;
    height: auto;
  }

  .r-hint {
    margin: 12px 0 16px 0;
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--tv-text-muted, #64748b);
  }

  .r-hint code {
    padding: 1px 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8em;
    color: var(--tv-text, #1a1a1a);
    background: color-mix(in srgb, var(--tv-border, #e2e8f0) 50%, transparent);
    border-radius: 4px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .ghost-btn,
  .primary-btn {
    padding: 6px 14px;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .ghost-btn {
    border: 1px solid color-mix(in srgb, var(--tv-border, #e2e8f0) 80%, transparent);
    background: transparent;
    color: var(--tv-text-muted, #64748b);
  }

  .ghost-btn:hover {
    color: var(--tv-text, #1a1a1a);
    border-color: color-mix(in srgb, var(--tv-accent, #2563eb) 20%, var(--tv-border, #e2e8f0));
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 6%, transparent);
  }

  .primary-btn {
    border: 1px solid transparent;
    background: var(--tv-accent, #2563eb);
    color: var(--tv-surface-bg, #ffffff);
  }

  .primary-btn:hover {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 90%, #000000);
  }

  .primary-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--tv-accent, #2563eb) 50%, transparent);
    outline-offset: 2px;
  }
</style>

<!--
  Stage 3 — SnippetStrip.svelte
  Sticky bottom band: live R-modifier pipe chain, undo/redo buttons,
  copy-to-clipboard.
-->
<script lang="ts">
  const {
    snippet,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    onUndo,
    onRedo,
  }: {
    snippet: string;
    canUndo: boolean;
    canRedo: boolean;
    /** History-step labels so the buttons say WHAT they would undo/redo
     *  ("Undo Brand", not just "Undo") — studio E. */
    undoLabel?: string;
    redoLabel?: string;
    onUndo: () => void;
    onRedo: () => void;
  } = $props();

  let copied = $state(false);
  let copyTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  async function copyAll(): Promise<void> {
    try {
      await navigator.clipboard.writeText(snippet);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard write failed — silently swallow; fallback could prompt.
    }
  }

  let expanded = $state(false);
</script>

<footer class="snippet-strip" class:expanded>
  <button
    type="button"
    class="snippet"
    onclick={copyAll}
    title="Click to copy"
    aria-label="Copy R snippet to clipboard"
  >
    <code>{snippet}</code>
  </button>

  <div class="controls">
    <button type="button" onclick={onUndo} disabled={!canUndo}
            title={undoLabel ? `Undo ${undoLabel} (⌘Z)` : "Undo (⌘Z)"}
            aria-label={undoLabel ? `Undo ${undoLabel}` : "Undo"}>↶</button>
    <button type="button" onclick={onRedo} disabled={!canRedo}
            title={redoLabel ? `Redo ${redoLabel} (⇧⌘Z)` : "Redo (⇧⌘Z)"}
            aria-label={redoLabel ? `Redo ${redoLabel}` : "Redo"}>↷</button>
    <button type="button" onclick={() => (expanded = !expanded)}
            title={expanded ? "Collapse snippet" : "Expand snippet to full multi-line view"}
            aria-label={expanded ? "Collapse snippet" : "Expand snippet"}
            aria-expanded={expanded}>
      {expanded ? "⌃" : "⌄"}
    </button>
    <button type="button" onclick={copyAll} title="Copy snippet"
            aria-label={copied ? "Snippet copied" : "Copy snippet"}>
      {copied ? "✓" : "📋"}
    </button>
  </div>
</footer>

<style>
  .snippet-strip {
    display: flex;
    align-items: center;
    border-top: 1px solid var(--v2-rule, #d6d0c1);
    background: var(--v2-paper-2, #f3efe5);
    padding: 4px 12px;
    gap: 8px;
    height: 32px;
  }
  .snippet-strip.expanded {
    height: auto;
    align-items: flex-start;
    padding: 8px 12px;
  }
  .snippet {
    flex: 1;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    overflow: hidden;
  }
  .snippet code {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    display: block;
  }
  .snippet-strip.expanded .snippet code {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .controls {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .controls button {
    padding: 2px 8px;
    font-size: 12px;
    background: var(--v2-paper-edge, #fff);
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-soft, 3px);
    color: var(--v2-ink, #15140e);
    cursor: pointer;
  }
  .controls button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .controls button:not(:disabled):hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
  }
</style>

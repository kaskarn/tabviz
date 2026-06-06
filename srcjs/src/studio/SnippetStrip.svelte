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
            aria-expanded={expanded}>
      {expanded ? "⌃" : "⌄"}
    </button>
    <button type="button" onclick={copyAll} title="Copy snippet">
      {copied ? "✓" : "📋"}
    </button>
  </div>
</footer>

<style>
  .snippet-strip {
    display: flex;
    align-items: center;
    border-top: 1px solid #e2e8f0;
    background: #fafafa;
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
    font-family: ui-monospace, monospace;
    font-size: 11.5px;
    color: #1a1a1a;
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
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    cursor: pointer;
  }
  .controls button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .controls button:not(:disabled):hover {
    background: #f1f5f9;
  }
</style>

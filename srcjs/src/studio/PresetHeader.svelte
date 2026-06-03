<!--
  Stage 3 — PresetHeader.svelte
  Sticky top band: studio title · based on <preset> · dirty dot
                   [Revert] [Save as…] [Export ▾] [Cancel] [Done]
-->
<script lang="ts">
  const {
    baseName,
    dirty,
    onRevert,
    onDone,
    onCancel,
  }: {
    baseName: string;
    dirty: boolean;
    onRevert: () => void;
    onDone: () => void;
    onCancel: () => void;
  } = $props();

  let exportOpen = $state(false);
  let saveOpen = $state(false);

  function confirmRevert(): void {
    if (dirty) {
      if (!confirm(`Discard edits and restore ${baseName}?`)) return;
    }
    onRevert();
  }

  // Stage 3 save-as: writes to ~/.tabviz/themes/<name>.json via R
  // round-trip (the gadget's Shiny custom-input mechanism). Stub for now.
  function handleSaveAs(name: string): void {
    if (!name) return;
    const win = window as unknown as { Shiny?: { setInputValue: (k: string, v: unknown, opts?: { priority?: string }) => void } };
    if (win.Shiny) {
      win.Shiny.setInputValue("studio_save_as", name, { priority: "event" });
    }
    saveOpen = false;
  }
</script>

<header class="preset-header">
  <div class="title">
    <strong>tabviz studio</strong>
    <span class="separator">·</span>
    <span class="base">based on {baseName}</span>
    {#if dirty}
      <span class="dirty" title="Unsaved changes since {baseName} was loaded">●</span>
    {/if}
  </div>

  <div class="actions">
    <button type="button" onclick={confirmRevert} disabled={!dirty}>Revert</button>
    <button type="button" onclick={() => (saveOpen = !saveOpen)}>Save as…</button>
    <div class="export-wrap">
      <button type="button" onclick={() => (exportOpen = !exportOpen)}>Export ▾</button>
      {#if exportOpen}
        <div class="menu">
          <button type="button" onclick={() => { exportOpen = false; }}>Copy R code</button>
          <button type="button" onclick={() => { exportOpen = false; }}>Copy JSON</button>
          <button type="button" onclick={() => { exportOpen = false; }}>Download .json</button>
        </div>
      {/if}
    </div>
    <button type="button" onclick={onCancel}>Cancel</button>
    <button type="button" class="done" onclick={onDone}>Done</button>
  </div>

  {#if saveOpen}
    <div class="save-popover" role="dialog" aria-label="Save as preset">
      <label>
        Name
        <input
          type="text"
          placeholder="my-theme"
          onkeydown={(e) => {
            if (e.key === "Enter") handleSaveAs((e.currentTarget as HTMLInputElement).value);
            else if (e.key === "Escape") saveOpen = false;
          }}
        />
      </label>
    </div>
  {/if}
</header>

<style>
  .preset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid #e2e8f0;
    background: #fafafa;
    position: relative;
    gap: 12px;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .separator { color: #94a3b8; }
  .base { color: #475569; }
  .dirty {
    color: #f59e0b;
    font-size: 16px;
    line-height: 1;
  }
  .actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  button {
    padding: 4px 10px;
    border: 1px solid #cbd5e1;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: inherit;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:not(:disabled):hover {
    background: #f1f5f9;
  }
  button.done {
    background: #2563eb;
    color: #fff;
    border-color: #1d4ed8;
  }
  button.done:hover {
    background: #1d4ed8;
  }
  .export-wrap {
    position: relative;
  }
  .menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    z-index: 10;
    display: flex;
    flex-direction: column;
    min-width: 140px;
  }
  .menu button {
    border: none;
    border-radius: 0;
    text-align: left;
    padding: 8px 12px;
  }
  .menu button:hover {
    background: #f1f5f9;
  }
  .save-popover {
    position: absolute;
    top: 100%;
    right: 200px;
    margin-top: 4px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    z-index: 10;
    padding: 12px;
  }
  .save-popover label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }
  .save-popover input {
    padding: 4px 8px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 13px;
    min-width: 180px;
  }
</style>

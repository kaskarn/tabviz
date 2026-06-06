<!--
  Stage 3 — PresetHeader.svelte
  Sticky top band: studio title · based on <preset> · dirty dot
  Action buttons depend on host:
  - Shiny gadget: [Revert] [Save as…] [Export ▾] [Cancel] [Done]
  - Static (docs/forge): [Revert] [Export ▾] (Done/Cancel hidden;
    Export is the primary egress, with Copy R code / Copy JSON /
    Download .json acting against the live snippet).
-->
<script lang="ts">
  import ConfirmDialog from "$components/ui/ConfirmDialog.svelte";
  import { studioStore } from "./studio-store.svelte";
  import { PRESETS } from "$lib/theme/theme-presets-inputs";

  const {
    baseName,
    dirty,
    isStatic,
    snippet,
    onRevert,
    onDone,
    onCancel,
  }: {
    baseName: string;
    dirty: boolean;
    isStatic: boolean;
    snippet: string;
    onRevert: () => void;
    onDone: () => void;
    onCancel: () => void;
  } = $props();

  let exportOpen = $state(false);
  let saveOpen = $state(false);
  let toastMsg = $state<string | null>(null);
  let toastTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  function flashToast(msg: string): void {
    toastMsg = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastMsg = null), 2000);
  }

  // C38 (wire-audit Pass 4): native confirm() is silently blocked in the
  // RStudio viewer / sandboxed iframes (locked rule: feedback_native_dialogs)
  // — the revert confirmation never fired there. In-widget dialog instead.
  let revertDialogOpen = $state(false);

  // ── In-studio preset switcher (studio E) ────────────────────────────
  // "based on X" was inert text; switching bases meant closing the studio
  // and relaunching from R. The select loads any shipped preset as the
  // new base (with a dirty-confirm so edits aren't silently dropped).
  const presetNames = Object.keys(PRESETS);
  let pendingPreset = $state<string | null>(null);

  function requestPreset(name: string): void {
    if (!name || name === baseName) return;
    if (dirty) {
      pendingPreset = name;
    } else {
      loadPreset(name);
    }
  }
  function loadPreset(name: string): void {
    const inputs = PRESETS[name];
    if (inputs) studioStore.init(inputs, name);
    pendingPreset = null;
  }

  function confirmRevert(): void {
    if (dirty) {
      revertDialogOpen = true;
      return;
    }
    onRevert();
  }

  function handleSaveAs(name: string): void {
    if (!name) return;
    const win = window as unknown as { Shiny?: { setInputValue: (k: string, v: unknown, opts?: { priority?: string }) => void } };
    if (win.Shiny) {
      win.Shiny.setInputValue("studio_save_as", name, { priority: "event" });
    } else {
      // Static mode: download the JSON locally with the given name.
      downloadJson(`${name}.json`);
      flashToast(`Downloaded ${name}.json`);
    }
    saveOpen = false;
  }

  async function copyRCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(snippet);
      flashToast("R code copied");
    } catch {
      flashToast("Copy failed — clipboard unavailable");
    }
    exportOpen = false;
  }

  async function copyJson(): Promise<void> {
    if (!studioStore.inputs) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(studioStore.inputs, null, 2));
      flashToast("Theme JSON copied");
    } catch {
      flashToast("Copy failed — clipboard unavailable");
    }
    exportOpen = false;
  }

  function downloadJson(filename = "theme.json"): void {
    if (!studioStore.inputs) return;
    const blob = new Blob([JSON.stringify(studioStore.inputs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    exportOpen = false;
  }
</script>

<header class="preset-header">
  <div class="title">
    <strong>tabviz studio</strong>
    <span class="separator">·</span>
    <label class="base">
      based on
      <select
        value={presetNames.includes(baseName) ? baseName : ""}
        onchange={(e) => requestPreset((e.currentTarget as HTMLSelectElement).value)}
        aria-label="Switch base preset"
      >
        {#if !presetNames.includes(baseName)}
          <option value="">{baseName}</option>
        {/if}
        {#each presetNames as name (name)}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>
    {#if dirty}
      <span class="dirty" title="Unsaved changes since {baseName} was loaded">●</span>
    {/if}
    {#if isStatic}
      <span class="badge-static" title="Running in static mode — no R bridge">forge</span>
    {/if}
  </div>

  <div class="actions">
    <button type="button" onclick={confirmRevert} disabled={!dirty}>Revert</button>
    <button type="button" onclick={() => (saveOpen = !saveOpen)}>
      {isStatic ? "Download as…" : "Save as…"}
    </button>
    <div class="export-wrap">
      <button
        type="button"
        class:primary={isStatic}
        onclick={() => (exportOpen = !exportOpen)}
      >Export ▾</button>
      {#if exportOpen}
        <div class="menu">
          <button type="button" onclick={copyRCode}>Copy R code</button>
          <button type="button" onclick={copyJson}>Copy JSON</button>
          <button type="button" onclick={() => downloadJson()}>Download .json</button>
        </div>
      {/if}
    </div>
    {#if !isStatic}
      <button type="button" onclick={onCancel}>Cancel</button>
      <button type="button" class="done" onclick={onDone}>Done</button>
    {/if}
  </div>

  {#if saveOpen}
    <div class="save-popover" role="dialog" aria-label={isStatic ? "Download as" : "Save as preset"}>
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

  {#if toastMsg}
    <div class="toast" role="status">{toastMsg}</div>
  {/if}
</header>

<ConfirmDialog
  open={revertDialogOpen}
  title="Revert theme?"
  message={`Discard edits and restore ${baseName}?`}
  confirmLabel="Revert"
  variant="danger"
  onconfirm={() => { revertDialogOpen = false; onRevert(); }}
  oncancel={() => (revertDialogOpen = false)}
/>

<ConfirmDialog
  open={pendingPreset !== null}
  title="Switch base preset?"
  message={`Discard edits and load ${pendingPreset ?? ""} as the new base?`}
  confirmLabel="Switch"
  variant="danger"
  onconfirm={() => pendingPreset && loadPreset(pendingPreset)}
  oncancel={() => (pendingPreset = null)}
/>

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
  .base {
    color: #475569;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .base select {
    font-size: 12px;
    padding: 2px 4px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #fff;
    color: #1e293b;
    cursor: pointer;
  }
  .dirty {
    color: #f59e0b;
    font-size: 16px;
    line-height: 1;
  }
  .badge-static {
    background: #6750A4;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
    letter-spacing: 0.04em;
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
  button.primary {
    background: #2563eb;
    color: #fff;
    border-color: #1d4ed8;
  }
  button.primary:hover {
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
  .toast {
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
</style>

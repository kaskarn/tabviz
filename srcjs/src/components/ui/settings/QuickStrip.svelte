<!--
  QuickStrip — the first ~150px of the rebuilt settings panel
  (settings-overhaul P2): orientation (which theme, is it edited) + the
  two declared-everyday flips (polarity, density) + nothing else. Pinned
  above the THEME band; never scrolls away.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import type { WebTheme } from "$types/theme-resolved";
  import { EnumRow } from "$components/theme-controls";
  import { buildSnippetSteps } from "$lib/theme/theme-diff";
  import { buildTheme } from "$lib/theme/theme-adapter";
  import { buildThemeWire } from "$lib/theme/theme-wire";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null,
  );

  function patch<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]): void {
    if (!inputs) return;
    store.setAuthoringInputs({ ...inputs, [key]: value });
  }

  // ── Divergence badge (P4): how many inputs differ from the loaded
  // theme — counted with the SAME diff that generates the R snippet, so
  // the number is the length of the set_*() chain that reproduces it.
  // Pins/overrides count RELATIVE to the loaded theme too (flow review
  // F1: importing a pinned theme used to show its own pins as "edits"
  // with nothing to reset). ──
  function recordDelta(
    cur: Record<string, unknown>,
    init: Record<string, unknown>,
  ): number {
    const keys = new Set([...Object.keys(cur), ...Object.keys(init)]);
    let n = 0;
    for (const k of keys) {
      if (JSON.stringify(cur[k]) !== JSON.stringify(init[k])) n += 1;
    }
    return n;
  }
  const divergence = $derived.by(() => {
    const init = store.initialTheme as WebTheme | null;
    const initial = init?.authoringInputs;
    if (!initial || !inputs) return 0;
    const t = theme as WebTheme | undefined;
    let n = buildSnippetSteps(initial, inputs).length;
    n += recordDelta(t?.roleOverrides ?? {}, init?.roleOverrides ?? {});
    n += recordDelta(t?.pins ?? {}, init?.pins ?? {});
    return n;
  });

  // ── Export / import the theme-wire envelope (P4: both surfaces emit
  // ONE schema; import is what makes export useful for no-R users). ──
  function exportWire(): void {
    if (!inputs) return;
    const t = theme as WebTheme | undefined;
    // ONE envelope builder for every egress (quality review).
    const wire = buildThemeWire(
      inputs, store.baseThemeName, t?.roleOverrides ?? {}, t?.pins ?? {},
    );
    const blob = new Blob([JSON.stringify(wire, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${store.baseThemeName || "theme"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  let importError = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  function importWire(file: File): void {
    importError = null;
    file.text().then((text) => {
      try {
        const wire = JSON.parse(text) as {
          $schema?: string;
          name?: string;
          inputs?: ThemeInputs;
          roleOverrides?: WebTheme["roleOverrides"];
          pins?: WebTheme["pins"];
        };
        if (!wire.inputs?.anchors) {
          importError = "Not a theme wire (missing inputs.anchors).";
          return;
        }
        const built = buildTheme(wire.inputs, {
          name: wire.name ?? "imported",
          roleOverrides: wire.roleOverrides ?? {},
          pins: wire.pins ?? {},
        });
        store.setThemeObject(built as never);
      } catch (e) {
        importError = (e as Error).message;
      }
    });
  }
</script>

{#if inputs}
  <div class="quick-strip">
    <div class="echo">
      <span class="preset">{store.baseThemeName}</span>
      {#if divergence > 0}
        <span class="edited" title="Theme edits vs the loaded theme — the length of the set_*() chain the export carries">· {divergence} {divergence === 1 ? "edit" : "edits"}</span>
      {/if}
      <span class="echo-actions">
        <button type="button" class="echo-btn" aria-label="Export theme JSON"
                title="Export theme JSON (wire envelope)" onclick={exportWire}>export</button>
        <button type="button" class="echo-btn" aria-label="Import theme JSON"
                title="Import theme JSON" onclick={() => fileInput?.click()}>import</button>
        <input bind:this={fileInput} type="file" accept=".json,application/json" class="file-input"
               aria-label="Import theme JSON file"
               onchange={(e) => {
                 const f = (e.currentTarget as HTMLInputElement).files?.[0];
                 if (f) importWire(f);
                 (e.currentTarget as HTMLInputElement).value = "";
               }} />
      </span>
    </div>
    {#if importError}
      <p class="import-error" role="alert">{importError}</p>
    {/if}
    <EnumRow
      label="Polarity"
      value={inputs.polarity ?? "light"}
      segments={[
        { value: "light", label: "☀ light" },
        { value: "dark", label: "🌙 dark" },
      ]}
      onchange={(v) => patch("polarity", v as ThemeInputs["polarity"])}
    />
    <EnumRow
      label="Density"
      value={inputs.density ?? "comfortable"}
      segments={[
        { value: "compact", label: "compact" },
        { value: "comfortable", label: "comfortable" },
        { value: "spacious", label: "spacious" },
      ]}
      onchange={(v) => patch("density", v as ThemeInputs["density"])}
    />
  </div>
{/if}

<style>
  .quick-strip {
    padding: 8px 12px 6px;
    border-bottom: 1px solid var(--v2-rule-soft, #e6e0d1);
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
  }
  .echo {
    display: flex;
    align-items: baseline;
    gap: var(--v2-gap-small, 6px);
    padding-bottom: 4px;
  }
  .preset {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
  }
  .edited {
    font-size: var(--v2-text-small, 10.5px);
    /* Neutral counter, not an alarm (UX review P1-4). */
    color: var(--v2-ink-2, #4a463c);
  }
  .echo-actions {
    margin-left: auto;
    display: inline-flex;
    gap: 2px;
  }
  .echo-btn {
    min-width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
    font-size: var(--v2-text-small, 10.5px);
    padding: 0 4px;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }
  .echo-btn:hover { color: var(--v2-ink, #15140e); background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }
  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
  }
  .import-error {
    margin: 0 0 4px;
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-hot, #b53a1f);
  }
</style>

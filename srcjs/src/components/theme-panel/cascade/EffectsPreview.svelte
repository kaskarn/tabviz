<!--
  EffectsPreview — Tier 1 · EFFECTS visualization.

  Renders three mock cards demonstrating the live state of glow,
  gradient shell, and emphasis-shadow. Each card pulls the corresponding
  resolved cssVars so the preview is exact (mode-aware, polarity-aware).
-->
<script lang="ts">
  import { inspectorStore } from "$stores/inspector-store.svelte";
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  function v(name: string, fallback: string): string {
    return resolved.cssVars[name] ?? fallback;
  }

  function click(cssVar: string): void {
    inspectorStore.trace(cssVar, resolved);
  }

  const PREVIEWS = [
    {
      key: "glow",
      label: "Emphasis row glow",
      vars: ["--tv-glow-color", "--tv-glow-blur", "--tv-glow-spread"],
      hint: "neon ↔ subtle ↔ none",
    },
    {
      key: "gradient",
      label: "Shell gradient",
      vars: ["--tv-shell-gradient"],
      hint: "two-stop linear; HC drops",
    },
    {
      key: "shadow",
      label: "Card elevation",
      vars: ["--tv-emphasis-shadow"],
      hint: "near + far hue-tinted shadow",
    },
  ] as const;
</script>

<div class="effects-preview">
  {#each PREVIEWS as p (p.key)}
    <button type="button" class="card" data-key={p.key}
            onclick={() => click(p.vars[0])}
            aria-label={`Trace ${p.vars[0]}`}>
      <div
        class="surface"
        style:background-image={p.key === "gradient" ? v("--tv-shell-gradient", "none") : undefined}
        style:box-shadow={
          p.key === "glow"
            ? `0 0 ${v("--tv-glow-blur", "0px")} ${v("--tv-glow-spread", "0px")} ${v("--tv-glow-color", "transparent")}`
          : p.key === "shadow"
            ? v("--tv-emphasis-shadow", "none")
          : undefined
        }
      >
        <span class="row">Compound A</span>
        <span class="val">−8.4</span>
      </div>
      <div class="cap">
        <span class="label">{p.label}</span>
        <span class="hint">{p.hint}</span>
        <div class="tokens">
          {#each p.vars as cv (cv)}
            <code>{cv}</code>
          {/each}
        </div>
      </div>
    </button>
  {/each}
</div>

<style>
  .effects-preview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  @media (max-width: 720px) {
    .effects-preview { grid-template-columns: 1fr; }
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: transparent;
    border: 1px solid var(--tp-rule, #e8e6e1);
    border-radius: 6px;
    padding: 12px;
    cursor: pointer;
    text-align: left;
    color: var(--tp-fg, #1c1a17);
    transition: border-color 80ms ease;
  }
  .card:hover { border-color: var(--tp-fg, #1c1a17); }
  .surface {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: baseline;
    padding: 14px 16px;
    border-radius: 6px;
    background: var(--tp-input-bg, #faf9f6);
    border: 1px solid var(--tp-rule, #d8d4cc);
    min-height: 56px;
    font-size: 12px;
  }
  .row { font-weight: 600; }
  .val {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    color: var(--tp-fg, #1c1a17);
  }
  .cap { display: flex; flex-direction: column; gap: 4px; }
  .label { font-size: 12px; font-weight: 600; }
  .hint { font-size: 10.5px; color: var(--tp-muted, #6b6760); font-style: italic; }
  .tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }
  .tokens code {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 9.5px;
    color: var(--tp-rhs, #5e51a3);
    background: var(--tp-input-bg, #faf9f6);
    padding: 1px 5px;
    border-radius: 3px;
  }
</style>

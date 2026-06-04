<!--
  ResilienceTriptych — Resilience × Fallback cascade step.

  Renders the same mini-table row three times — once under each
  accessibility mode (standard / reduced-transparency / high-contrast).
  Each panel re-resolves the active inputs locally with `mode` swapped,
  so the cascade dramatizes that the encoding is mode-independent.
-->
<script lang="ts">
  import type { ThemeInputs, ThemeMode } from "$types/theme-inputs";
  import { resolveTheme } from "$lib/theme/resolve-theme";
  import { createWire } from "$lib/theme/theme-wire";

  const { inputs }: { inputs: ThemeInputs } = $props();

  const PANELS: { mode: ThemeMode; chip: string; label: string }[] = [
    { mode: "standard",             chip: "STANDARD",            label: "translucent brand wash" },
    { mode: "reduced-transparency", chip: "REDUCED-TRANSPARENCY", label: "opaque tint" },
    { mode: "high-contrast",        chip: "HIGH-CONTRAST",        label: "weight + bar" },
  ];

  // Resolve each mode in isolation. The resolver is cheap; computing
  // three blobs on every input change is fine at this scale.
  function resolveFor(mode: ThemeMode) {
    return resolveTheme(createWire({ ...inputs, mode }, "preview"));
  }

  // Mini-table content — kept abstract so the triptych works for any
  // theme. The pattern is "two reference rows + one highlighted
  // emphasis row" because that's where the mode treatment differs.
  const ROWS = [
    { id: "ref-1", label: "Placebo",      value: "-1.6", emphasis: false },
    { id: "emp",   label: "Compound A",   value: "-8.4", emphasis: true  },
    { id: "ref-2", label: "Active comp.", value: "-1.4", emphasis: false },
  ];

  function vars(theme: ReturnType<typeof resolveFor>): string {
    // Inline the cssVars onto the panel as inline styles. The cascade
    // already emits one entry per role consumer reads.
    return Object.entries(theme.cssVars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");
  }
</script>

<div class="resilience-triptych">
  {#each PANELS as p (p.mode)}
    {@const theme = resolveFor(p.mode)}
    <article class="panel" data-mode={p.mode} style={vars(theme)}>
      <header>
        <span class="chip">{p.chip}</span>
        <span class="label">{p.label}</span>
      </header>
      <div class="rows">
        {#each ROWS as r (r.id)}
          <div class="row" class:emphasis={r.emphasis}>
            <span class="row-label">{r.label}</span>
            <span class="row-value">{r.value}</span>
          </div>
        {/each}
      </div>
    </article>
  {/each}
</div>

<style>
  .resilience-triptych {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }
  .panel {
    border: 1px solid var(--tv-paper-border, #d8d4cc);
    border-radius: 6px;
    overflow: hidden;
    background: var(--tv-paper-bg, #ffffff);
    color: var(--tv-text, #1c1a17);
    font-family: var(--tv-text-body-family, -apple-system, BlinkMacSystemFont, sans-serif);
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--tv-paper-border, #d8d4cc);
    background: var(--tp-input-bg, #faf9f6);
  }
  .chip {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--tp-fg, #1c1a17);
  }
  .label {
    font-size: 11px;
    color: var(--tp-fg-muted, #4d4a45);
    font-style: italic;
  }
  .rows { display: flex; flex-direction: column; }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    padding: 8px 12px;
    font-size: 12px;
    background: var(--tv-row-base-bg, transparent);
    color: var(--tv-row-base-fg, var(--tv-text, currentColor));
    border-top: 1px solid var(--tv-paper-border, transparent);
  }
  .row:first-child { border-top: 0; }
  .row.emphasis {
    background: var(--tv-row-emphasis-bg, #e8f0fe);
    color: var(--tv-row-emphasis-fg, var(--tv-text, currentColor));
    font-weight: 600;
    position: relative;
  }
  .row.emphasis::before {
    /* Vertical bar marker — survives HC even when wash drops. */
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--tv-row-emphasis-bar, transparent);
  }
  .row-value {
    font-family: var(--tv-text-numeric-family, ui-monospace, monospace);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 720px) {
    .resilience-triptych { grid-template-columns: 1fr; }
  }
</style>

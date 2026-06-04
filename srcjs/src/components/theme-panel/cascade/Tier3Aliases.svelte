<!--
  Tier 3 — the component-token alias chain. Each manifest entry shows as
  `tv-foo : var(role-X)` with its resolved hex. Grouped by cluster
  prefix so the list reads at a glance. Click traces.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { COMPONENT_TOKENS, type ComponentToken } from "$lib/theme/component-tokens";
  import { inspectorStore } from "$stores/inspector-store.svelte";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  // Group by the first two segments of the cssVar (e.g. `--tv-row-base-bg`
  // groups under `row`).
  type Group = { key: string; tokens: ComponentToken[] };
  const groups = $derived<Group[]>(buildGroups());

  function buildGroups(): Group[] {
    const map = new Map<string, ComponentToken[]>();
    for (const t of COMPONENT_TOKENS) {
      // --tv-row-base-bg → "row"
      const parts = t.cssVar.replace(/^--tv-/, "").split("-");
      const key = parts[0] ?? "misc";
      let arr = map.get(key);
      if (!arr) { arr = []; map.set(key, arr); }
      arr.push(t);
    }
    return Array.from(map.entries())
      .map(([key, tokens]) => ({ key, tokens }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  function source(t: ComponentToken): string {
    const s = t.source;
    switch (s.tier) {
      case "role":     return `var(--role-${s.role})`;
      case "input":    return `inputs.${String(s.input)}`;
      case "anchor":   return `anchor.${s.anchor}`;
      case "computed": return s.note;
      case "const":    return s.note;
    }
  }

  function value(t: ComponentToken): string {
    return resolved.cssVars[t.cssVar] ?? "—";
  }

  function looksLikeColor(v: string): boolean {
    return /^(#|rgb|hsl|oklch)/.test(v);
  }

  function click(t: ComponentToken): void {
    inspectorStore.trace(t.cssVar, resolved);
  }
</script>

<div class="tier3-aliases">
  {#each groups as group (group.key)}
    <details class="group" open={group.key === "row" || group.key === "paper" || group.key === "ink"}>
      <summary>
        <span class="grp-name">{group.key}</span>
        <span class="grp-count">{group.tokens.length}</span>
      </summary>
      <ul>
        {#each group.tokens as t (t.cssVar)}
          {@const v = value(t)}
          <li>
            <button type="button" class="alias" onclick={() => click(t)}
                    title={t.description}>
              <code class="lhs">{t.cssVar}</code>
              <span class="arrow">←</span>
              <code class="rhs">{source(t)}</code>
              <span class="val">
                {#if looksLikeColor(v)}
                  <span class="swatch" style:background={v}></span>
                {/if}
                <code class="val-code">{v}</code>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </details>
  {/each}
</div>

<style>
  .tier3-aliases {
    padding: 4px 18px 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 11px;
  }
  .group {
    border: 1px solid var(--tp-rule, #e8e6e1);
    border-radius: 4px;
    overflow: hidden;
  }
  summary {
    cursor: pointer;
    list-style: none;
    padding: 6px 10px;
    background: var(--tp-input-bg, #faf9f6);
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
  }
  summary::-webkit-details-marker { display: none; }
  .grp-name {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: var(--tp-fg, #1c1a17);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .grp-count {
    font-size: 10px;
    color: var(--tp-muted, #6b6760);
    background: var(--tp-rule, #e8e6e1);
    border-radius: 999px;
    padding: 1px 6px;
  }
  ul { list-style: none; margin: 0; padding: 0; }
  .alias {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) auto minmax(0, 1.2fr) auto;
    gap: 8px;
    align-items: center;
    width: 100%;
    border: 0;
    border-bottom: 1px solid var(--tp-rule, #f0eee8);
    background: transparent;
    padding: 4px 10px;
    text-align: left;
    cursor: pointer;
    color: var(--tp-fg, #1c1a17);
  }
  .alias:last-child { border-bottom: 0; }
  .alias:hover { background: var(--tp-row-active, #f6f3ed); }
  .lhs { color: var(--tp-fg, #1c1a17); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .arrow { color: var(--tp-muted, #6b6760); }
  .rhs { color: var(--tp-rhs, #5e51a3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .val { display: inline-flex; align-items: center; gap: 6px; }
  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid var(--tp-rule, #d8d4cc);
    display: inline-block;
  }
  .val-code { color: var(--tp-muted, #6b6760); font-size: 10px; }
</style>

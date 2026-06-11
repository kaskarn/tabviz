<!--
  AliasTable — flat mono spec list for the cascade's alias chains.

  Two modes:
  - "role"  : Tier 2 contract — `--role-X ← ramp.N` with a swatch + grade chip
  - "token" : Tier 3 aliases  — `--tv-X : var(--role-Y)` with a resolved swatch

  Active trace target gets a thin border highlight (the rgc inspector
  idiom). No collapsible groups; the list reads as one continuous
  contract.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { COMPONENT_TOKENS, TOKENS_BY_ROLE, type ComponentToken } from "$lib/theme/component-tokens";
  import { DEFAULT_ROLE_BINDINGS } from "$lib/theme/role-bindings";
  import {
    OFF_RAMP_ROLES, ROLE_KIND, ALL_ROLES, type RoleName,
  } from "$types/theme-roles";
  import { inspectorStore } from "$stores/inspector-store.svelte";

  const {
    mode,
    resolved,
  }: {
    mode: "role" | "token";
    resolved: ResolvedTheme;
  } = $props();

  // ── current trace key for the active-row highlight ───────────────────────
  const activeCssVar = $derived(inspectorStore.state.cssVar);

  function looksLikeColor(v: string): boolean {
    return /^(#|rgb|hsl|oklch)/.test(v);
  }

  // ── role mode rows ───────────────────────────────────────────────────────
  type RoleRow = {
    name: RoleName;
    cssVar: string;
    swatch: string;
    binding: string;
    isOffRamp: boolean;
  };

  const roleRows = $derived<RoleRow[]>(buildRoleRows());

  function buildRoleRows(): RoleRow[] {
    const rows: RoleRow[] = [];
    for (const r of ALL_ROLES) {
      const def = DEFAULT_ROLE_BINDINGS[r];
      const isOff = OFF_RAMP_ROLES.has(r);
      rows.push({
        name: r,
        cssVar: `--role-${r}`,
        swatch: resolved.roles[r] ?? "#999",
        binding: isOff ? "(off-ramp)" : `${def.ramp}.${def.grade}`,
        isOffRamp: isOff,
      });
    }
    return rows;
  }

  function clickRole(r: RoleRow): void {
    // `r.cssVar` (`--role-X`) is a DISPLAY id, not a real token — feeding
    // it to the tracer produced the malformed `--tv---role-X` lookup
    // ("not in COMPONENT_TOKENS"). Trace through a real token bound to
    // the role instead, exactly like RoleSpine's clickRole.
    const tokens = TOKENS_BY_ROLE.get(r.name);
    if (tokens && tokens.length > 0) {
      inspectorStore.trace(tokens[0].cssVar, resolved);
    }
  }

  // ── token mode rows (Tier 3) ─────────────────────────────────────────────
  function tokenSource(t: ComponentToken): string {
    const s = t.source;
    switch (s.tier) {
      case "role":     return `var(--role-${s.role})`;
      case "input":    return `inputs.${String(s.input)}`;
      case "anchor":   return `anchor.${s.anchor}`;
      case "computed": return s.note;
      case "const":    return s.note;
    }
  }
  function tokenValue(t: ComponentToken): string {
    return resolved.cssVars[t.cssVar] ?? "—";
  }
  function clickToken(t: ComponentToken): void {
    inspectorStore.trace(t.cssVar, resolved);
  }
</script>

<div class="alias-table" data-mode={mode}>
  {#if mode === "role"}
    <ul>
      {#each roleRows as r (r.name)}
        <li class:active={activeCssVar === r.cssVar}
            class:off-ramp={r.isOffRamp}>
          <button type="button" onclick={() => clickRole(r)}
                  aria-label={`Trace role ${r.name}`}>
            <span class="lhs">
              <span class="swatch" style:background={r.swatch}></span>
              <code class="name" data-kind={ROLE_KIND[r.name]}>{r.cssVar}</code>
            </span>
            <span class="arrow">←</span>
            <code class="rhs">{r.binding}</code>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <ul>
      {#each COMPONENT_TOKENS as t (t.cssVar)}
        {@const v = tokenValue(t)}
        <li class:active={activeCssVar === t.cssVar}>
          <button type="button" onclick={() => clickToken(t)}
                  title={t.description}
                  aria-label={`Trace token ${t.cssVar}`}>
            <span class="lhs">
              {#if looksLikeColor(v)}
                <span class="swatch" style:background={v}></span>
              {:else}
                <span class="swatch nonchroma"></span>
              {/if}
              <code class="name">{t.cssVar}</code>
            </span>
            <span class="arrow">:</span>
            <code class="rhs">{tokenSource(t)}</code>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .alias-table {
    border: 1px solid var(--tp-rule, #e8e6e1);
    border-radius: 6px;
    overflow: hidden;
    background: var(--tp-bg, #ffffff);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 560px;
    overflow-y: auto;
  }
  li { border-bottom: 1px solid var(--tp-rule-faint, #f1efea); }
  li:last-child { border-bottom: 0; }
  li.active {
    box-shadow: inset 0 0 0 2px var(--tp-trace-rule, #4a90e2);
    background: var(--tp-trace-bg, #eef4fb);
  }
  li.off-ramp .name {
    opacity: 0.72;
  }
  li.off-ramp .rhs {
    font-style: italic;
    opacity: 0.7;
  }
  button {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) auto minmax(0, 1.3fr);
    align-items: center;
    gap: 10px;
    padding: 5px 12px;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
    color: var(--tp-fg, #1c1a17);
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 11.5px;
    line-height: 1.4;
  }
  button:hover { background: var(--tp-row-active, #f6f3ed); }
  .lhs { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .swatch {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.12);
  }
  .swatch.nonchroma {
    background-image:
      linear-gradient(45deg, #d8d4cc 25%, transparent 25%, transparent 75%, #d8d4cc 75%),
      linear-gradient(45deg, #d8d4cc 25%, transparent 25%, transparent 75%, #d8d4cc 75%);
    background-size: 6px 6px;
    background-position: 0 0, 3px 3px;
  }
  .name {
    color: var(--tp-fg, #1c1a17);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* RoleKind tinting on the role-mode left-side identifier. */
  .name[data-kind="fill"]   { color: #2d65a8; }
  .name[data-kind="border"] { color: #1e7b50; }
  .name[data-kind="text"]   { color: #934236; }
  .arrow { color: var(--tp-muted, #6b6760); font-weight: 700; }
  .rhs {
    color: var(--tp-rhs, #5e51a3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

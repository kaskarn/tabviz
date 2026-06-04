<!--
  OffTheScales — semantic + computed roles that don't bind to a (ramp,
  grade) pair, rendered as a tray below the SpineDiagram.

  Status roles (pos / neg / warn / info) source from Tier-1 status
  anchors; text-onsolid is APCA-computed. Both sit outside the spine
  taxonomy, so the panel surfaces them in their own block.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { ROLE_KIND, type RoleName } from "$types/theme-roles";
  import { inspectorStore } from "$stores/inspector-store.svelte";
  import { TOKENS_BY_ROLE } from "$lib/theme/component-tokens";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  type Group = {
    key: string;
    label: string;
    note: string;
    roles: RoleName[];
  };

  // Group by semantic family. Order follows rgc's POSITIVE / NEGATIVE /
  // WARNING / INFO / COMPUTED row.
  const GROUPS: Group[] = [
    { key: "pos",   label: "positive", note: "from status anchor",
      roles: ["pos-fill", "pos-solid", "pos-text"] },
    { key: "neg",   label: "negative", note: "from status anchor",
      roles: ["neg-fill", "neg-solid", "neg-text"] },
    { key: "warn",  label: "warning",  note: "from status anchor",
      roles: ["warn-fill", "warn-text"] },
    { key: "info",  label: "info",     note: "from status anchor",
      roles: ["info-fill", "info-text"] },
    { key: "comp",  label: "computed", note: "APCA-picked",
      roles: ["text-onsolid"] },
  ];

  function hex(role: RoleName): string {
    return resolved.roles[role] ?? "#999";
  }

  function pinLabel(role: RoleName): string {
    return role.replace(/-/g, "·");
  }

  function click(role: RoleName): void {
    const tokens = TOKENS_BY_ROLE.get(role);
    if (tokens && tokens.length > 0) {
      inspectorStore.trace(tokens[0].cssVar, resolved);
    }
  }

  // Color dot per group (used in the group header).
  function dotFor(g: Group): string {
    return resolved.roles[g.roles[0] as RoleName] ?? "#999";
  }
</script>

<div class="off-the-scales">
  <header>
    <span class="chip">OFF THE SCALES</span>
    <p>Fixed semantic hues + computed roles. Not grade-bound — they live
       outside the cascade's ramp axis.</p>
  </header>
  <div class="groups">
    {#each GROUPS as g (g.key)}
      <div class="group">
        <div class="group-head">
          <span class="group-dot" style:background={dotFor(g)}></span>
          <span class="group-label">{g.label}</span>
          <span class="group-note">{g.note}</span>
        </div>
        <div class="pins">
          {#each g.roles as role (role)}
            <button type="button" class="pin"
                    data-kind={ROLE_KIND[role]}
                    onclick={() => click(role)}
                    aria-label={`Trace role ${role}`}>
              <span class="pin-swatch" style:background={hex(role)}></span>
              <span class="pin-label">{pinLabel(role)}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .off-the-scales {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border: 1px dashed var(--tp-rule, #d8d4cc);
    border-radius: 6px;
    background: var(--tp-input-bg, #faf9f6);
  }
  header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .chip {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    padding: 2px 7px;
    border-radius: 3px;
    background: var(--tp-fg, #1c1a17);
    color: var(--tp-bg, #ffffff);
  }
  header p {
    margin: 0;
    color: var(--tp-fg-muted, #4d4a45);
    font-size: 12px;
    line-height: 1.5;
  }
  .groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
  }
  .group { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .group-head {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--tp-fg, #1c1a17);
  }
  .group-dot { width: 8px; height: 8px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.12); }
  .group-label { font-weight: 700; }
  .group-note { color: var(--tp-muted, #6b6760); font-style: italic; text-transform: none; letter-spacing: 0; }
  .pins { display: flex; flex-wrap: wrap; gap: 4px; }
  .pin {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border: 1px solid var(--tp-rule, #d8d4cc);
    border-radius: 999px;
    background: var(--tp-bg, #ffffff);
    color: var(--tp-fg, #1c1a17);
    cursor: pointer;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10px;
    transition: border-color 80ms ease;
  }
  .pin:hover { border-color: var(--tp-fg, #1c1a17); }
  .pin[data-kind="border"] { border-style: dashed; }
  .pin[data-kind="text"]   { background: transparent; }
  .pin-swatch {
    width: 11px; height: 11px; border-radius: 3px;
    border: 1px solid rgba(0,0,0,0.12);
  }
</style>

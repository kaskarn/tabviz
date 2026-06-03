<!--
  Stage 3 §3 — Role Spine UI (read-only first pass).

  Renders the three ramps (neutral / brand / accent) as vertical
  columns, each with 11 grade swatches. Role tokens float at their
  current binding positions. Hovering a token sets the inspector's
  hoveredRole; clicking traces it via the Cascade Inspector.

  Drag-to-rebind (Stage 3 §3d) is a follow-up — the read-only display
  is the substrate piece that proves the cascade flows + lets users
  see at a glance which role draws from which ramp/grade.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { DEFAULT_ROLE_BINDINGS } from "$lib/theme/role-bindings";
  import { inspectorStore } from "../../stores/inspector-store.svelte";
  import { TOKENS_BY_ROLE } from "$lib/theme/component-tokens";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  const ramps = $derived(resolved.ramps);

  // Roles to show on each ramp. We display only the role bindings that
  // target a (ramp, grade) pair — off-ramp roles (status, computed)
  // live in the read-only OffRampTray.
  type SpineRole = { name: string; ramp: "neutral" | "brand" | "accent"; grade: number };
  const spineRoles = $derived.by((): SpineRole[] => {
    const out: SpineRole[] = [];
    for (const [name, binding] of Object.entries(DEFAULT_ROLE_BINDINGS)) {
      if (!binding) continue;
      const r = binding.ramp;
      const g = binding.grade;
      if (r === "neutral" || r === "brand" || r === "accent") {
        out.push({ name, ramp: r, grade: g });
      }
    }
    return out;
  });

  function rolesAt(ramp: "neutral" | "brand" | "accent", grade: number): SpineRole[] {
    return spineRoles.filter(r => r.ramp === ramp && r.grade === grade);
  }

  function hoverRole(roleName: string): void {
    // Light up consumers of this role across the widget. The hovered-role
    // CSS rule in theme-runtime.css picks up data-tv-token elements that
    // map to this role (via TOKENS_BY_ROLE reverse lookup).
    document.documentElement.setAttribute("data-hovered-role", roleName);
  }
  function unhoverRole(): void {
    document.documentElement.removeAttribute("data-hovered-role");
  }

  function clickRole(roleName: string): void {
    // Trace the first cssVar that binds to this role.
    const tokens = TOKENS_BY_ROLE.get(roleName as never);
    if (tokens && tokens.length > 0) {
      inspectorStore.trace(tokens[0].cssVar, resolved);
    }
  }
</script>

<div class="role-spine" aria-label="Role spine">
  {#each ["neutral", "brand", "accent"] as const as rampName (rampName)}
    <div class="spine-column" aria-label={`${rampName} ramp`}>
      <div class="column-label">{rampName}</div>
      <div class="swatch-stack">
        {#each ramps[rampName] as hex, gradeIdx (gradeIdx)}
          {@const grade = gradeIdx + 1}
          {@const roles = rolesAt(rampName, grade)}
          <div class="swatch-row">
            <div class="swatch" style:background={hex} title={`${rampName}[${grade}] = ${hex}`}></div>
            <div class="role-tokens">
              {#each roles as role (role.name)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_mouse_events_have_key_events -->
                <span
                  class="role-token"
                  role="button"
                  tabindex="0"
                  onmouseenter={() => hoverRole(role.name)}
                  onmouseleave={unhoverRole}
                  onclick={() => clickRole(role.name)}
                  onkeydown={(e) => { if (e.key === "Enter") clickRole(role.name); }}
                  title={`Role: ${role.name} → ${role.ramp}[${role.grade}]`}
                >{role.name}</span>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .role-spine {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: var(--tv-surface-bg, var(--tv-bg, #fff));
    border: 1px solid var(--tv-cell-border, var(--tv-border, #e2e8f0));
    border-radius: 6px;
  }
  .spine-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .column-label {
    text-transform: uppercase;
    font-size: 10px;
    font-weight: 600;
    color: var(--tv-text-muted, #64748b);
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }
  .swatch-stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .swatch-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .swatch {
    width: 24px;
    height: 16px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 2px;
    flex-shrink: 0;
  }
  .role-tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .role-token {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--tv-row-alt-bg, var(--tv-alt-bg, #f8fafc));
    border: 1px solid var(--tv-cell-border, var(--tv-border, #e2e8f0));
    font-size: 10px;
    line-height: 1.2;
    cursor: pointer;
    user-select: none;
    color: var(--tv-text, var(--tv-fg, #1a1a1a));
    transition: outline 0.12s ease, background 0.12s ease;
  }
  .role-token:hover {
    outline: 2px solid var(--tv-accent, #2563eb);
    outline-offset: 1px;
  }
</style>

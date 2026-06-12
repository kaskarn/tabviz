<!--
  Stage 3 §3 — Role Spine UI.

  Renders the three ramps (neutral / brand / accent) as vertical
  columns, each with 11 grade swatches. Role tokens float at their
  current binding positions (DEFAULT_ROLE_BINDINGS + studioStore
  roleOverrides). Drag a token vertically to change grade; drag across
  columns to rebind ramp. Hovering lights up consumers; click traces.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { DEFAULT_ROLE_BINDINGS } from "$lib/theme/role-bindings";
  import { inspectorStore } from "../../stores/inspector-store.svelte";
  import { studioStore } from "../../studio/studio-store.svelte";
  import { TOKENS_BY_ROLE } from "$lib/theme/component-tokens";
  import type { RoleName, RampName } from "$types/theme-roles";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  const ramps = $derived(resolved.ramps);

  type SpineRole = { name: string; ramp: "neutral" | "brand" | "accent"; grade: number; overridden: boolean };

  // Effective bindings = defaults overlaid with the studio's role overrides.
  const effectiveBindings = $derived.by((): SpineRole[] => {
    const out: SpineRole[] = [];
    for (const [name, defaultBinding] of Object.entries(DEFAULT_ROLE_BINDINGS)) {
      const override = studioStore.roleOverrides[name as RoleName];
      const binding = override ?? defaultBinding;
      if (!binding) continue;
      const r = binding.ramp;
      const g = binding.grade;
      if (r === "neutral" || r === "brand" || r === "accent") {
        // overridden = diverges from the cascade default (Wave 1.5): mark it
        // so a rebind is distinguishable from a default, and offer a reset.
        out.push({ name, ramp: r, grade: g, overridden: override != null });
      }
    }
    return out;
  });

  function resetRole(roleName: string): void {
    studioStore.clearRoleBinding(roleName as RoleName);
  }

  function rolesAt(ramp: "neutral" | "brand" | "accent", grade: number): SpineRole[] {
    return effectiveBindings.filter(r => r.ramp === ramp && r.grade === grade);
  }

  function hoverRole(roleName: string): void {
    document.documentElement.setAttribute("data-hovered-role", roleName);
  }
  function unhoverRole(): void {
    document.documentElement.removeAttribute("data-hovered-role");
  }

  function clickRole(roleName: string): void {
    const tokens = TOKENS_BY_ROLE.get(roleName as RoleName);
    if (tokens && tokens.length > 0) {
      inspectorStore.trace(tokens[0].cssVar, resolved);
    }
  }

  // ── Drag state ──────────────────────────────────────────────────────────
  let dragging = $state<{ role: string; pointerId: number } | null>(null);
  let dragTarget = $state<{ ramp: RampName | "neutral" | "brand" | "accent"; grade: number } | null>(null);
  const columnRefs: Partial<Record<"neutral" | "brand" | "accent", HTMLElement>> = {};

  function onPointerDown(e: PointerEvent, roleName: string): void {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = { role: roleName, pointerId: e.pointerId };
    dragTarget = null;
    document.body.style.cursor = "grabbing";
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    // Find which column the pointer is over (closest by horizontal distance).
    let best: { ramp: "neutral" | "brand" | "accent"; dist: number } | null = null;
    for (const ramp of ["neutral", "brand", "accent"] as const) {
      const el = columnRefs[ramp];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const dist = Math.abs(e.clientX - cx);
      if (!best || dist < best.dist) best = { ramp, dist };
    }
    if (!best) return;
    // Compute grade from vertical position within the column.
    const el = columnRefs[best.ramp]!;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // 11 swatches stacked; ramp[0] at top, ramp[10] at bottom.
    let grade = Math.floor((y / rect.height) * 11) + 1;
    grade = Math.max(1, Math.min(11, grade));
    dragTarget = { ramp: best.ramp, grade };
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (dragTarget) {
      studioStore.setRoleBinding(dragging.role as RoleName, dragTarget.ramp, dragTarget.grade);
    }
    dragging = null;
    dragTarget = null;
    document.body.style.cursor = "";
  }

  function onKeyDown(e: KeyboardEvent, role: SpineRole): void {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(1, role.grade - 1);
      if (next !== role.grade) studioStore.setRoleBinding(role.name as RoleName, role.ramp, next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(11, role.grade + 1);
      if (next !== role.grade) studioStore.setRoleBinding(role.name as RoleName, role.ramp, next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const order = ["neutral", "brand", "accent"] as const;
      const idx = order.indexOf(role.ramp);
      const next = e.key === "ArrowLeft" ? Math.max(0, idx - 1) : Math.min(2, idx + 1);
      if (next !== idx) studioStore.setRoleBinding(role.name as RoleName, order[next], role.grade);
    } else if (e.key === "Enter") {
      clickRole(role.name);
    } else if ((e.key === "Backspace" || e.key === "Delete") && role.overridden) {
      e.preventDefault();
      resetRole(role.name);
    }
  }
</script>

<div class="role-spine" aria-label="Role spine">
  {#each ["neutral", "brand", "accent"] as const as rampName (rampName)}
    <div
      class="spine-column"
      class:drag-target={dragTarget?.ramp === rampName}
      aria-label={`${rampName} ramp`}
      bind:this={columnRefs[rampName]}
    >
      <div class="column-label">{rampName}</div>
      <div class="swatch-stack">
        {#each ramps[rampName] as hex, gradeIdx (gradeIdx)}
          {@const grade = gradeIdx + 1}
          {@const roles = rolesAt(rampName, grade)}
          <div
            class="swatch-row"
            class:drag-grade-target={dragTarget?.ramp === rampName && dragTarget?.grade === grade}
          >
            <div class="swatch" style:background={hex} title={`${rampName}[${grade}] = ${hex}`}></div>
            <div class="role-tokens">
              {#each roles as role (role.name)}
                <span
                  class="role-token"
                  class:dragging={dragging?.role === role.name}
                  class:overridden={role.overridden}
                  role="button"
                  tabindex="0"
                  aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Delete"
                  onmouseenter={() => hoverRole(role.name)}
                  onmouseleave={unhoverRole}
                  onclick={() => clickRole(role.name)}
                  onpointerdown={(e) => onPointerDown(e, role.name)}
                  onpointermove={onPointerMove}
                  onpointerup={onPointerUp}
                  onkeydown={(e) => onKeyDown(e, role)}
                  title={`Role: ${role.name} → ${role.ramp}[${role.grade}]${role.overridden ? " (rebound)" : ""} — drag or arrow-keys to rebind${role.overridden ? "; ⌫ to reset" : ""}`}
                ><span class="grip" aria-hidden="true">⋮⋮</span>{role.name}{#if role.overridden}<button
                    type="button"
                    class="role-reset"
                    aria-label={`Reset ${role.name} to its cascade default`}
                    title="Reset to cascade default"
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={(e) => { e.stopPropagation(); resetRole(role.name); }}
                  >↺</button>{/if}</span>
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
    background: var(--tv-surface-bg, var(--tv-surface-bg, #fff));
    border: 1px solid var(--tv-cell-border, var(--tv-border, #e2e8f0));
    border-radius: 6px;
  }
  .spine-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 2px dashed transparent;
    border-radius: 4px;
    padding: 2px;
    transition: border-color 0.12s ease;
  }
  .spine-column.drag-target {
    border-color: var(--tv-accent, #2563eb);
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
    border-left: 2px solid transparent;
    padding-left: 2px;
    transition: border-left-color 0.12s ease;
  }
  .swatch-row.drag-grade-target {
    border-left-color: var(--tv-accent, #2563eb);
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
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 5px 1px 2px;
    border-radius: 3px;
    background: var(--tv-row-alt-bg, #f8fafc);
    border: 1px solid var(--tv-cell-border, var(--tv-border, #e2e8f0));
    font-size: 10px;
    line-height: 1.2;
    cursor: grab;
    user-select: none;
    color: var(--tv-text, var(--tv-text, #1a1a1a));
    transition: outline 0.12s ease, background 0.12s ease, opacity 0.12s ease;
  }
  .role-token:hover {
    outline: 2px solid var(--tv-accent, #2563eb);
    outline-offset: 1px;
  }
  .role-token.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }
  .role-token.overridden {
    border-color: var(--tv-accent, #2563eb);
    box-shadow: inset 2px 0 0 var(--tv-accent, #2563eb);
    font-weight: 600;
  }
  .role-reset {
    margin-left: 3px;
    padding: 0 2px;
    border: 0;
    background: transparent;
    color: var(--tv-accent, #2563eb);
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
    border-radius: 2px;
  }
  .role-reset:hover {
    background: var(--tv-row-alt-bg, #eef2ff);
  }
  .grip {
    font-size: 10px;
    color: #94a3b8;
    line-height: 0.8;
    user-select: none;
  }
</style>

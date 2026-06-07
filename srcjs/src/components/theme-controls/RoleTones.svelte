<!--
  RoleTones — the viewer's "safe middle rung" (theme-rework Wave 2, fork-1).

  A curated few Tier-2 role TONES (muted / subtle / alt-surface / border)
  nudged lighter ⇄ darker along their ramp. This is the rung BETWEEN the
  lean identity anchors and the studio's full spine: cascade-safe role
  rebinding (re-resolves, survives polarity/HC) — NOT raw token pins. The
  host wires `onset`/`onclear` to the store's setThemeRoleOverride /
  clearThemeRoleOverride (reuse of the existing role channel, no new verb).

  Store-agnostic by contract (control-contract gate): inputs + callbacks
  only; reads DEFAULT_ROLE_BINDINGS (a lib, not a store) for the baseline.
-->
<script lang="ts">
  import { DEFAULT_ROLE_BINDINGS } from "$lib/theme/role-bindings";
  import type { RoleName, RampName } from "$types/theme-roles";

  // Curated allowlist — each a neutral-ramp "tone" with a color token to
  // preview. Deliberately small: the viewer adjusts TONES, the studio
  // rebinds anything.
  const TONES: ReadonlyArray<{ role: RoleName; label: string; token: string }> = [
    { role: "text-muted" as RoleName,     label: "Muted text",  token: "--tv-text-muted" },
    { role: "text-subtle" as RoleName,    label: "Subtle text", token: "--tv-text-footnote-fg" },
    { role: "surface-subtle" as RoleName, label: "Alt row",     token: "--tv-row-alt-bg" },
    { role: "border-subtle" as RoleName,  label: "Cell border", token: "--tv-cell-border" },
  ];

  interface Props {
    /** Live role overrides from the theme artifact ({role: {ramp, grade}}). */
    roleOverrides: Record<string, { ramp: string; grade: number }>;
    /** Resolved cssVars — for the live result swatch. */
    cssVars: Record<string, string>;
    onset: (role: string, ramp: RampName, grade: number) => void;
    onclear: (role: string) => void;
  }
  const { roleOverrides, cssVars, onset, onclear }: Props = $props();

  function binding(role: RoleName): { ramp: string; grade: number } {
    return roleOverrides[role] ?? DEFAULT_ROLE_BINDINGS[role];
  }
  function overridden(role: RoleName): boolean {
    return roleOverrides[role] != null;
  }
  // − = paper-ward (lighter in light polarity), + = ink-ward. The swatch
  // shows the actual resolved result, so polarity ambiguity is moot.
  function step(role: RoleName, delta: number): void {
    const b = binding(role);
    const g = Math.max(1, Math.min(11, b.grade + delta));
    if (g !== b.grade) onset(role, b.ramp as RampName, g);
  }
</script>

<div class="role-tones">
  <p class="rt-caption">Tones — nudge a role lighter or darker. Cascade-safe; survives polarity & contrast.</p>
  {#each TONES as t (t.role)}
    {@const b = binding(t.role)}
    <div class="rt-row">
      <span class="rt-label">{t.label}</span>
      <span class="rt-swatch" style:background={cssVars[t.token] ?? "transparent"} title={cssVars[t.token] ?? ""}></span>
      <span class="rt-stepper">
        <button type="button" class="rt-btn" aria-label="{t.label} lighter" title="lighter"
                disabled={b.grade <= 1} onclick={() => step(t.role, -1)}>−</button>
        <span class="rt-grade" aria-label="{t.label} grade {b.grade} of 11">{b.grade}</span>
        <button type="button" class="rt-btn" aria-label="{t.label} darker" title="darker"
                disabled={b.grade >= 11} onclick={() => step(t.role, 1)}>+</button>
      </span>
      <button type="button" class="rt-reset" class:on={overridden(t.role)}
              aria-label="Reset {t.label} to default"
              title="Reset to default"
              disabled={!overridden(t.role)}
              onclick={() => onclear(t.role)}>↺</button>
    </div>
  {/each}
</div>

<style>
  .role-tones { padding: 2px 0 4px; }
  .rt-caption {
    margin: 0 0 6px;
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
  }
  .rt-row {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    min-height: 26px;
  }
  .rt-label {
    flex: 1;
    min-width: 0;
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink-2, #4a463c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rt-swatch {
    flex: none;
    width: 22px;
    height: 16px;
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-hair, 2px);
  }
  .rt-stepper {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .rt-btn {
    width: 20px;
    height: 20px;
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-hair, 2px);
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
  }
  .rt-btn:hover:not(:disabled) { background: var(--v2-hover-tint, rgba(21,20,14,0.05)); color: var(--v2-ink, #15140e); }
  .rt-btn:disabled { opacity: 0.35; cursor: default; }
  .rt-grade {
    min-width: 14px;
    text-align: center;
    font-size: var(--v2-text-small, 10.5px);
    font-variant-numeric: tabular-nums;
    color: var(--v2-ink-3, #8a8478);
  }
  .rt-reset {
    flex: none;
    width: 22px;
    height: 22px;
    border: 0;
    background: transparent;
    color: var(--v2-ink-3, #8a8478);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
    font-size: 11px;
  }
  .rt-reset.on { color: var(--v2-accent, #2563eb); }
  .rt-reset:disabled { opacity: 0.25; cursor: default; }
  .rt-reset:hover:not(:disabled) { background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }
</style>

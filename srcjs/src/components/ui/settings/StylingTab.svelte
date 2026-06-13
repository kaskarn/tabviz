<!--
  StylingTab — Layer 4 of the settings redesign (D21; canonical plan:
  docs/dev/settings-redesign.md). EXPERT WIRING: the deepest theme
  surface. Spacing FIRST (the Variations density signpost points here),
  then color-role remapping (the FULL kind-filtered roster — answering
  the review's "why those 4 role tones?"), then text-role rebinds, then
  the carried-overrides release list.

  DT-11 boundary (still-true, CLAUDE.md): this tab writes ONLY through
  SANCTIONED channels — setAuthoringInputs (density_factor, type_roles),
  setThemeRoleOverride / clearThemeRoleOverride (the safe middle rung),
  and the pin/override RELEASE verbs. NEVER setThemeField / writeThemePath
  (gate: settings-band-contract.test.ts). Per-token spacing + pin
  CREATION + component re-routing are sanctioned-verb gaps tracked as
  D25 + Phase-5 follow-ups; they stay R/`set_spacing()`/`set_pin()`
  territory for now.

  Travel: every write lands on the theme → Reset theme.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import { ALL_ROLES, ROLE_KIND, ALL_RAMPS, type RoleName, type RampName, type RoleKind } from "$types/theme-roles";
  import { useThemeInputs } from "./theme-inputs.svelte";
  import { DEFAULT_ROLE_BINDINGS } from "$lib/theme/role-bindings";
  import { EnumRow } from "$components/theme-controls";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import Dropdown from "$components/primitives/v2/Dropdown.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";
  import { DEFAULT_TYPE_ROLES, type TypeRoleName, type TypeRole } from "$lib/theme/typography";
  import { TYPE_ROLE_NAMES } from "$lib/theme/scale-roles";
  import { KNOWN_UNCONSUMED } from "$lib/theme/component-tokens";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const ti = useThemeInputs(() => store);
  const theme = $derived(ti.theme);
  const inputs = $derived(ti.inputs);
  const { commit, preview } = ti;

  // ── Spacing — the continuous density dial (Variations density signposts
  // here). density_factor is a theme INPUT → DT-11-clean. ───────────────
  const densityFactor = $derived(inputs?.density_factor ?? 1);

  // ── Color-role remapping (the sanctioned middle rung) ────────────────
  // The FULL roster, filtered by KIND (principle 6) — not an arbitrary
  // four. Status roles (pos/neg/warn/info) live in Identity; series roles
  // in Plots; both are excluded here.
  type Kind = RoleKind;
  let roleKind = $state<Kind>("text");
  const STATUS_PREFIX = /^(pos|neg|warn|info)-/;
  const rolesOfKind = $derived(
    ALL_ROLES.filter((r) =>
      ROLE_KIND[r] === roleKind && !r.startsWith("series-") && !STATUS_PREFIX.test(r)),
  );
  let roleSel = $state<RoleName>("text");
  // Keep the selection valid when the kind filter changes.
  $effect(() => {
    if (!rolesOfKind.includes(roleSel) && rolesOfKind.length) roleSel = rolesOfKind[0];
  });
  const roleOpts = $derived(rolesOfKind.map((r) => ({ value: r, label: r })));

  const overrides = $derived(
    theme?.roleOverrides ?? {},
  );
  // Current binding = the override if set, else the cascade default.
  const curBinding = $derived(
    overrides[roleSel] ?? DEFAULT_ROLE_BINDINGS[roleSel],
  );
  const roleOverridden = $derived(roleSel in overrides);

  function setRole(ramp: RampName, grade: number): void {
    store.setThemeRoleOverride(roleSel, ramp, grade);
  }

  // ── Text-role rebinds (moved here from Identity's interim home) ──────
  // Default to "cell" (every data cell renders it) so the family/size/
  // weight value controls are immediately consequential — "footnote" is
  // absent from most figures.
  let typeRoleSel = $state<TypeRoleName>("cell");
  const TYPE_ROLE_OPTS = TYPE_ROLE_NAMES.map((r) => ({ value: r, label: r }));
  const TYPE_FAMILY_OPTS = ["display", "body", "mono", "numeric"].map((v) => ({ value: v, label: v }));
  const TYPE_SIZE_OPTS = ["label", "foot", "body", "head", "subtitle", "title", "display"]
    .map((v) => ({ value: v, label: v }));
  const TYPE_WEIGHT_OPTS = ["regular", "medium", "semibold", "bold"].map((v) => ({ value: v, label: v }));
  const effectiveTypeRole = $derived<TypeRole>({
    ...DEFAULT_TYPE_ROLES[typeRoleSel],
    ...(inputs?.type_roles?.[typeRoleSel] ?? {}),
  });
  const typeRoleOverridden = $derived(
    Object.keys(inputs?.type_roles?.[typeRoleSel] ?? {}).length > 0,
  );
  // Honesty filter: a type-role channel is editable only if its backing
  // token (`--tv-text-<role>-<channel>`) actually paints something. Many
  // are KNOWN_UNCONSUMED headroom — e.g. CELL family+weight (cell text
  // deliberately follows the body family; svg-generator skips them to keep
  // DOM/export parity), NUMERIC size+weight, TICK size, several -family.
  // Offering a control that does nothing is the "option nothing reads" bug
  // class the component roster already filters; mirror it here so each role
  // shows only the channels it really has. (Fix 2026-06-13.)
  const liveTypeChannels = $derived({
    family: !KNOWN_UNCONSUMED.has(`--tv-text-${typeRoleSel}-family`),
    size:   !KNOWN_UNCONSUMED.has(`--tv-text-${typeRoleSel}-size`),
    weight: !KNOWN_UNCONSUMED.has(`--tv-text-${typeRoleSel}-weight`),
  });
  const hiddenChannelNote = $derived(
    [["family", liveTypeChannels.family], ["size", liveTypeChannels.size], ["weight", liveTypeChannels.weight]]
      .filter(([, live]) => !live).map(([k]) => k).join(" / "),
  );
  function patchTypeRole(key: "family" | "size" | "weight", value: string): void {
    const cur = inputs!.type_roles?.[typeRoleSel] ?? {};
    commit({
      ...inputs!,
      type_roles: { ...inputs!.type_roles, [typeRoleSel]: { ...cur, [key]: value } },
    });
  }
  function resetTypeRole(): void {
    const next = { ...inputs!.type_roles };
    delete (next as Record<string, unknown>)[typeRoleSel];
    commit({ ...inputs!, type_roles: Object.keys(next).length ? next : undefined });
  }
  let textRolesOpen = $state(false);
  const textRolesSummary = $derived.by(() => {
    const n = Object.keys(inputs?.type_roles ?? {}).length;
    return n > 0 ? `${n} rebound` : "defaults";
  });

  // ── Carried overrides (release list — moved here from Identity) ──────
  const pins = $derived(
    Object.entries(theme?.pins ?? {}),
  );
  const ovList = $derived(
    Object.entries(theme?.roleOverrides ?? {}),
  );
  let carriedOpen = $state(false);

  const KIND_SEGS: { value: Kind; label: string }[] = [
    { value: "text", label: "text" },
    { value: "fill", label: "fill" },
    { value: "border", label: "border" },
  ];
</script>

{#if inputs}
  <div class="styling-tab">
    <!-- ── Spacing ──────────────────────────────────────────────────── -->
    <div class="strata">spacing</div>
    <div data-st="density-factor">
      <Field label="Density" hint="Fine dial over the Variations density preset. 1.0 = the preset unchanged.">
        <Slider value={densityFactor} min={0.5} max={2} step={0.01}
                valueText={`×${densityFactor.toFixed(2)}`}
                ariaLabel="Density factor"
                onchange={(v) => preview({ ...inputs, density_factor: v })}
                oncommit={(v) => commit({ ...inputs, density_factor: v })} />
      </Field>
    </div>

    <!-- ── Color roles ──────────────────────────────────────────────── -->
    <div class="strata">color roles</div>
    <p class="lede">Re-route any role to a ramp + grade. The cascade re-resolves;
      everything bound to the role follows.</p>
    <!-- Kind + Role are NAVIGATION (they choose what the ramp/grade below
         edit) — no data-st marker, so the consequence harness doesn't
         demand a figure delta from a selector. -->
    <EnumRow label="Kind" value={roleKind}
             segments={KIND_SEGS}
             onchange={(v) => (roleKind = v as Kind)} />
    <Field label="Role">
      <Dropdown value={roleSel} ariaLabel="Role to re-route"
              onchange={(v) => (roleSel = v as RoleName)} options={roleOpts} />
    </Field>
    <div class="sub-group">
      <div data-st="role-ramp">
        <EnumRow label="Ramp" value={curBinding.ramp}
                 segments={ALL_RAMPS.map((r) => ({ value: r, label: r }))}
                 onchange={(v) => setRole(v as RampName, curBinding.grade)} />
      </div>
      <div data-st="role-grade">
        <Field label="Grade"
               hint="Position on the ramp (1 = lightest, 11 = darkest)."
               onreset={roleOverridden ? () => store.clearThemeRoleOverride(roleSel) : undefined}>
          <Slider value={curBinding.grade} min={1} max={11} step={1}
                  ariaLabel="Role grade"
                  oncommit={(v) => setRole(curBinding.ramp, v)} />
        </Field>
      </div>
    </div>

    <!-- ── Text roles ───────────────────────────────────────────────── -->
    <div class="strata">text roles</div>
    <DisclosureField label="Rebind a text role" summary={textRolesSummary} bind:open={textRolesOpen}>
      <Field label="Role"
             hint={hiddenChannelNote
               ? `Only the channels this role actually paints are shown — ${hiddenChannelNote} is fixed for ${typeRoleSel}.`
               : "Rebind one type role's family / size / weight."}
             onreset={typeRoleOverridden ? resetTypeRole : undefined}>
        <Dropdown value={typeRoleSel} ariaLabel="Type role to rebind"
                onchange={(v) => (typeRoleSel = v as TypeRoleName)} options={TYPE_ROLE_OPTS} />
      </Field>
      <div class="sub-group">
        {#if liveTypeChannels.family}
          <div data-st="type-family">
            <Field label="Family">
              <Dropdown value={effectiveTypeRole.family} ariaLabel="{typeRoleSel} family"
                      onchange={(v) => patchTypeRole("family", v)} options={TYPE_FAMILY_OPTS} />
            </Field>
          </div>
        {/if}
        {#if liveTypeChannels.size}
          <div data-st="type-size">
            <Field label="Size">
              <Dropdown value={effectiveTypeRole.size} ariaLabel="{typeRoleSel} size"
                      onchange={(v) => patchTypeRole("size", v)} options={TYPE_SIZE_OPTS} />
            </Field>
          </div>
        {/if}
        {#if liveTypeChannels.weight}
          <div data-st="type-weight">
            <Field label="Weight">
              <Dropdown value={effectiveTypeRole.weight} ariaLabel="{typeRoleSel} weight"
                      onchange={(v) => patchTypeRole("weight", v)} options={TYPE_WEIGHT_OPTS} />
            </Field>
          </div>
        {/if}
      </div>
    </DisclosureField>

    <!-- ── Carried overrides ────────────────────────────────────────── -->
    {#if pins.length > 0 || ovList.length > 0}
      <div class="strata">carried overrides</div>
      <DisclosureField
        label="Set in R — release here"
        summary={`${pins.length + ovList.length} carried`}
        bind:open={carriedOpen}
      >
        {#each ovList as [role, binding] (role)}
          <div class="ov-row">
            <code class="ov-name">{role}</code>
            <span class="ov-value">{binding.ramp} · {binding.grade}</span>
            <button type="button" class="ov-clear"
                    aria-label="Release role override {role}"
                    title="Release role override"
                    onclick={() => store.clearThemeRoleOverride(role)}>✕</button>
          </div>
        {/each}
        {#each pins as [cssVar, value] (cssVar)}
          <div class="ov-row">
            <code class="ov-name">{cssVar}</code>
            <span class="ov-value">{value}</span>
            <button type="button" class="ov-clear"
                    aria-label="Release pin {cssVar}"
                    title="Release pin"
                    onclick={() => store.clearThemePin(cssVar)}>✕</button>
          </div>
        {/each}
      </DisclosureField>
    {/if}
  </div>
{/if}

<style>
  .styling-tab {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
    padding: 8px 0;
  }
  .strata {
    margin-top: 8px;
    padding: 6px 0 2px;
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink-3, #8a8478);
  }
  .lede {
    margin: 0 0 6px;
    font-size: var(--v2-text-small, 10.5px);
    line-height: 1.4;
    color: var(--v2-ink-3, #8a8478);
  }
  .sub-group {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-tight, 4px);
    margin-left: 4px;
    padding-left: 8px;
    border-left: 1px solid var(--v2-rule-soft, #e6e0d1);
  }
  .ov-row {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    min-height: 24px;
  }
  .ov-name {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink, #15140e);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ov-value {
    margin-left: auto;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-2, #4a463c);
    white-space: nowrap;
  }
  .ov-clear {
    flex: none;
    width: 24px;
    height: 24px;
    border: 0;
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
    font-size: var(--v2-text-small, 10.5px);
  }
  .ov-clear:hover { color: var(--v2-hot, #b53a1f); background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }
</style>

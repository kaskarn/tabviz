<!--
  ThemeBand — the settings host for the shared Tier-1 sections
  (settings-overhaul P2/P3). A thin wrapper: wires the widget store's
  authoring-inputs channel into the store-agnostic Tier1Sections (the
  ONE implementation both hosts mount; the studio rail is the roomy
  face of the same component).

  DT-11 (boundary-is-real): this file calls ONLY
  setAuthoringInputs/previewAuthoringInputs — never setThemeField with a
  T2/3 path. The grep gate in settings-band-contract.test.ts pins it.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import type { WebTheme } from "$types/theme-resolved";
  import Tier1Sections from "$components/theme-controls/Tier1Sections.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";
  import { getCssVars } from "$lib/theme/consumer-bridge";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null,
  );
  const cssVars = $derived(theme ? getCssVars(theme) : {});


  // ── Studio overrides (DT-12): pins + role rebinds riding the theme
  // artifact must be VISIBLE and CLEARABLE here, not just in the studio —
  // an imported/R-authored theme may carry them into a widget that has
  // no studio. Read-only list + per-entry release; editing stays studio
  // territory. ──
  const pins = $derived(
    Object.entries((theme as WebTheme | undefined)?.pins ?? {}),
  );
  const overrides = $derived(
    Object.entries((theme as WebTheme | undefined)?.roleOverrides ?? {}),
  );
  let overridesOpen = $state(false);
</script>

{#if inputs}
  {#if pins.length > 0}
    <!-- Pins-are-last-resort banner (theme-rework Wave 1): a theme can
         arrive (R-authored / imported) carrying pins that bypass the
         cascade. Name the cost prominently — per-pin release below. -->
    <div class="pins-banner" role="status">
      📌 This theme has {pins.length} hardcoded pin{pins.length > 1 ? "s" : ""} — pinned
      tokens bypass the cascade and may not respond to polarity or theme edits.
    </div>
  {/if}
  <Tier1Sections
    {inputs}
    {cssVars}
    layout="compact"
    onchange={(next) => store.setAuthoringInputs(next)}
    onpreview={(next) => store.previewAuthoringInputs(next)}
  />
  {#if pins.length > 0 || overrides.length > 0}
    <div class="carried-overrides">
      <DisclosureField
        label="Carried overrides"
        summary={`${pins.length + overrides.length} carried`}
        bind:open={overridesOpen}
      >
        {#each overrides as [role, binding] (role)}
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
        <p class="ov-hint">Set in R (set_role / set_pin) — release here.</p>
      </DisclosureField>
    </div>
  {/if}
{/if}

<style>
  .pins-banner {
    margin: 0 0 8px;
    padding: 6px 10px;
    border-radius: var(--v2-r-soft, 3px);
    font-size: var(--v2-text-small, 10.5px);
    line-height: 1.35;
    background: color-mix(in srgb, #7c3aed 9%, var(--v2-paper, #fff));
    border: 1px solid color-mix(in srgb, #7c3aed 28%, transparent);
    color: var(--v2-ink, #4c2889);
  }
  .carried-overrides { padding: 0 0 8px; }
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
  .ov-hint {
    margin: 2px 0 0;
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
  }
</style>

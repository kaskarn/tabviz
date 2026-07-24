<!--
  SpacingTab — the fourth "Edit theme" inner tab (D42; plan:
  docs/dev/spacing-tab-plan.md). Fine per-token spacing control: the
  continuous density dial (relocated from Styling — the Variations density
  PRESET stays in Variations) + absolute-px overrides per spacing token,
  grouped by figure region.

  DT-11 boundary: every theme-tier write goes through the SANCTIONED
  spacing verbs (setSpacingOverride / previewSpacingOverride /
  clearSpacingOverride / resetSpacingOverrides) + setAuthoringInputs for the
  density dial — all route through the authoring channel (re-resolve;
  theme-portable), NEVER setThemeField / writeThemePath (gate:
  settings-band-contract.test.ts). Overrides are absolute px, applied AFTER
  density × density_factor, and survive density changes.

  One FIGURE-scoped sub-band (row heights by type) is the exception: it
  writes figure state (setRowKindHeight → spec.figureLayout, Reset figure),
  relocated here from FigureBand so all height control lives in one place.
  It is visually seamed off as "stays with this figure".

  Travel: the token sliders + density dial → Reset theme; the row-height
  sub-band → Reset figure.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import { useThemeInputs } from "./theme-inputs.svelte";
  import type { SpacingToken } from "$lib/theme/spacing-tokens";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const ti = useThemeInputs(() => store);
  const inputs = $derived(ti.inputs);
  const { commit, preview } = ti;

  // The continuous density dial (relocated from Styling). density_factor is
  // a theme INPUT → DT-11-clean. The coarse compact/comfortable/spacious
  // PRESET lives in Variations; this multiplies it.
  const densityFactor = $derived(inputs?.density_factor ?? 1);

  // Per-token override model: resolved px + override state per token.
  const roster = $derived(store.spacingRoster());
  const byToken = $derived(new Map(roster.map((r) => [r.token, r])));

  interface TokenCtl { token: SpacingToken; label: string; hint: string; min: number; max: number; }
  interface Section { title: string; disclosure: boolean; tokens: TokenCtl[]; }

  // First-cut roster: the 11 tokens with a confirmed live renderer (plan §2).
  // Deferred: indent_per_level / cell_padding_y / container_padding, plus
  // GROUP_PADDING — the plan listed it as live off `svg-generator`'s local
  // `groupPadding`, but that local reads --tv-spacing-column-group-padding;
  // the groupPadding TOKEN has no CSS var and no reader in either runtime, so
  // a slider for it would be dead (D28 class — the consequence gate caught it
  // at 0px). It rejoins when something renders it. The shell/paper "page
  // frame" section is a follow-up.
  const SECTIONS: readonly Section[] = [
    { title: "rows & cells", disclosure: false, tokens: [
      { token: "rowHeight", label: "Row height", min: 8, max: 120,
        hint: "Base height every row scales from. Per-row-type pins live below." },
      { token: "cellPaddingX", label: "Cell side padding", min: 0, max: 40,
        hint: "Space left and right of cell content." },
    ] },
    { title: "groups", disclosure: true, tokens: [
      { token: "columnGroupPadding", label: "Group heading padding", min: 0, max: 40,
        hint: "Padding around a column-group (spanner) heading." },
      { token: "rowGroupPadding", label: "Group row padding", min: 0, max: 60,
        hint: "Vertical padding inside group-header rows." },
    ] },
    { title: "header & footer", disclosure: true, tokens: [
      { token: "headerHeight", label: "Header row height", min: 16, max: 120,
        hint: "Height of the column-header row." },
      { token: "headerGap", label: "Header-to-body gap", min: 0, max: 60,
        hint: "Space below the header block, above the first row." },
      { token: "titleSubtitleGap", label: "Title–subtitle gap", min: 0, max: 60,
        hint: "Space between the title and the subtitle." },
      { token: "axisGap", label: "Axis gap", min: 0, max: 60,
        hint: "Space between the table body and the forest axis." },
      { token: "footerGap", label: "Footer gap", min: 0, max: 80,
        hint: "Space above the footer / footnote block." },
      { token: "bottomMargin", label: "Bottom margin", min: 0, max: 80,
        hint: "Space below everything, inside the figure." },
    ] },
  ];

  // Count overridden tokens per section for the disclosure summary.
  function adjustedCount(sec: Section): number {
    return sec.tokens.filter((t) => byToken.get(t.token)?.overridden).length;
  }
  function sectionSummary(sec: Section): string {
    const n = adjustedCount(sec);
    return n > 0 ? `${n} adjusted` : "default";
  }
  /** Rejoin every token in a section to `preset × factor` (gutter reset). */
  function resetSection(sec: Section): void {
    for (const t of sec.tokens) store.clearSpacingOverride(t.token);
  }

  // Any token overridden anywhere → the tab-level "Reset spacing" is live.
  const anyOverridden = $derived(roster.some((r) => r.overridden));

  // Pre-seeded so `bind:open` has a real boolean per section (a missing key
  // would bind `undefined` into a boolean prop).
  const disclosureOpen = $state<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.title, false])),
  );

  // ── Figure-scoped row-height sub-band (relocated from FigureBand) ──────
  const rowKinds = $derived(store.rowKindRoster);
  const pinnedCount = $derived(rowKinds.filter((r) => r.pinned).length);
  const rowPinsSummary = $derived(pinnedCount ? `${pinnedCount} pinned` : "default");
  let rowPinsOpen = $state(false);
</script>

<!-- One seam-grammar slider per token: drag previews, release commits ONE
     override, the gutter ✕ drops the key (rejoin the preset). A token with
     no override shows its resolved `preset × factor` px and no reset. -->
{#snippet tokenField(ctl: TokenCtl)}
  {@const r = byToken.get(ctl.token)}
  <div data-spt={ctl.token}>
    <Field label={ctl.label} hint={ctl.hint}
           onreset={r?.overridden ? () => store.clearSpacingOverride(ctl.token) : undefined}>
      <Slider value={r?.px ?? ctl.min} min={ctl.min} max={ctl.max} step={1} suffix="px"
              ariaLabel={ctl.label}
              onchange={(v) => store.previewSpacingOverride(ctl.token, v)}
              oncommit={(v) => store.setSpacingOverride(ctl.token, v)} />
    </Field>
  </div>
{/snippet}

{#if inputs}
  <div class="spacing-tab">
    <p class="lede">Coarse density is in Variations. Overrides here are absolute px
      and survive density changes — reset any control to rejoin the preset.</p>

    <!-- ── Density dial ─────────────────────────────────────────────── -->
    <div class="strata">density</div>
    <div data-spt="density-factor">
      <Field label="Overall density"
             hint="Fine dial over the Variations density preset. ×1.0 = the preset unchanged.">
        <Slider value={densityFactor} min={0.5} max={2} step={0.01}
                valueText={`×${densityFactor.toFixed(2)}`}
                ariaLabel="Overall density"
                onchange={(v) => preview({ ...inputs, density_factor: v })}
                oncommit={(v) => commit({ ...inputs, density_factor: v })} />
      </Field>
    </div>

    <!-- ── Per-token sections ───────────────────────────────────────── -->
    <!-- Open sections carry a strata rule; collapsed ones ARE the rule
         (the DisclosureField head reads as its own band) — a strata div
         above a disclosure of the same name would just print the title
         twice. Disclosure depth stays ≤ 1 (DisclosureField LAW). -->
    {#each SECTIONS as sec (sec.title)}
      {#if sec.disclosure}
        <DisclosureField label={sec.title} summary={sectionSummary(sec)}
                         pinned={adjustedCount(sec) > 0}
                         onreset={() => resetSection(sec)}
                         bind:open={disclosureOpen[sec.title]}>
          {#each sec.tokens as ctl (ctl.token)}
            {@render tokenField(ctl)}
          {/each}
        </DisclosureField>
      {:else}
        <div class="strata">{sec.title}</div>
        {#each sec.tokens as ctl (ctl.token)}
          {@render tokenField(ctl)}
        {/each}
      {/if}
    {/each}

    <!-- ── Row heights by type (FIGURE-scoped) ──────────────────────── -->
    <!-- The one figure-tier island on a theme-tier tab (D42 S-5,
         relocated from FigureBand so all height control lives together).
         Its gutter reset calls resetRowKindHeights — the figure-scoped
         verb — so the pins are never orphaned from a reset control; the
         panel's "Reset figure" button still clears them too. -->
    {#if rowKinds.length > 0}
      <div class="strata">row heights by type</div>
      <div class="figure-seam">stays with this figure · not exported with the theme</div>
      <DisclosureField label="Row heights" summary={rowPinsSummary}
                       pinned={pinnedCount > 0}
                       onreset={() => store.resetRowKindHeights()}
                       bind:open={rowPinsOpen}>
        {#each rowKinds as { kind, px, pinned } (kind)}
          <Field label={kind.replace("_", " ")}>
            <span class="pin-row">
              <Slider value={px} min={12} max={120} step={1} suffix="px"
                      ariaLabel="{kind} row height"
                      onchange={(v) => store.setRowKindHeight(kind, v)}
                      oncommit={(v) => store.setRowKindHeight(kind, v)} />
              {#if pinned}
                <button type="button" class="pin-clear" title="Release pin"
                        onclick={() => store.setRowKindHeight(kind, null)}>↻</button>
              {:else}
                <!-- keep the slider track width stable between states -->
                <span class="pin-clear-spacer" aria-hidden="true"></span>
              {/if}
            </span>
          </Field>
        {/each}
      </DisclosureField>
    {/if}

    <!-- ── Reset (theme-tier overrides only) ────────────────────────── -->
    <div class="spacing-foot">
      <button type="button" class="reset-spacing" disabled={!anyOverridden}
              onclick={() => store.resetSpacingOverrides()}>Reset spacing</button>
    </div>
  </div>
{/if}

<style>
  .spacing-tab {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
    padding: 8px 0;
  }
  .lede {
    margin: 0 0 6px;
    font-size: var(--v2-text-small, 10.5px);
    line-height: 1.4;
    color: var(--v2-ink-3, #8a8478);
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
  .figure-seam {
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    padding: 0 0 4px;
  }
  .pin-row {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    width: 100%;
    min-width: 0;
  }
  .pin-clear {
    flex: none;
    width: 24px;
    height: var(--v2-control-h, 22px);
    border: 0;
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
    padding: 0;
  }
  .pin-clear:hover { color: var(--v2-ink, #15140e); background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }
  .pin-clear-spacer { flex: none; width: 24px; height: var(--v2-control-h, 22px); }
  .spacing-foot {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
  }
  .reset-spacing {
    font-size: var(--v2-text-body, 11.5px);
    padding: 3px 10px;
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
  }
  .reset-spacing:hover:not(:disabled) {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .reset-spacing:disabled { opacity: 0.4; cursor: default; }
</style>

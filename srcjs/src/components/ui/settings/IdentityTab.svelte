<!--
  IdentityTab — Layer 2 of the settings redesign (D21; canonical plan:
  docs/dev/settings-redesign.md). WHO THE THEME IS: the four OKLCH
  anchors (+ status colors), the typography FAMILIES, geometry, and the
  data scheme. Tier-1 identity editing — every write re-resolves the
  cascade. Mode flips live in Variations; role/token wiring is Styling
  (L4) territory.

  Travel: theme inputs → theme artifact → Reset theme.

  Two STYLING-BOUND groups live here under marked interim disclosures
  until Phase 5 (homeless controls are worse than a marked interim):
  type-ROLE rebinds and the carried-overrides release list.

  This replaces the interim ThemeBand mount; Tier1Sections remains the
  DORMANT studio rail's component (D22 — keep passing, don't extend).
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs, OklchTriple } from "$types/theme-inputs";
  import type { WebTheme } from "$types/theme-resolved";
  import AnchorRow from "$components/theme-controls/AnchorRow.svelte";
  import { EnumRow } from "$components/theme-controls";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import Dropdown from "$components/primitives/v2/Dropdown.svelte";
  import FontFamily from "$components/primitives/v2/FontFamily.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";
  import { hexToOklch } from "$lib/oklch";
  import { reflectL } from "$lib/theme/polarity";
  import { getCssVars } from "$lib/theme/consumer-bridge";
  import { CATEGORICAL_SCHEMES } from "$lib/data-schemes";
  import { CORNER_SLOTS, RULE_SLOTS, type CornerSlot, type RuleSlot } from "$lib/theme/scale-roles";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null,
  );
  const cssVars = $derived(theme ? getCssVars(theme) : {});

  function commit(next: ThemeInputs): void {
    store.setAuthoringInputs(next);
  }
  function preview(next: ThemeInputs): void {
    store.previewAuthoringInputs(next);
  }
  function patch<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]): void {
    commit({ ...inputs!, [key]: value });
  }

  // ── Anchors (display-reflection in dark polarity — reflectL is an
  // involution, so the round-trip is lossless) ─────────────────────────
  type AnchorKey = "paper" | "ink" | "brand" | "accent";
  const ANCHOR_ROWS: ReadonlyArray<{ key: AnchorKey; label: string; optional: boolean }> = [
    { key: "paper",  label: "Paper",  optional: false },
    { key: "ink",    label: "Ink",    optional: false },
    { key: "brand",  label: "Brand",  optional: false },
    { key: "accent", label: "Accent", optional: true },
  ];
  let openAnchor = $state<string | null>(null);

  const isDark = $derived((inputs?.polarity ?? "light") === "dark");
  function reflectTriple(t: OklchTriple): OklchTriple {
    return { L: reflectL(t.L), C: t.C, H: t.H };
  }
  function toDisplay(t: OklchTriple): OklchTriple { return isDark ? reflectTriple(t) : t; }
  function fromDisplay(t: OklchTriple): OklchTriple { return isDark ? reflectTriple(t) : t; }

  function anchorTriple(key: AnchorKey): OklchTriple {
    const a = inputs!.anchors;
    const raw = key === "accent" ? (a.accent ?? a.brand) : a[key];
    return toDisplay(raw);
  }
  function anchorMirrored(key: AnchorKey): boolean {
    if (key === "accent") return !inputs!.anchors.accent;
    return false;
  }
  function withAnchor(key: AnchorKey, t: OklchTriple): ThemeInputs {
    return { ...inputs!, anchors: { ...inputs!.anchors, [key]: fromDisplay(t) } };
  }
  function clearAnchor(key: "accent"): void {
    const next = { ...inputs!.anchors };
    delete (next as Record<string, unknown>)[key];
    commit({ ...inputs!, anchors: next });
  }

  // ── Status anchors ───────────────────────────────────────────────────
  type StatusKey = "positive" | "negative" | "warning" | "info";
  const STATUS_ROWS: ReadonlyArray<{ key: StatusKey; label: string }> = [
    { key: "positive", label: "Positive" },
    { key: "negative", label: "Negative" },
    { key: "warning",  label: "Warning" },
    { key: "info",     label: "Info" },
  ];
  let statusOpen = $state(false);
  function statusTriple(key: StatusKey): OklchTriple {
    const set = inputs!.status?.[key];
    if (set) return set;
    const hex = cssVars[`--tv-status-${key}`];
    if (hex) {
      const t = hexToOklch(hex);
      if (Number.isFinite(t.L)) return t;
    }
    return { L: 0.6, C: 0.1, H: 0 };
  }
  function withStatus(key: StatusKey, t: OklchTriple): ThemeInputs {
    return { ...inputs!, status: { ...inputs!.status, [key]: t } };
  }
  const statusSummary = $derived.by(() => {
    const n = Object.keys(inputs?.status ?? {}).length;
    return n > 0 ? `${n} set` : "defaults";
  });

  // ── Families ─────────────────────────────────────────────────────────
  function patchFonts(key: "body" | "display" | "mono" | "numeric", value: string): void {
    commit({ ...inputs!, fonts: { ...inputs!.fonts, [key]: value } });
  }

  // ── Scheme ───────────────────────────────────────────────────────────
  const schemeOptions = $derived([
    { value: "", label: "default (brand interleave)" },
    ...Object.keys(CATEGORICAL_SCHEMES).map((k) => ({ value: k, label: k })),
  ]);
  // Consequence-or-absence: the categorical scheme colors series slots
  // 1+ only (slot 0 keeps brand identity), so it is INERT on a
  // single-series figure. Present only when a viz column carries ≥2
  // series — a multi-effect forest, or any multi-series viz (bar /
  // boxplot / violin). Found by the consequence harness (single-series
  // fixture: scheme moved 0 pixels).
  const hasMultiSeries = $derived(
    store.allColumns.some((c) => {
      if (c.type === "viz_bar" || c.type === "viz_boxplot" || c.type === "viz_violin") return true;
      if (c.type === "forest") return (c.options?.forest?.effects?.length ?? 0) >= 2;
      return false;
    }),
  );

  // ── Geometry (slots + fine stops) ────────────────────────────────────
  let geometryOpen = $state(false);
  function patchGeometry(group: "radius" | "border_width", key: string, value: number): void {
    commit({
      ...inputs!,
      geometry: {
        ...inputs!.geometry,
        [group]: { ...(inputs!.geometry?.[group] ?? {}), [key]: value },
      },
    });
  }
  function applyCorners(slot: CornerSlot): void {
    commit({ ...inputs!, geometry: { ...inputs!.geometry, radius: { ...CORNER_SLOTS[slot] } } });
  }
  function applyRules(slot: RuleSlot): void {
    commit({ ...inputs!, geometry: { ...inputs!.geometry, border_width: { ...RULE_SLOTS[slot] } } });
  }
  function matchSlot<T extends Record<string, number>>(
    cur: Partial<T> | undefined, table: Record<string, T>, keys: (keyof T)[],
    defaultSlot: string,
  ): string {
    if (!cur || keys.every((k) => cur[k] === undefined)) return defaultSlot;
    for (const [name, vals] of Object.entries(table)) {
      if (keys.every((k) => cur[k] === vals[k])) return name;
    }
    return "custom";
  }
  const currentCorners = $derived(
    matchSlot(inputs?.geometry?.radius, CORNER_SLOTS as unknown as Record<string, Record<string, number>>,
      ["sm", "md", "lg", "pill"], "soft"));
  const currentRules = $derived(
    matchSlot(inputs?.geometry?.border_width, RULE_SLOTS as unknown as Record<string, Record<string, number>>,
      ["hair", "thin", "regular", "thick"], "normal"));
  const geometrySummary = $derived(`${currentCorners} · ${currentRules}`);

  // The pins-banner names carried pins; the RELEASE list + type-role
  // rebinds moved to the Styling inner tab (Phase 5).
  const pins = $derived(
    Object.entries((theme as WebTheme | undefined)?.pins ?? {}),
  );
</script>

{#if inputs}
  <div class="identity-tab">
    {#if pins.length > 0}
      <div class="pins-banner" role="status">
        📌 This theme has {pins.length} hardcoded pin{pins.length > 1 ? "s" : ""} — pinned
        tokens bypass the cascade and may not respond to polarity or theme edits.
      </div>
    {/if}

    <!-- ── Color identity ──────────────────────────────────────────── -->
    {#each ANCHOR_ROWS as row (row.key)}
      <div data-it="anchor-{row.key}">
        <AnchorRow
          label={row.label}
          triple={anchorTriple(row.key)}
          layout="compact"
          expanded={openAnchor === row.key}
          onexpand={(o) => (openAnchor = o ? row.key : null)}
          mirrored={anchorMirrored(row.key)}
          onclear={row.optional && !anchorMirrored(row.key)
            ? () => clearAnchor(row.key as "accent")
            : undefined}
          oncommit={(t) => commit(withAnchor(row.key, t))}
          onpreview={(t) => preview(withAnchor(row.key, t))}
        />
      </div>
    {/each}
    <DisclosureField label="Status colors" summary={statusSummary} bind:open={statusOpen}>
      {#each STATUS_ROWS as row (row.key)}
        <AnchorRow
          label={row.label}
          triple={statusTriple(row.key)}
          layout="compact"
          expanded={openAnchor === `status-${row.key}`}
          onexpand={(o) => (openAnchor = o ? `status-${row.key}` : null)}
          mirrored={!inputs.status?.[row.key]}
          oncommit={(t) => commit(withStatus(row.key, t))}
          onpreview={(t) => preview(withStatus(row.key, t))}
        />
      {/each}
    </DisclosureField>
    {#if hasMultiSeries}
      <div data-it="scheme">
        <Field label="Scheme" hint="Categorical palette for series slots 1+; slot 0 keeps brand identity.">
          <Dropdown value={inputs.categorical ?? ""}
                  ariaLabel="Categorical scheme"
                  onchange={(v) => patch("categorical", (v || undefined) as ThemeInputs["categorical"])}
                  options={schemeOptions} />
        </Field>
      </div>
    {/if}
    <div data-it="monochrome">
      <EnumRow label="Mono" hint="Neutral ramp rides the brand hue (phosphor / sepia looks)."
               value={inputs.monochrome ? "on" : "off"}
               segments={[{ value: "off", label: "off" }, { value: "on", label: "on" }]}
               onchange={(v) => patch("monochrome", v === "on")} />
    </div>

    <!-- ── Families ────────────────────────────────────────────────── -->
    <div class="strata">families</div>
    <div data-it="font-body">
      <Field label="Body">
        <FontFamily value={inputs.fonts?.body ?? null}
                    ariaLabel="Body font"
                    onchange={(v) => patchFonts("body", v)} />
      </Field>
    </div>
    <div data-it="font-display">
      <Field label="Display" hint="Titles and headers. Blank = follow the body font.">
        <FontFamily value={inputs.fonts?.display ?? null}
                    ariaLabel="Display font"
                    onchange={(v) => patchFonts("display", v)} />
      </Field>
    </div>
    <div data-it="font-mono">
      <Field label="Mono" hint="Axis ticks and label chrome.">
        <FontFamily value={inputs.fonts?.mono ?? null}
                    ariaLabel="Mono font"
                    onchange={(v) => patchFonts("mono", v)} />
      </Field>
    </div>
    <div data-it="font-numeric">
      <Field label="Numbers" hint="Figure font for number columns. Blank = follow the body font.">
        <FontFamily value={inputs.fonts?.numeric ?? null}
                    ariaLabel="Numeric figure font"
                    onchange={(v) => patchFonts("numeric", v)} />
      </Field>
    </div>

    <!-- ── Geometry ────────────────────────────────────────────────── -->
    <div class="strata">geometry</div>
    <DisclosureField label="Geometry" summary={geometrySummary} bind:open={geometryOpen}>
      <div data-it="corners">
        <EnumRow label="Corners" hint="Coarse radius preset; the stops below fine-tune."
                 value={currentCorners}
                 segments={["sharp", "soft", "round", ...(currentCorners === "custom" ? ["custom"] : [])].map((v) => ({ value: v, label: v }))}
                 onchange={(v) => v !== "custom" && applyCorners(v as CornerSlot)} />
      </div>
      <div data-it="rules">
        <EnumRow label="Rules" hint="Coarse border-weight preset; the stops below fine-tune."
                 value={currentRules}
                 segments={["fine", "normal", "strong", ...(currentRules === "custom" ? ["custom"] : [])].map((v) => ({ value: v, label: v }))}
                 onchange={(v) => v !== "custom" && applyRules(v as RuleSlot)} />
      </div>
      <Field label="Radius sm"><Slider value={inputs.geometry?.radius?.sm ?? 2} min={0} max={24} step={1} suffix="px" ariaLabel="Radius sm" oncommit={(v) => patchGeometry("radius", "sm", v)} /></Field>
      <Field label="Radius md"><Slider value={inputs.geometry?.radius?.md ?? 6} min={0} max={32} step={1} suffix="px" ariaLabel="Radius md" oncommit={(v) => patchGeometry("radius", "md", v)} /></Field>
      <Field label="Radius lg"><Slider value={inputs.geometry?.radius?.lg ?? 10} min={0} max={48} step={1} suffix="px" ariaLabel="Radius lg" oncommit={(v) => patchGeometry("radius", "lg", v)} /></Field>
      <Field label="Rule hair"><Slider value={inputs.geometry?.border_width?.hair ?? 0.5} min={0} max={3} step={0.25} suffix="px" ariaLabel="Border width hair" oncommit={(v) => patchGeometry("border_width", "hair", v)} /></Field>
      <Field label="Rule thin"><Slider value={inputs.geometry?.border_width?.thin ?? 1} min={0} max={4} step={0.25} suffix="px" ariaLabel="Border width thin" oncommit={(v) => patchGeometry("border_width", "thin", v)} /></Field>
      <Field label="Rule thick"><Slider value={inputs.geometry?.border_width?.thick ?? 2.5} min={0} max={6} step={0.25} suffix="px" ariaLabel="Border width thick" oncommit={(v) => patchGeometry("border_width", "thick", v)} /></Field>
    </DisclosureField>

    <!-- Type-role rebinds + carried-overrides release moved to the
         STYLING inner tab (Phase 5) — their L4 home. -->
  </div>
{/if}

<style>
  .identity-tab {
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
  .pins-banner {
    margin: 8px 0;
    padding: 6px 10px;
    border-radius: var(--v2-r-soft, 3px);
    font-size: var(--v2-text-small, 10.5px);
    line-height: 1.35;
    background: color-mix(in srgb, #7c3aed 9%, var(--v2-paper, #fff));
    border: 1px solid color-mix(in srgb, #7c3aed 28%, transparent);
    color: var(--v2-ink, #4c2889);
  }
</style>

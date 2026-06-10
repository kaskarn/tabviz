<!--
  Tier1Sections — the ONE implementation of the Tier-1 section IA
  (settings-overhaul P3). Both hosts mount THIS:
    - settings ThemeBand (layout="compact"): anchors collapse to
      swatch+hex rows, LCH on expand, disclosures closed.
    - studio rail (layout="roomy"): anchors always show the LCH editor;
      same sections, same vocabulary, same order — learn once.

  Store-agnostic by contract: receives inputs + cssVars + callbacks,
  never imports a store (control-contract gate).

  IA (locked blueprint): IDENTITY (anchor rows + status disclosure) ·
  SURFACE (shell / header / series / border preset / texture) · TYPE
  (family / base / scale) · then COLOR SYSTEM / EFFECTS / GEOMETRY
  disclosures with value-chip summaries. Disclosure depth ≤ 1 (law).
-->
<script lang="ts">
  import type { ControlLayout } from "./index";
  import type { ThemeInputs, OklchTriple } from "$types/theme-inputs";
  import AnchorRow from "./AnchorRow.svelte";
  import EnumRow from "./EnumRow.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import Dropdown from "$components/primitives/v2/Dropdown.svelte";
  import FontFamily from "$components/primitives/v2/FontFamily.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";
  import { hexToOklch } from "$lib/oklch";
  import { reflectL } from "$lib/theme/polarity";
  import { CATEGORICAL_SCHEMES } from "$lib/data-schemes";
  import { CORNER_SLOTS, RULE_SLOTS, TYPE_ROLE_NAMES, type CornerSlot, type RuleSlot } from "$lib/theme/scale-roles";
  import { DEFAULT_TYPE_ROLES, type TypeRoleName, type TypeRole } from "$lib/theme/typography";

  interface Props {
    inputs: ThemeInputs;
    /** Resolved cssVars for fallback display (status anchors). */
    cssVars?: Record<string, string>;
    /** "compact" (settings) or "roomy" (studio rail — LCH always open,
     *  disclosures open by default). */
    layout?: ControlLayout;
    onchange: (next: ThemeInputs, label?: string) => void;
    onpreview?: (next: ThemeInputs) => void;
    /** Show the studio's Match-brand compound move. */
    showMatchBrand?: boolean;
    /** Match-brand handler (host supplies tintFromBrand wiring). */
    onmatchbrand?: () => void;
    /** Compact-host handoff to the full studio (theme-rework Wave 1).
     *  When provided, the footer renders an "Edit in studio" button the
     *  host wires to a runtime-honest handoff (clipboard wire + Shiny
     *  request) instead of the dead `tabviz_studio(plot)` R-snippet text. */
    onOpenStudio?: () => void;
    /** Extra content rendered at the END of the advanced section (compact
     *  host only, theme-rework Wave 2). The viewer injects its curated
     *  RoleTones here — kept OUT of this store-agnostic component so it can
     *  carry the store-wired callbacks. */
    advancedExtra?: import("svelte").Snippet;
  }
  const {
    inputs,
    cssVars = {},
    layout = "compact",
    onchange,
    onpreview,
    showMatchBrand = false,
    onmatchbrand,
    onOpenStudio,
    advancedExtra,
  }: Props = $props();

  const roomy = $derived(layout === "roomy");

  function commit(next: ThemeInputs, label?: string): void {
    onchange(next, label);
  }
  function preview(next: ThemeInputs): void {
    (onpreview ?? onchange)(next);
  }
  /** Splice one top-level input key. */
  function patch<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]): void {
    commit({ ...inputs, [key]: value });
  }

  // ── Anchors ─────────────────────────────────────────────────────────
  type AnchorKey = "paper" | "ink" | "brand" | "accent";
  const ANCHOR_ROWS: ReadonlyArray<{ key: AnchorKey; label: string; optional: boolean }> = [
    { key: "paper",  label: "Paper",  optional: false },
    { key: "ink",    label: "Ink",    optional: false },
    { key: "brand",  label: "Brand",  optional: false },
    { key: "accent", label: "Accent", optional: true },
  ];
  // Accordion-of-one across every AnchorRow in the band.
  let openAnchor = $state<string | null>(null);

  // In dark polarity the resolver reflects paper/ink/brand/accent L, so the
  // raw input anchor (e.g. paper #F8FBFE) doesn't match the dark surface on
  // screen — a non-coder reads it as a bug (round-2 journalist review). Show
  // the REFLECTED (on-screen) value; un-reflect on commit. reflectL is an
  // involution, so the round-trip is lossless (modulo the L clamp).
  const isDark = $derived((inputs.polarity ?? "light") === "dark");
  function reflectTriple(t: OklchTriple): OklchTriple {
    return { L: reflectL(t.L), C: t.C, H: t.H };
  }
  function toDisplay(t: OklchTriple): OklchTriple { return isDark ? reflectTriple(t) : t; }
  function fromDisplay(t: OklchTriple): OklchTriple { return isDark ? reflectTriple(t) : t; }

  function anchorTriple(key: AnchorKey): OklchTriple {
    const a = inputs.anchors;
    const raw = key === "accent" ? (a.accent ?? a.brand) : a[key];
    return toDisplay(raw);
  }
  function anchorMirrored(key: AnchorKey): boolean {
    if (key === "accent") return !inputs.anchors.accent;
    return false;
  }
  function withAnchor(key: AnchorKey, t: OklchTriple): ThemeInputs {
    return { ...inputs, anchors: { ...inputs.anchors, [key]: fromDisplay(t) } };
  }
  function clearAnchor(key: "accent"): void {
    const next = { ...inputs.anchors };
    delete (next as Record<string, unknown>)[key];
    commit({ ...inputs, anchors: next });
  }

  // ── Status anchors (T1 — "make negatives red" is a consumer-grade
  //    correctness knob; survives the Tokens-tab cull by construction). ──
  type StatusKey = "positive" | "negative" | "warning" | "info";
  const STATUS_ROWS: ReadonlyArray<{ key: StatusKey; label: string }> = [
    { key: "positive", label: "Positive" },
    { key: "negative", label: "Negative" },
    { key: "warning",  label: "Warning" },
    { key: "info",     label: "Info" },
  ];
  let statusOpen = $state(false);
  function statusTriple(key: StatusKey): OklchTriple {
    const set = inputs.status?.[key];
    if (set) return set;
    // Unset → display the resolver's fallback so the row shows the truth.
    const hex = cssVars[`--tv-status-${key}`];
    if (hex) {
      const t = hexToOklch(hex);
      if (Number.isFinite(t.L)) return t;
    }
    return { L: 0.6, C: 0.1, H: 0 };
  }
  function withStatus(key: StatusKey, t: OklchTriple): ThemeInputs {
    return { ...inputs, status: { ...inputs!.status, [key]: t } };
  }
  const statusSummary = $derived.by(() => {
    const n = Object.keys(inputs.status ?? {}).length;
    return n > 0 ? `${n} set` : "defaults";
  });

  // ── Surface enums ───────────────────────────────────────────────────
  const SHELL = ["flush", "raised", "float", "transparent"] as const;
  const HEADER = ["light", "tint", "bold"] as const;
  const SERIES = [
    { value: "fill_with_darker_stroke", label: "ring" },
    { value: "flat_fill", label: "flat" },
    { value: "outlined", label: "outline" },
  ] as const;
  const BORDERS = ["none", "hairline", "ruled", "frame", "boxed"] as const;
  const TEXTURE = ["none", "ruled", "grid", "dotted", "grain"] as const;

  // ── Disclosure summaries (collapsed ≠ blind) ────────────────────────
  // Disclosures now live INSIDE the axis-tabs (UX redesign A3), so they
  // default OPEN — the tab IS the grouping; the collapse is just optional
  // tidying within a tab.
  let colorSystemOpen = $state(true);
  let effectsOpen = $state(true);
  let geometryOpen = $state(true);

  const fx = $derived(inputs?.effects ?? {});
  const effectsSummary = $derived.by(() => {
    const parts: string[] = [];
    if (fx.title_style && fx.title_style !== "normal") parts.push(fx.title_style);
    if (fx.glow_intensity && fx.glow_intensity !== "none") parts.push(`glow ${fx.glow_intensity}`);
    if (fx.gradient_shell_intensity && fx.gradient_shell_intensity !== "none") parts.push("gradient");
    if (fx.elevation && fx.elevation !== "none") parts.push(fx.elevation);
    return parts.length ? parts.join(" · ") : "none";
  });
  const geometrySummary = $derived.by(() => {
    const g = inputs?.geometry;
    const r = g?.radius?.md;
    const b = g?.border_width?.thin;
    return `r ${r ?? 6} · bw ${b ?? 1}`;
  });
  const colorSystemSummary = $derived.by(() => {
    const parts: string[] = [];
    if (inputs?.mode && inputs.mode !== "standard") parts.push(inputs.mode === "high-contrast" ? "HC" : "RT");
    if (inputs?.categorical) parts.push(inputs.categorical);
    return parts.length ? parts.join(" · ") : "default";
  });

  function patchEffects(key: string, value: unknown, commitNow = true): void {
    const next = { ...inputs, effects: { ...inputs.effects, [key]: value } } as ThemeInputs;
    if (commitNow) commit(next); else preview(next);
  }
  function patchGeometry(group: "radius" | "border_width", key: string, value: number): void {
    commit({
      ...inputs,
      geometry: {
        ...inputs.geometry,
        [group]: { ...(inputs.geometry?.[group] ?? {}), [key]: value },
      },
    });
  }
  // ── Geometry named SLOTS (Wave 3) — coarse corner/rule rebinds that
  // expand onto the four fine-grained stops (single source: scale-roles.ts).
  // The fine sliders below still work; picking a slot just sets all four.
  function applyCorners(slot: CornerSlot): void {
    commit({ ...inputs, geometry: { ...inputs.geometry, radius: { ...CORNER_SLOTS[slot] } } });
  }
  function applyRules(slot: RuleSlot): void {
    commit({ ...inputs, geometry: { ...inputs.geometry, border_width: { ...RULE_SLOTS[slot] } } });
  }
  // Reflect the active slot when the four stops match one exactly, else
  // "custom". An UNSET scale means the theme is at the resolver defaults,
  // which ARE the default slot (soft / normal) — report that, not "custom"
  // (Wave 3.5 review P1: pristine themes mislabelled themselves diverged).
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
    matchSlot(inputs.geometry?.radius, CORNER_SLOTS as unknown as Record<string, Record<string, number>>,
      ["sm", "md", "lg", "pill"], "soft"));
  const currentRules = $derived(
    matchSlot(inputs.geometry?.border_width, RULE_SLOTS as unknown as Record<string, Record<string, number>>,
      ["hair", "thin", "regular", "thick"], "normal"));
  function patchFonts(key: "body" | "display" | "mono" | "numeric", value: string): void {
    commit({ ...inputs, fonts: { ...inputs.fonts, [key]: value } });
  }

  // ── Type-role rebind ("Text sizes", Wave 3.5) — the shared per-role
  // {family,size,weight} editor. Writes inputs.type_roles via the Tier-1
  // onchange (DT-11-clean), so it appears in BOTH the studio rail (roomy)
  // and the viewer's advanced section (compact) — closing the
  // viewer/R-ahead-of-studio inversion the review flagged.
  let typeRoleSel = $state<TypeRoleName>("footnote");
  const TYPE_ROLE_OPTS = TYPE_ROLE_NAMES.map((r) => ({ value: r, label: r }));
  const TYPE_FAMILY_OPTS = ["display", "body", "mono", "numeric"].map((v) => ({ value: v, label: v }));
  const TYPE_SIZE_OPTS = ["label", "foot", "body", "head", "subtitle", "title", "display"]
    .map((v) => ({ value: v, label: v }));
  const TYPE_WEIGHT_OPTS = ["regular", "medium", "semibold", "bold"].map((v) => ({ value: v, label: v }));
  const effectiveTypeRole = $derived<TypeRole>({
    ...DEFAULT_TYPE_ROLES[typeRoleSel],
    ...(inputs.type_roles?.[typeRoleSel] ?? {}),
  });
  const typeRoleOverridden = $derived(
    Object.keys(inputs.type_roles?.[typeRoleSel] ?? {}).length > 0,
  );
  function patchTypeRole(key: "family" | "size" | "weight", value: string): void {
    const cur = inputs.type_roles?.[typeRoleSel] ?? {};
    commit({
      ...inputs,
      type_roles: { ...inputs.type_roles, [typeRoleSel]: { ...cur, [key]: value } },
    });
  }
  function resetTypeRole(): void {
    const next = { ...inputs.type_roles };
    delete (next as Record<string, unknown>)[typeRoleSel];
    commit({ ...inputs, type_roles: Object.keys(next).length ? next : undefined });
  }

  const schemeOptions = $derived([
    { value: "", label: "default (brand interleave)" },
    ...Object.keys(CATEGORICAL_SCHEMES).map((k) => ({ value: k, label: k })),
  ]);

  // ── Tabbed IA (UX redesign A3) — four axis-tabs replace the long scroll +
  // the "Advanced controls" junk-drawer. Each tab maps to a cascade input
  // family; the colored dot is the rgc axis-identity cue. IDENTITY is the
  // landing tab (the high-frequency "make it mine" anchors).
  type PanelTab = "identity" | "color" | "form" | "effects";
  let activeTab = $state<PanelTab>("identity");
  const TABS: ReadonlyArray<{ id: PanelTab; label: string; dot: string }> = [
    { id: "identity", label: "Identity", dot: "var(--v2-ink, #15140e)" },
    { id: "color",    label: "Color",    dot: "var(--tv-status-positive, #2f9e6b)" },
    { id: "form",     label: "Form",     dot: "var(--tv-accent, #2563eb)" },
    { id: "effects",  label: "Effects",  dot: "#7c3aed" },
  ];
</script>

{#if showMatchBrand}
  <div class="match-brand">
    <button type="button" onclick={() => onmatchbrand?.()}
            title="Tint paper, ink and accent hues toward brand (lightness unchanged)">
      Harmonize hues to brand
    </button>
  </div>
{/if}

<div class="tab-bar" role="tablist" aria-label="Theme controls">
  {#each TABS as t (t.id)}
    <button type="button" role="tab" class="tab" class:active={activeTab === t.id}
            aria-selected={activeTab === t.id} tabindex={activeTab === t.id ? 0 : -1}
            onclick={() => (activeTab = t.id)}>
      <span class="tab-dot" style:background={t.dot} aria-hidden="true"></span>{t.label}
    </button>
  {/each}
</div>

<div class="tab-panel">
{#if activeTab === "identity"}
<Section title="Identity" kicker="Tier 1 · Anchors"
           lede="The theme's color anchors. Everything downstream derives from these through the cascade.">
    {#each ANCHOR_ROWS as row (row.key)}
      <AnchorRow
        label={row.label}
        triple={anchorTriple(row.key)}
        layout={layout}
        expanded={openAnchor === row.key}
        onexpand={(o) => (openAnchor = o ? row.key : null)}
        mirrored={anchorMirrored(row.key)}
        onclear={row.optional && !anchorMirrored(row.key)
          ? () => clearAnchor(row.key as "accent")
          : undefined}
        oncommit={(t) => commit(withAnchor(row.key, t))}
        onpreview={(t) => preview(withAnchor(row.key, t))}
      />
    {/each}
    <DisclosureField label="Status colors" summary={statusSummary} bind:open={statusOpen}>
      {#each STATUS_ROWS as row (row.key)}
        <AnchorRow
          label={row.label}
          triple={statusTriple(row.key)}
          layout={layout}
          expanded={openAnchor === `status-${row.key}`}
          onexpand={(o) => (openAnchor = o ? `status-${row.key}` : null)}
          mirrored={!inputs.status?.[row.key]}
          oncommit={(t) => commit(withStatus(row.key, t))}
          onpreview={(t) => preview(withStatus(row.key, t))}
        />
      {/each}
    </DisclosureField>
  </Section>
{/if}

{#if activeTab === "form"}
  <Section title="Surface" kicker="Tier 1 · Structure"
           lede="Structural variants — shell, header band, series marks, borders, texture. Each re-resolves the cascade.">
    <EnumRow label="Shell" value={inputs.shell_mode ?? "flush"}
             segments={SHELL.map((v) => ({ value: v, label: v }))}
             onchange={(v) => patch("shell_mode", v)} />
    <EnumRow label="Header" value={inputs.header_style ?? "light"}
             segments={HEADER.map((v) => ({ value: v, label: v }))}
             onchange={(v) => patch("header_style", v)} />
    <EnumRow label="Series" value={inputs.slot_style ?? "fill_with_darker_stroke"}
             segments={SERIES.map((s) => ({ value: s.value, label: s.label }))}
             onchange={(v) => patch("slot_style", v as ThemeInputs["slot_style"])} />
    <EnumRow label="Borders" value={inputs.border_preset ?? "hairline"}
             segments={BORDERS.map((v) => ({ value: v, label: v }))}
             onchange={(v) => patch("border_preset", v as ThemeInputs["border_preset"])} />
    <Field label="Texture">
      <Dropdown value={inputs.shell_texture ?? "none"}
              ariaLabel="Texture"
              onchange={(v) => patch("shell_texture", v as ThemeInputs["shell_texture"])}
              options={TEXTURE.map((v) => ({ value: v, label: v }))} />
    </Field>
  </Section>

  <Section title="Type" kicker="Tier 1 · Type"
           lede="Body family + the two Tier-1 scale knobs. Per-role typography is studio territory.">
    <Field label="Body">
      <FontFamily value={inputs.fonts?.body ?? null}
                  ariaLabel="Body font"
                  onchange={(v) => patchFonts("body", v)} />
    </Field>
    <Field label="Numbers" hint="Figure font for number columns. Blank = follow the body font.">
      <FontFamily value={inputs.fonts?.numeric ?? null}
                  ariaLabel="Numeric figure font"
                  onchange={(v) => patchFonts("numeric", v)} />
    </Field>
    <Field label="Base">
      <Slider value={inputs.type_base_size ?? 14} min={10} max={22} step={0.5} suffix="px"
              ariaLabel="Type base size"
              oncommit={(v) => patch("type_base_size", v)} />
    </Field>
    <Field label="Scale">
      <Slider value={inputs.type_scale_ratio ?? 1.2} min={1.05} max={1.5} step={0.01} valueWidth={4}
              ariaLabel="Type scale ratio"
              oncommit={(v) => patch("type_scale_ratio", v)} />
    </Field>
    <!-- Text sizes — Tier-2 type-role rebind (Wave 3.5). Pick a role, then
         rebind its family / size / weight. Cascade-safe (rides
         inputs.type_roles); present in both the studio rail and the viewer's
         advanced section. -->
    <Field label="Role" hint="Rebind one type role's family / size / weight.">
      <Dropdown value={typeRoleSel} ariaLabel="Type role to rebind"
              onchange={(v) => (typeRoleSel = v as TypeRoleName)} options={TYPE_ROLE_OPTS} />
    </Field>
    <!-- Family/size/weight are sub-fields OF the selected role — a left-ruled
         indent reads as the hierarchy the old "· family" leading-dot only hinted at. -->
    <div class="sub-group">
      <Field label="Family">
        <Dropdown value={effectiveTypeRole.family} ariaLabel="{typeRoleSel} family"
                onchange={(v) => patchTypeRole("family", v)} options={TYPE_FAMILY_OPTS} />
      </Field>
      <Field label="Size">
        <Dropdown value={effectiveTypeRole.size} ariaLabel="{typeRoleSel} size"
                onchange={(v) => patchTypeRole("size", v)} options={TYPE_SIZE_OPTS} />
      </Field>
      <Field label="Weight"
             onreset={typeRoleOverridden ? resetTypeRole : undefined}>
        <Dropdown value={effectiveTypeRole.weight} ariaLabel="{typeRoleSel} weight"
                onchange={(v) => patchTypeRole("weight", v)} options={TYPE_WEIGHT_OPTS} />
      </Field>
    </div>
  </Section>
{/if}

{#if activeTab === "color"}
    <DisclosureField label="Color system" summary={colorSystemSummary} bind:open={colorSystemOpen}>
      <EnumRow label="Mode"
               value={inputs.mode ?? "standard"}
               segments={[
                 { value: "standard", label: "Std" },
                 { value: "high-contrast", label: "HC", title: "High contrast" },
                 { value: "reduced-transparency", label: "RT", title: "Reduced transparency" },
               ]}
               onchange={(v) => patch("mode", v as ThemeInputs["mode"])} />
      <Field label="Scheme" hint="Categorical palette for series slots 1+; slot 0 keeps brand identity.">
        <Dropdown value={inputs.categorical ?? ""}
                ariaLabel="Categorical scheme"
                onchange={(v) => patch("categorical", (v || undefined) as ThemeInputs["categorical"])}
                options={schemeOptions} />
      </Field>
    </DisclosureField>
{/if}

{#if activeTab === "effects"}
    <DisclosureField label="Effects" summary={effectsSummary} bind:open={effectsOpen}>
      <EnumRow label="Title" value={fx.title_style ?? "normal"}
               segments={["normal", "bar", "underline"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("title_style", v)} />
      <EnumRow label="Title tag"
               hint="A boxed stamp beside the title (the 'Table 1' chip). Set its text with tag= on tabviz() or by double-clicking it on the canvas."
               value={fx.caption_style ?? "none"}
               segments={["none", "chip", "stripe", "both"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("caption_style", v)} />
      <div class="fx-flag">Surface finish</div>
      <EnumRow label="Glow" value={fx.glow_intensity ?? "none"}
               segments={["none", "subtle", "neon"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("glow_intensity", v)} />
      {#if (fx.glow_intensity ?? "none") !== "none"}
        <EnumRow label="Anchor" value={fx.glow_anchor ?? "brand"}
                 segments={["brand", "accent"].map((v) => ({ value: v, label: v }))}
                 onchange={(v) => patchEffects("glow_anchor", v)} />
      {/if}
      <EnumRow label="Gradient" value={fx.gradient_shell_intensity ?? "none"}
               segments={["none", "subtle", "vivid"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("gradient_shell_intensity", v)} />
      {#if (fx.gradient_shell_intensity ?? "none") !== "none"}
        <Field label="Angle">
          <Slider value={fx.gradient_shell_angle ?? 90} min={0} max={360} step={5}
                  valueText={`${Math.round(fx.gradient_shell_angle ?? 90)}°`}
                  ariaLabel="Gradient angle"
                  onchange={(v) => patchEffects("gradient_shell_angle", v, false)}
                  oncommit={(v) => patchEffects("gradient_shell_angle", v)} />
        </Field>
      {/if}
      <EnumRow label="Shadow" hint="Figure-wide depth; magnitude words only."
               value={fx.elevation ?? "none"}
               segments={["none", "low", "medium", "high"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("elevation", v)} />
      <EnumRow label="Glass" hint="Translucent frosted / aurora shell (browser only)."
               value={fx.glass ?? "none"}
               segments={["none", "frosted", "aurora"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("glass", v)} />
    </DisclosureField>
{/if}

{#if activeTab === "form"}
    <DisclosureField label="Geometry" summary={geometrySummary} bind:open={geometryOpen}>
      <!-- Named SLOTS (Wave 3 geometry roles) — coarse rebinds above the
           fine stops. "custom" shows when the sliders diverge from a preset. -->
      <EnumRow label="Corners" hint="Coarse radius preset; the stops below fine-tune."
               value={currentCorners}
               segments={["sharp", "soft", "round", ...(currentCorners === "custom" ? ["custom"] : [])].map((v) => ({ value: v, label: v }))}
               onchange={(v) => v !== "custom" && applyCorners(v as CornerSlot)} />
      <EnumRow label="Rules" hint="Coarse border-weight preset; the stops below fine-tune."
               value={currentRules}
               segments={["fine", "normal", "strong", ...(currentRules === "custom" ? ["custom"] : [])].map((v) => ({ value: v, label: v }))}
               onchange={(v) => v !== "custom" && applyRules(v as RuleSlot)} />
      <Field label="Radius sm"><Slider value={inputs.geometry?.radius?.sm ?? 2} min={0} max={24} step={1} suffix="px" ariaLabel="Radius sm" oncommit={(v) => patchGeometry("radius", "sm", v)} /></Field>
      <Field label="Radius md"><Slider value={inputs.geometry?.radius?.md ?? 6} min={0} max={32} step={1} suffix="px" ariaLabel="Radius md" oncommit={(v) => patchGeometry("radius", "md", v)} /></Field>
      <Field label="Radius lg"><Slider value={inputs.geometry?.radius?.lg ?? 10} min={0} max={48} step={1} suffix="px" ariaLabel="Radius lg" oncommit={(v) => patchGeometry("radius", "lg", v)} /></Field>
      <Field label="Rule hair"><Slider value={inputs.geometry?.border_width?.hair ?? 0.5} min={0} max={3} step={0.25} suffix="px" ariaLabel="Border width hair" oncommit={(v) => patchGeometry("border_width", "hair", v)} /></Field>
      <Field label="Rule thin"><Slider value={inputs.geometry?.border_width?.thin ?? 1} min={0} max={4} step={0.25} suffix="px" ariaLabel="Border width thin" oncommit={(v) => patchGeometry("border_width", "thin", v)} /></Field>
      <Field label="Rule thick"><Slider value={inputs.geometry?.border_width?.thick ?? 2.5} min={0} max={6} step={0.25} suffix="px" ariaLabel="Border width thick" oncommit={(v) => patchGeometry("border_width", "thick", v)} /></Field>
    </DisclosureField>
{/if}

{#if activeTab === "color"}
  {#if advancedExtra}
    <Section title="Role tones" kicker="Tier 2 · Roles"
             lede="Curated Tier-2 role nudges — cascade-safe, survives polarity & contrast. The full role spine lives in the studio.">
      {@render advancedExtra()}
    </Section>
  {/if}
{/if}
</div>

<!-- The handoff renders ONLY when the host wires a real action (onOpenStudio
     → clipboard wire + Shiny request). The old `{:else}` printed a dead
     `tabviz_studio(plot)` R-snippet with no live effect in a GUI — deleted
     (A4 zero-dead-buttons). -->
{#if !roomy && onOpenStudio}
  <div class="studio-handoff">
    <button type="button" class="studio-handoff-btn" onclick={onOpenStudio}>
      Edit in studio →
    </button>
    <span class="studio-handoff-hint">
      Per-role type, tokens, raw borders, role rebinding.
    </span>
  </div>
{/if}

<style>
  /* Micro-cap divider inside a disclosure body — tracked uppercase eyebrow
     that groups related controls (e.g. "Surface finish" effects). */
  .fx-flag {
    margin: 6px 0 0;
    padding-top: 6px;
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink-3, #8a8478);
  }
  /* Indented sub-group: child fields of a selected parent (e.g. the type
     role's family/size/weight). A left rule carries the hierarchy. */
  .sub-group {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-tight, 4px);
    margin-left: 4px;
    padding-left: 8px;
    border-left: 1px solid var(--v2-rule-soft, #e6e0d1);
  }
  .match-brand { padding: 8px 0 0; }
  .match-brand button {
    font-size: var(--v2-text-body, 11.5px);
    padding: 3px 10px;
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
  }
  .match-brand button:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  /* ── Axis-tab bar (UX redesign A3) — replaces the long scroll + the
     "Advanced controls" junk-drawer with four orienting tabs. ── */
  .tab-bar {
    display: flex;
    gap: 2px;
    margin: 2px 0 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--v2-rule-soft, #e6e0d1);
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    justify-content: center;
    padding: 5px 4px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink-3, #8a8478);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-small, 10.5px);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 80ms ease, background 80ms ease;
  }
  .tab:hover { color: var(--v2-ink-2, #4a463c); background: var(--v2-hover-tint, rgba(21,20,14,0.04)); }
  .tab.active {
    color: var(--v2-ink, #15140e);
    background: var(--v2-paper-2, #f3efe5);
  }
  .tab:focus-visible { outline: 1.5px solid var(--v2-rule-strong, #15140e); outline-offset: 1px; }
  .tab-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex: none;
    opacity: 0.45;
    transition: opacity 80ms ease;
  }
  .tab.active .tab-dot { opacity: 1; }
  .tab-panel { display: flex; flex-direction: column; }
  .studio-handoff {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    padding: 8px 0 12px;
    flex-wrap: wrap;
  }
  .studio-handoff-btn {
    font-size: var(--v2-text-body, 11.5px);
    padding: 3px 10px;
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
    flex: none;
  }
  .studio-handoff-btn:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .studio-handoff-hint {
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    min-width: 0;
  }
</style>

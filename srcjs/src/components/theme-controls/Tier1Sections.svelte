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
  import Select from "$components/primitives/v2/Select.svelte";
  import FontFamily from "$components/primitives/v2/FontFamily.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";
  import { hexToOklch } from "$lib/oklch";
  import { reflectL } from "$lib/theme/polarity";
  import { CATEGORICAL_SCHEMES } from "$lib/data-schemes";

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
  // Roomy host (studio rail) starts with disclosures open. `layout`
  // never changes within a host instance, so capturing the initial
  // value is the intent — untrack() tells the compiler so.
  import { untrack } from "svelte";
  const startOpen = untrack(() => layout === "roomy");
  let colorSystemOpen = $state(startOpen);
  let effectsOpen = $state(startOpen);
  let geometryOpen = $state(startOpen);

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
  function patchFonts(key: "body" | "display" | "mono", value: string): void {
    commit({ ...inputs, fonts: { ...inputs.fonts, [key]: value } });
  }

  const schemeOptions = $derived([
    { value: "", label: "default (brand interleave)" },
    ...Object.keys(CATEGORICAL_SCHEMES).map((k) => ({ value: k, label: k })),
  ]);
</script>

{#if showMatchBrand}
  <div class="match-brand">
    <button type="button" onclick={() => onmatchbrand?.()}
            title="Tint paper, ink and accent hues toward brand (lightness unchanged)">
      Harmonize hues to brand
    </button>
  </div>
{/if}
<Section title="identity" glyph="section.style"
           hint="The theme's color anchors. Everything downstream derives from these through the cascade.">
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

  <Section title="surface" glyph="section.layout"
           hint="Structural variants — shell, header band, series marks, borders, texture. Each re-resolves the cascade.">
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
      <Select value={inputs.shell_texture ?? "none"}
              ariaLabel="Texture"
              onchange={(v) => patch("shell_texture", v as ThemeInputs["shell_texture"])}
              options={TEXTURE.map((v) => ({ value: v, label: v }))} />
    </Field>
  </Section>

  <Section title="type" glyph="type.text"
           hint="Body family + the two Tier-1 scale knobs. Per-role typography is studio territory.">
    <Field label="Body">
      <FontFamily value={inputs.fonts?.body ?? null}
                  ariaLabel="Body font"
                  onchange={(v) => patchFonts("body", v)} />
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
  </Section>

  <div class="disclosures">
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
        <Select value={inputs.categorical ?? ""}
                ariaLabel="Categorical scheme"
                onchange={(v) => patch("categorical", (v || undefined) as ThemeInputs["categorical"])}
                options={schemeOptions} />
      </Field>
    </DisclosureField>

    <DisclosureField label="Effects" summary={effectsSummary} bind:open={effectsOpen}>
      <EnumRow label="Title" value={fx.title_style ?? "normal"}
               segments={["normal", "bar", "underline"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("title_style", v)} />
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
    </DisclosureField>

    <DisclosureField label="Geometry" summary={geometrySummary} bind:open={geometryOpen}>
      <Field label="Radius sm"><Slider value={inputs.geometry?.radius?.sm ?? 2} min={0} max={24} step={1} suffix="px" ariaLabel="Radius sm" oncommit={(v) => patchGeometry("radius", "sm", v)} /></Field>
      <Field label="Radius md"><Slider value={inputs.geometry?.radius?.md ?? 6} min={0} max={32} step={1} suffix="px" ariaLabel="Radius md" oncommit={(v) => patchGeometry("radius", "md", v)} /></Field>
      <Field label="Radius lg"><Slider value={inputs.geometry?.radius?.lg ?? 10} min={0} max={48} step={1} suffix="px" ariaLabel="Radius lg" oncommit={(v) => patchGeometry("radius", "lg", v)} /></Field>
      <Field label="Rule hair"><Slider value={inputs.geometry?.border_width?.hair ?? 0.5} min={0} max={3} step={0.25} suffix="px" ariaLabel="Border width hair" oncommit={(v) => patchGeometry("border_width", "hair", v)} /></Field>
      <Field label="Rule thin"><Slider value={inputs.geometry?.border_width?.thin ?? 1} min={0} max={4} step={0.25} suffix="px" ariaLabel="Border width thin" oncommit={(v) => patchGeometry("border_width", "thin", v)} /></Field>
      <Field label="Rule thick"><Slider value={inputs.geometry?.border_width?.thick ?? 2.5} min={0} max={6} step={0.25} suffix="px" ariaLabel="Border width thick" oncommit={(v) => patchGeometry("border_width", "thick", v)} /></Field>
    </DisclosureField>
  </div>

{#if !roomy}
  {#if onOpenStudio}
    <div class="studio-handoff">
      <button type="button" class="studio-handoff-btn" onclick={onOpenStudio}>
        Edit in studio →
      </button>
      <span class="studio-handoff-hint">
        Per-role type, tokens, raw borders, role rebinding.
      </span>
    </div>
  {:else}
    <p class="studio-pointer">
      Fine-grained control — per-role type, tokens, raw borders, role
      rebinding — lives in the studio: <code>tabviz_studio(plot)</code> in R.
    </p>
  {/if}
{/if}

<style>
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
  .disclosures {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
    /* Horizontal inset comes from the HOST band on both sides (visual
       review: the old half-here/half-host split put the THEME rows 12px
       off the QuickStrip/FigureBand spine). */
    padding: 4px 0 8px;
  }
  .studio-pointer {
    margin: 0;
    padding: 8px 0 12px;
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
  }
  .studio-pointer code {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    background: var(--v2-paper-2, #f3efe5);
    padding: 1px 4px;
    border-radius: var(--v2-r-hair, 2px);
  }
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

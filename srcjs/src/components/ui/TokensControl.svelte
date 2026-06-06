<script lang="ts">
  // Tokens tab — power-user surface for editing the semantic-token bundles
  // that the painter UI applies. Five tokens map to RowSemantic bundles on
  // theme.row.{token}; one of them (fill) reads its default bg from the
  // Tier-2 theme.semantic.fill named color.
  //
  // Layout: top section edits the two named token colors; below, an
  // expandable per-token RowSemantic editor for each of the six bundles.
  // Each field on each bundle is override-aware via the existing
  // setThemeFieldDerived / isOverridden plumbing; reset reverts to the
  // resolved default.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import ColorField from "./ColorField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import { getCssVars, readAccentDefault, readSurfaceBg } from "$lib/theme/consumer-bridge";
  import Accordion from "$components/primitives/v2/Accordion.svelte";
  import { oklchMix } from "$lib/oklch";
  import { PAPER_SWATCHES, INK_SWATCHES, NEUTRAL_SWATCHES, ACCENT_SWATCHES, colors } from "./swatch-palettes";
  import { WEIGHT_OPTIONS } from "./weight-ladder";

  interface Props {
    store: TabvizStore;
  }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);

  function setPath(path: (string | number)[], value: unknown) {
    store.setThemeField(path, value);
  }
  function setDerived(path: (string | number)[], value: unknown) {
    store.setThemeFieldDerived(path, value);
  }
  function isOver(path: (string | number)[]): boolean {
    return store.isOverridden(path);
  }
  function clearOver(path: (string | number)[]) {
    store.clearOverride(path);
  }

  // ── theme.semantic.fill cascade helper ─────────────────────────────
  // Editing the Tier-2 named color also updates the fill RowSemantic
  // bundle's bg by default — unless the user has pinned theme.row.fill.bg
  // separately. Mirrors the R-side resolver behavior on the wire.
  function setSemanticFill(hex: string) {
    setPath(["semantic", "fill"], hex);
    setDerived(["row", "fill", "bg"], hex);
  }
  function resetSemanticFill() {
    clearOver(["semantic", "fill"]);
    const cv = theme ? getCssVars(theme) : {};
    const accent = theme ? readAccentDefault(cv) : "#8B5CF6";
    const lightest = theme ? readSurfaceBg(cv) : "#FFFFFF";
    const value = oklchMix(accent, lightest, 0.80);
    setDerived(["semantic", "fill"], value);
    setDerived(["row", "fill", "bg"], value);
  }

  // ── Per-token editors ───────────────────────────────────────────────
  type TokenName = "emphasis" | "muted" | "accent" | "bold" | "fill";
  const TOKENS: Array<{ id: TokenName; label: string; description: string }> = [
    { id: "muted",     label: "Mute",      description: "Lighter, reduced prominence (translucent)." },
    { id: "bold",      label: "Bold",      description: "Just a weight bump — no color override." },
    { id: "accent",    label: "Accent",    description: "Bold + accent color (most common)." },
    { id: "fill",      label: "Fill",      description: "Bold + pastel row tint. Bg defaults to theme.semantic.fill." },
    { id: "emphasis",  label: "Emphasis",  description: "Legacy: bold + primary fg + primary marker. Kept for back-compat with row_emphasis_col." },
  ];

  let expanded = $state<Record<string, boolean>>({});
  function toggle(id: string) {
    expanded = { ...expanded, [id]: !expanded[id] };
  }

  function setToken(token: TokenName, field: string, value: unknown) {
    store.setThemeField(["row", token, field], value);
  }
  function tokenField(token: TokenName, field: string) {
    const bundle = (theme?.row as unknown as Record<string, Record<string, unknown>> | undefined)?.[token];
    return bundle?.[field];
  }
</script>

{#if theme}
  <Section
    title="Token color"
    glyph="section.tokens"
    hint="The Tier-2 fill input feeds the fill bundle background. Defaults derive from accent at resolve time; pin a value here to lock it.">
    <ColorField
      label="Fill"
      hint="Pastel row-fill tone"
      value={(theme.semantic?.fill as string | undefined) ?? "#C8553D"}
      onchange={setSemanticFill}
      overridden={isOver(["semantic", "fill"])}
      onreset={resetSemanticFill}
      swatches={colors(PAPER_SWATCHES)}
    />
  </Section>

  <Section
    title="Token bundles"
    glyph="section.tokens"
    hint="Each token is a RowSemantic preset (bg / fg / border / marker fill / weight / italic). The painter UI applies one to a row or cell at a time; data columns (row_*_col) flip the same flags from R.">
    <div data-tv-v2>
      {#each TOKENS as t (t.id)}
        <Accordion
          title={t.label}
          open={expanded[t.id] ?? false}
        >
          {#snippet summary()}
            <!-- Token preview chip — renders the token's own label
                 ("Bold", "Mute", "Accent", …) in the token's actual
                 bg/fg/weight/italic. Reads as a paint-tube specimen,
                 not generic chrome. -->
            <span class="token-chip"
                  style:background={(tokenField(t.id, "bg") as string | undefined) ?? "transparent"}
                  style:color={(tokenField(t.id, "fg") as string | undefined) ?? "currentColor"}
                  style:font-style={tokenField(t.id, "fontStyle") === "italic" ? "italic" : "normal"}
                  style:font-weight={(tokenField(t.id, "fontWeight") as number | undefined) ?? 400}>
              {t.label}
            </span>
          {/snippet}
          <ColorField
            label="Background"
            value={(tokenField(t.id, "bg") as string | undefined) ?? ""}
            onchange={(v) => setToken(t.id, "bg", v)}
            swatches={colors(PAPER_SWATCHES)}
          />
          <ColorField
            label="Foreground"
            value={(tokenField(t.id, "fg") as string | undefined) ?? ""}
            onchange={(v) => setToken(t.id, "fg", v)}
            swatches={colors(INK_SWATCHES)}
          />
          <ColorField
            label="Border"
            value={(tokenField(t.id, "border") as string | undefined) ?? ""}
            onchange={(v) => setToken(t.id, "border", v)}
            swatches={colors(NEUTRAL_SWATCHES)}
          />
          <ColorField
            label="Marker fill"
            value={(tokenField(t.id, "markerFill") as string | undefined) ?? ""}
            onchange={(v) => setToken(t.id, "markerFill", v)}
            swatches={colors(ACCENT_SWATCHES)}
          />
          <SegmentedField
            label="Weight"
            value={(tokenField(t.id, "fontWeight") as number | undefined) ?? 400}
            options={WEIGHT_OPTIONS}
            onchange={(v) => setToken(t.id, "fontWeight", v)}
          />
          <BooleanField
            label="Italic"
            value={tokenField(t.id, "fontStyle") === "italic"}
            onchange={(v) => setToken(t.id, "fontStyle", v ? "italic" : "normal")}
          />
        </Accordion>
      {/each}
    </div>
  </Section>
{/if}

<style>
  /* Token preview chip — bg/fg pair rendered as a paint-tube label.
     Inlined styles (in the snippet) carry bg/fg/weight/italic from the
     actual token; the class adds shape + framing only. */
  :global([data-tv-v2]) .token-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    padding: 2px 8px;
    height: 18px;
    border-radius: var(--v2-r-hair, 2px);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: 10.5px;
    line-height: 1;
    white-space: nowrap;
  }
</style>

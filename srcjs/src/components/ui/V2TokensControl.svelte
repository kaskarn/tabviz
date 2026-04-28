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
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import ColorField from "./ColorField.svelte";
  import NumberField from "./NumberField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import { oklchMix } from "$lib/oklch";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

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
    const accent = theme?.accent?.default ?? "#8B5CF6";
    const lightest = (theme?.inputs?.neutral as string[] | undefined)?.[0] ?? "#FFFFFF";
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
  <SettingsSection
    title="Token color"
    description="The Tier-2 fill input feeds the fill bundle background. Defaults derive from accent at resolve time; pin a value here to lock it.">
    <ColorField
      label="Fill"
      hint="Pastel row-fill tone"
      value={(theme.semantic?.fill as string | undefined) ?? "#C8553D"}
      onchange={setSemanticFill}
      overridden={isOver(["semantic", "fill"])}
      onreset={resetSemanticFill}
    />
  </SettingsSection>

  <SettingsSection
    title="Token bundles"
    description="Each token is a RowSemantic preset (bg / fg / border / marker fill / weight / italic). The painter UI applies one to a row or cell at a time; data columns (row_*_col) flip the same flags from R.">
    {#each TOKENS as t (t.id)}
      <div class="token">
        <button class="token-toggle" onclick={() => toggle(t.id)}>
          <span class="token-name">{expanded[t.id] ? "▾" : "▸"} {t.label}</span>
          <span class="token-desc">{t.description}</span>
        </button>
        {#if expanded[t.id]}
          <div class="token-fields">
            <ColorField
              label="Background"
              value={(tokenField(t.id, "bg") as string | undefined) ?? ""}
              onchange={(v) => setToken(t.id, "bg", v)}
            />
            <ColorField
              label="Foreground"
              value={(tokenField(t.id, "fg") as string | undefined) ?? ""}
              onchange={(v) => setToken(t.id, "fg", v)}
            />
            <ColorField
              label="Border"
              value={(tokenField(t.id, "border") as string | undefined) ?? ""}
              onchange={(v) => setToken(t.id, "border", v)}
            />
            <ColorField
              label="Marker fill"
              value={(tokenField(t.id, "markerFill") as string | undefined) ?? ""}
              onchange={(v) => setToken(t.id, "markerFill", v)}
            />
            <NumberField
              label="Font weight"
              value={(tokenField(t.id, "fontWeight") as number | undefined) ?? 400}
              min={100} max={900} step={100}
              onchange={(v) => setToken(t.id, "fontWeight", v)}
            />
            <BooleanField
              label="Italic"
              value={tokenField(t.id, "fontStyle") === "italic"}
              onchange={(v) => setToken(t.id, "fontStyle", v ? "italic" : "normal")}
            />
          </div>
        {/if}
      </div>
    {/each}
  </SettingsSection>
{/if}

<style>
  .token {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px dashed var(--tv-border);
  }
  .token-toggle {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: transparent;
    border: none;
    color: var(--tv-fg);
    cursor: pointer;
    font-size: 0.85rem;
    width: 100%;
    text-align: left;
  }
  .token-toggle:hover {
    background: var(--tv-alt-bg);
  }
  .token-name {
    font-weight: 600;
    flex-shrink: 0;
  }
  .token-desc {
    font-size: 0.75rem;
    color: var(--tv-text-muted);
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    flex: 1;
    text-align: right;
  }
  .token-fields {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.25rem 0 0.5rem 1rem;
  }
</style>

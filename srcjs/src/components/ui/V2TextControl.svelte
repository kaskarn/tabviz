<script lang="ts">
  // v2 Text & Annotations tab.
  // 8 text role bundles + L1/L2/L3 row-group accordion sections.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import ColorField from "./ColorField.svelte";
  import NumberField from "./NumberField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import FontFamily from "$components/primitives/v2/FontFamily.svelte";

  // Font size on the wire is a CSS length string ("0.875rem"); the
  // slider works in px. Convert between forms with a generous default
  // so users can still hand-edit unusual values (clamp would lose them).
  function sizeToPx(s: string | undefined): number {
    if (!s) return 14;
    const m = /^([\d.]+)\s*(px|rem|em|pt)?$/.exec(s.trim());
    if (!m) return 14;
    const n = parseFloat(m[1]);
    const unit = m[2] ?? "px";
    if (unit === "rem" || unit === "em") return Math.round(n * 16);
    if (unit === "pt") return Math.round(n * 1.333);
    return Math.round(n);
  }
  function pxToSize(px: number): string {
    return `${px}px`;
  }

  // Curated font weight options matching CSS / rgc-design.
  const WEIGHT_OPTIONS = [
    { value: 400, label: "Reg" },
    { value: 500, label: "Med" },
    { value: 600, label: "Semi" },
    { value: 700, label: "Bold" },
  ];

  interface Props {
    store: TabvizStore;
  }
  let { store }: Props = $props();

  const text = $derived(store.spec?.theme?.text);
  const rg   = $derived(store.spec?.theme?.rowGroup);
  // theme.header.text is a *separately-composed* TextRole bundle (composed
  // from text.body with weight = 600 at resolve time) — NOT under
  // theme.text.* — so reading + writing for the "header" role uses a
  // distinct path. Same applies to columnGroup down the line if we surface
  // it; for now only header is exposed.
  const headerText = $derived(store.spec?.theme?.header?.text);

  let expandedText = $state<Record<string, boolean>>({});
  let expandedLevel = $state<Record<string, boolean>>({ L1: true });

  // Tier keys for the row-group cluster, typed as the literal union so the
  // `rg[level]` indexing in the template is well-typed.
  const RG_LEVELS: readonly ("L1" | "L2" | "L3")[] = ["L1", "L2", "L3"] as const;

  // Shape of an individual text role on the wire — every theme.text.* role
  // and theme.header.text uses this shape.
  type TextRoleFields = {
    family?: string; size?: string; weight?: number;
    italic?: boolean; fg?: string;
  };

  // Reads either theme.text[role] or, for "header", theme.header.text.
  function readRole(role: string): TextRoleFields | undefined {
    if (role === "header") return headerText as TextRoleFields | undefined;
    return (text as Record<string, TextRoleFields | undefined> | undefined)?.[role];
  }

  function setTextRole(role: string, field: string, value: unknown) {
    if (role === "header") {
      store.setThemeField(["header", "text", field], value);
      return;
    }
    store.setThemeField(["text", role, field], value);
    // R-side `compose_text` cascades text.{label,tick} into plot.axisLabel /
    // plot.tickLabel at resolve time. The frontend has no JS resolver, so
    // edits to those roles must mirror the cascade explicitly or the
    // forest-axis labels stay frozen on their resolved-at-load values.
    // setThemeFieldDerived skips paths the user has explicitly pinned.
    if (role === "label") {
      store.setThemeFieldDerived(["plot", "axisLabel", field], value);
    } else if (role === "tick") {
      store.setThemeFieldDerived(["plot", "tickLabel", field], value);
    }
  }
  function setRowGroupTier(level: string, field: string, value: unknown) {
    store.setThemeField(["rowGroup", level, field], value);
  }
  function setRowGroupTierText(level: string, field: string, value: unknown) {
    store.setThemeField(["rowGroup", level, "text", field], value);
  }

  const roles = [
    "title", "subtitle", "caption", "footnote",
    "body", "header", "cell", "label", "tick"
  ];

  function summary(role: { family?: string; size?: string; weight?: number; italic?: boolean | null }) {
    const family = role.family?.split(",")[0] ?? "—";
    const italic = role.italic ? " italic" : "";
    return `${family} / ${role.size ?? "—"} / ${role.weight ?? "—"}${italic}`;
  }
</script>

<SettingsSection title="Text roles" description="Per-role typography. Title and subtitle use the display family; body / header / cell / label / tick / footnote use the body family. Header bundle is the column-header band — composed from body + bold weight by default.">
  {#each roles as role (role)}
    {@const roleData = readRole(role)}
    {#if roleData}
      <div class="role">
        <button class="role-toggle" onclick={() => (expandedText = { ...expandedText, [role]: !expandedText[role] })}>
          <span>{expandedText[role] ? "▾" : "▸"} {role.charAt(0).toUpperCase() + role.slice(1)}</span>
          <span class="role-summary">{summary(roleData)}</span>
        </button>
        {#if expandedText[role]}
          <div class="role-fields" data-tv-v2>
            <Field label="Family">
              <FontFamily
                value={roleData.family ?? null}
                onchange={(v) => setTextRole(role, "family", v)}
              />
            </Field>
            <NumberField
              label="Size"
              value={sizeToPx(roleData.size)}
              min={8} max={48} step={1}
              unit="px"
              onchange={(v) => setTextRole(role, "size", pxToSize(v))}
            />
            <SegmentedField
              label="Weight"
              value={roleData.weight ?? 400}
              options={WEIGHT_OPTIONS}
              onchange={(v) => setTextRole(role, "weight", v)}
            />
            <BooleanField
              label="Italic"
              value={!!roleData.italic}
              onchange={(v) => setTextRole(role, "italic", v)}
            />
            <ColorField
              label="Color"
              value={roleData.fg ?? "#000000"}
              onchange={(v) => setTextRole(role, "fg", v)}
            />
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</SettingsSection>

{#if rg}
  <SettingsSection title="Row group hierarchy" description="L1 outermost (boldest); L2/L3 progressively lighter.">
    {#each RG_LEVELS as level (level)}
      <div class="role">
        <button class="role-toggle" onclick={() => (expandedLevel = { ...expandedLevel, [level]: !expandedLevel[level] })}>
          <span>{expandedLevel[level] ? "▾" : "▸"} Level {level.slice(1)}</span>
          <span class="role-summary">{rg[level]?.text ? summary(rg[level].text) : ""}</span>
        </button>
        {#if expandedLevel[level]}
          <div class="role-fields">
            <ColorField
              label="Background"
              value={rg[level].bg ?? "transparent"}
              onchange={(v) => setRowGroupTier(level, "bg", v)}
            />
            <ColorField
              label="Foreground"
              value={rg[level].fg ?? "#000000"}
              onchange={(v) => setRowGroupTier(level, "fg", v)}
            />
            <ColorField
              label="Rule"
              value={rg[level].rule ?? "transparent"}
              onchange={(v) => setRowGroupTier(level, "rule", v)}
            />
            <SegmentedField
              label="Weight"
              value={rg[level].text?.weight ?? 500}
              options={WEIGHT_OPTIONS}
              onchange={(v) => setRowGroupTierText(level, "weight", v)}
            />
            <BooleanField
              label="Italic"
              value={!!rg[level].text?.italic}
              onchange={(v) => setRowGroupTierText(level, "italic", v)}
            />
            <BooleanField
              label="Bottom border"
              value={!!rg[level].borderBottom}
              onchange={(v) => setRowGroupTier(level, "borderBottom", v)}
            />
          </div>
        {/if}
      </div>
    {/each}
  </SettingsSection>
{/if}

<style>
  .role {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px dashed var(--tv-border);
  }
  .role-toggle {
    display: flex;
    align-items: center;
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
  .role-toggle:hover {
    background: var(--tv-alt-bg);
  }
  .role-summary {
    font-size: 0.75rem;
    color: var(--tv-text-muted);
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    max-width: 60%;
  }
  .role-fields {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.25rem 0 0.5rem 1rem;
  }
</style>

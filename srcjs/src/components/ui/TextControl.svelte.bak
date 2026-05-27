<script lang="ts">
  // v2 Text & Annotations tab.
  // 8 text role bundles + L1/L2/L3 row-group accordion sections.
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import ColorField from "./ColorField.svelte";
  import NumberField from "./NumberField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import Accordion from "$components/primitives/v2/Accordion.svelte";
  import FontFamily from "$components/primitives/v2/FontFamily.svelte";
  import { INK_SWATCHES, PAPER_SWATCHES, NEUTRAL_SWATCHES, colors } from "./swatch-palettes";

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

  // 5-step weight ladder covering the visually distinct range. 100/200
  // and 800/900 land identical to 300/700 in most body fonts, so they
  // just clutter the picker. Authors needing an extreme can set the
  // wire via R / theme code.
  const WEIGHT_OPTIONS = [
    { value: 300, label: "Light" },
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

  function summary_text(role: { family?: string; size?: string; weight?: number; italic?: boolean | null }) {
    const family = role.family?.split(",")[0]?.replace(/['"]/g, "") ?? "—";
    const italic = role.italic ? " italic" : "";
    return `${family} / ${role.size ?? "—"} / ${role.weight ?? "—"}${italic}`;
  }
</script>

 <Section title="Text roles" hint="Per-role typography. Title and subtitle use the display family; body / header / cell / label / tick / footnote use the body family. Header bundle is the column-header band — composed from body + bold weight by default.">
  <div data-tv-v2>
    {#each roles as role (role)}
      {@const roleData = readRole(role)}
      {#if roleData}
        <Accordion
          title={role.charAt(0).toUpperCase() + role.slice(1)}
          open={expandedText[role] ?? false}
        >
          {#snippet summary()}
            <span class="role-sig">{summary_text(roleData)}</span>
          {/snippet}
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
            swatches={colors(INK_SWATCHES)}
          />
        </Accordion>
      {/if}
    {/each}
  </div>
</Section>

{#if rg}
   <Section title="Row group hierarchy" hint="L1 outermost (boldest); L2/L3 progressively lighter.">
    <div data-tv-v2>
    {#each RG_LEVELS as level (level)}
      <Accordion
        title={`Level ${level.slice(1)}`}
        open={expandedLevel[level] ?? (level === "L1")}
      >
        {#snippet summary()}
          <span class="role-sig">{rg[level]?.text ? summary_text(rg[level].text) : ""}</span>
        {/snippet}
        <ColorField
          label="Background"
          value={rg[level].bg ?? "transparent"}
          onchange={(v) => setRowGroupTier(level, "bg", v)}
          swatches={colors(PAPER_SWATCHES)}
        />
        <ColorField
          label="Foreground"
          value={rg[level].fg ?? "#000000"}
          onchange={(v) => setRowGroupTier(level, "fg", v)}
          swatches={colors(INK_SWATCHES)}
        />
        <ColorField
          label="Rule"
          value={rg[level].rule ?? "transparent"}
          onchange={(v) => setRowGroupTier(level, "rule", v)}
          swatches={colors(NEUTRAL_SWATCHES)}
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
      </Accordion>
    {/each}
    </div>
  </Section>
{/if}

<style>
  /* Bespoke .role / .role-toggle / .role-fields are gone — Accordion
     owns the collapsible row. The signature chip rendered into the
     summary snippet uses .role-sig (a thin mono one-liner). */
  :global([data-tv-v2]) .role-sig {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
  }
</style>

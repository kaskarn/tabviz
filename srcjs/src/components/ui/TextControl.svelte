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
  import { WEIGHT_OPTIONS } from "./weight-ladder";

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

  interface Props {
    store: TabvizStore;
  }
  const { store }: Props = $props();

  const text = $derived(store.spec?.theme?.text);
  const rg   = $derived(store.spec?.theme?.rowGroup);
  // theme.header.text is a *separately-composed* TextRole bundle (composed
  // from text.body with weight = 600 at resolve time) — NOT under
  // theme.text.* — so reading + writing for the "header" role uses a
  // distinct path. Same applies to columnGroup down the line if we surface
  // it; for now only header is exposed.
  const headerText = $derived(store.spec?.theme?.header?.text);

  const expandedText = $state<Record<string, boolean>>({});
  const expandedLevel = $state<Record<string, boolean>>({ L1: true });

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

  // Roles grouped by surface — three small clusters read more
  // deliberately than one wall of nine. Order: Frame (title/caption/
  // footnote — appears once), Body (the row-content stack), Plot
  // (axis-only). Group labels render as Section sub-heads.
  const roleGroups = [
    { label: "Frame", roles: ["title", "subtitle", "caption", "footnote"] },
    { label: "Body",  roles: ["body", "header", "cell"] },
    { label: "Plot",  roles: ["label", "tick"] },
  ];
</script>

 <Section title="Text roles" hint="Per-role typography. Frame = once per chart (title, subtitle, caption, footnote). Body = per row (body, header, cell). Plot = axis (label, tick).">
  <div data-tv-v2>
    {#each roleGroups as group (group.label)}
      <div class="role-group-label">{group.label}</div>
      {#each group.roles as role (role)}
        {@const roleData = readRole(role)}
        {#if roleData}
        <Accordion
          title={role.charAt(0).toUpperCase() + role.slice(1)}
          open={expandedText[role] ?? false}
        >
          {#snippet summary()}
            <!-- Live specimen: a single "Aa" sample rendered in the
                 role's actual family / size / weight / italic / color.
                 The mono spec ("Arial / 1.25rem / 600") tells you what;
                 the specimen shows you. -->
            <span class="role-sig"
                  style:font-family={roleData.family}
                  style:font-size={roleData.size}
                  style:font-weight={roleData.weight ?? 400}
                  style:font-style={roleData.italic ? "italic" : "normal"}
                  style:color={roleData.fg ?? "currentColor"}>Aa</span>
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
          {@const t = rg[level]?.text}
          {#if t}
            <span class="role-sig"
                  style:font-family={t.family}
                  style:font-size={t.size}
                  style:font-weight={t.weight ?? 400}
                  style:font-style={t.italic ? "italic" : "normal"}
                  style:color={rg[level]?.fg ?? t.fg ?? "currentColor"}>Aa</span>
          {/if}
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
  /* Role specimen — renders an "Aa" in the role's actual family /
     size / weight / italic / color. Text-heavy mono spec ("Arial /
     1.25rem / 600 italic") replaced because the *specimen* is the
     spec — eye reads it directly. Caps at 22px so headlines don't
     bust the row height. */
  :global([data-tv-v2]) .role-sig {
    max-height: 22px;
    line-height: 1;
    overflow: hidden;
    font-variant-numeric: tabular-nums;
  }
  /* Sub-section label inside Text roles (Frame / Body / Plot). Quiet
     italic-serif, sits between the dingbat-less section body and the
     accordion list. */
  :global([data-tv-v2]) .role-group-label {
    font-family: var(--v2-font-serif, "EB Garamond", "Palatino", Georgia, serif);
    font-style: italic;
    font-size: 11px;
    color: var(--v2-ink-3, #8a8478);
    padding: 10px 0 2px;
    line-height: 1;
    letter-spacing: 0.04em;
  }
  :global([data-tv-v2]) .role-group-label:first-child {
    padding-top: 2px;
  }
</style>

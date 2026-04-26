<script lang="ts">
  // v2 Text & Annotations tab.
  // 8 text role bundles + L1/L2/L3 row-group accordion sections.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import ColorField from "./ColorField.svelte";
  import NumberField from "./NumberField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import TextField from "./TextField.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  const text = $derived(store.spec?.theme?.text);
  const rg   = $derived(store.spec?.theme?.rowGroup);

  let expandedText = $state<Record<string, boolean>>({});
  let expandedLevel = $state<Record<string, boolean>>({ L1: true });

  function setTextRole(role: string, field: string, value: unknown) {
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
    "body", "cell", "label", "tick"
  ];

  function summary(role: { family: string; size: string; weight: number; italic: boolean | null }) {
    const family = role.family?.split(",")[0] ?? "—";
    const italic = role.italic ? " italic" : "";
    return `${family} / ${role.size} / ${role.weight}${italic}`;
  }
</script>

<SettingsSection title="Text roles" description="Per-role typography. Title and subtitle use the display family; body / cell / label / tick / footnote use the body family.">
  {#each roles as role (role)}
    {#if text?.[role]}
      <div class="role">
        <button class="role-toggle" onclick={() => (expandedText = { ...expandedText, [role]: !expandedText[role] })}>
          <span>{expandedText[role] ? "▾" : "▸"} {role.charAt(0).toUpperCase() + role.slice(1)}</span>
          <span class="role-summary">{summary(text[role])}</span>
        </button>
        {#if expandedText[role]}
          <div class="role-fields">
            <TextField
              label="Family"
              value={text[role].family ?? ""}
              onchange={(v) => setTextRole(role, "family", v)}
            />
            <TextField
              label="Size"
              hint="CSS length, e.g. 0.875rem or 14px"
              value={text[role].size ?? ""}
              onchange={(v) => setTextRole(role, "size", v)}
            />
            <NumberField
              label="Weight"
              value={text[role].weight ?? 400}
              min={100} max={900} step={100}
              onchange={(v) => setTextRole(role, "weight", v)}
            />
            <BooleanField
              label="Italic"
              value={!!text[role].italic}
              onchange={(v) => setTextRole(role, "italic", v)}
            />
            <ColorField
              label="Color"
              value={text[role].fg ?? "#000000"}
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
    {#each ["L1", "L2", "L3"] as level (level)}
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
            <NumberField
              label="Font weight"
              value={rg[level].text?.weight ?? 500}
              min={100} max={900} step={100}
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
    color: var(--tv-secondary);
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

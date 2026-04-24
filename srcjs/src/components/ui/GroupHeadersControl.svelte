<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import TextField from "./TextField.svelte";
  import NumberField from "./NumberField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import OptionalField from "./OptionalField.svelte";
  import ColorField from "./ColorField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const gh = $derived(store.spec?.theme?.groupHeaders);

  function setField(field: string, value: unknown) {
    store.setThemeField("groupHeaders", field, value);
  }

  /**
   * Which group-header levels get their backgrounds painted by the banding
   * layer — in those slots the level's own `background` knob is ignored
   * (svg-generator passes `renderBg=false` when the group header is covered
   * by banding). We gray-out those rows + show an explanatory tooltip.
   *
   * banding rules:
   *   - mode === "group" with no level  → deepest group level only
   *   - mode === "group" with level = N → level N only
   *   - otherwise → no levels affected
   */
  const bandingCovers = $derived.by<Set<number>>(() => {
    const eb = store.effectiveBanding;
    const covered = new Set<number>();
    if (eb.mode !== "group") return covered;
    if (eb.level != null) {
      covered.add(eb.level);
      return covered;
    }
    // No explicit level: deepest present. Fall back to the max group depth
    // the store reports, capped to the three levels the panel exposes.
    const maxDepth = Math.min(3, Math.max(1, store.maxGroupDepth || 1));
    covered.add(maxDepth);
    return covered;
  });

  const bandingTooltip =
    "This row-group level is included in banding — background color is " +
    "painted by the banding layer. Change banding in the Basics section.";

  // Per-level rendering: the three levels share an identical set of knobs.
  // We generate the sections from a tuple list to keep the markup under
  // control — less scroll, easier to diff when we add level 4 later.
  const levels = [
    { n: 1, title: "Level 1 (outermost)", desc: "Row-group header at the shallowest depth." },
    { n: 2, title: "Level 2",             desc: "Nested row-group header." },
    { n: 3, title: "Level 3+",            desc: "Deepest nested row-group header." },
  ] as const;
</script>

{#if gh}
  {#each levels as lv (lv.n)}
    {@const fsKey     = `level${lv.n}FontSize` as keyof typeof gh}
    {@const fwKey     = `level${lv.n}FontWeight` as keyof typeof gh}
    {@const italicKey = `level${lv.n}Italic` as keyof typeof gh}
    {@const bgKey     = `level${lv.n}Background` as keyof typeof gh}
    {@const borderKey = `level${lv.n}BorderBottom` as keyof typeof gh}

    <SettingsSection title={lv.title} description={lv.desc}>
      <TextField
        label="Font size"
        hint={`CSS size for level ${lv.n} (e.g. "0.9375rem", "14px")`}
        value={String(gh[fsKey] ?? "")}
        onchange={(v) => setField(fsKey as string, v)}
      />
      <NumberField
        label="Font weight"
        hint="100–900"
        value={gh[fwKey] as number}
        min={100}
        max={900}
        step={100}
        onchange={(v) => setField(fwKey as string, v)}
      />
      <BooleanField
        label="Italic"
        value={gh[italicKey] as boolean}
        onchange={(v) => setField(italicKey as string, v)}
      />
      {#if bandingCovers.has(lv.n)}
        <!-- Banding owns the background at this level; the per-level bg
             slot has no effect. Render a disabled placeholder with an
             explanation tooltip so users understand why editing here
             is blocked. -->
        <div class="banding-note" title={bandingTooltip}>
          <span class="banding-label">Background</span>
          <span class="banding-pill">Set by banding</span>
        </div>
      {:else}
        <OptionalField
          label="Background"
          hint="Row background for this level. Inherits a primary-tint default when unset."
          inherit={gh[bgKey] == null}
          onchange={(inh) => setField(bgKey as string, inh ? null : "#eef2ff")}
        >
          {#snippet children()}
            <ColorField
              label=""
              value={(gh[bgKey] as string) ?? "#eef2ff"}
              onchange={(v) => setField(bgKey as string, v)}
            />
          {/snippet}
        </OptionalField>
      {/if}
      <BooleanField
        label="Border bottom"
        hint="Thin divider below the header"
        value={gh[borderKey] as boolean}
        onchange={(v) => setField(borderKey as string, v)}
      />
    </SettingsSection>
  {/each}

  <SettingsSection title="Indentation" description="Applies to all levels.">
    <NumberField
      label="Indent per level"
      hint="Horizontal offset per nesting depth (px)"
      value={gh.indentPerLevel}
      min={0}
      max={48}
      step={2}
      unit="px"
      onchange={(v) => setField("indentPerLevel", v)}
    />
  </SettingsSection>
{/if}

<style>
  .banding-note {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    cursor: help;
    opacity: 0.7;
  }
  .banding-label {
    font-size: 0.75rem;
    color: var(--wf-fg, #1a1a1a);
    font-weight: 500;
  }
  .banding-pill {
    font-size: 0.65rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 12%, transparent);
    color: var(--wf-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
</style>

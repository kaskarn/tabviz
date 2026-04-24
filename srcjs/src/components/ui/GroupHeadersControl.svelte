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

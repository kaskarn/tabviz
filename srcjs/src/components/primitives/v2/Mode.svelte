<!--
  Mode — the four-way mode pill for MappedValue overrides.

  Cycles a value between four orthogonal authoring modes:
    • theme       — inherited from theme cascade (default)
    • static      — author types a literal value
    • field       — author binds to a data column
    • condition   — author selects a named condition

  Visually: a 4-segment Pill with category-tinted active states. Each
  mode renders its glyph; the active segment inverts to its category
  ink shade so the mode is recognizable at a glance:
    theme       → neutral ink
    static      → ink
    field       → ink with ƒ glyph
    condition   → hot accent (the condition is dynamic)

  When the active mode is "condition", a small drop-down may appear
  next to the pill — that's the parent's job to render conditional on
  mode === "condition". This component owns mode selection only.
-->
<script lang="ts">
  import Pill from "./Pill.svelte";
  import type { PillSegment, MappedMode } from "./types";

  interface Props {
    value?: MappedMode;
    /** Pruned set of modes — defaults to all four. */
    modes?: MappedMode[];
    disabled?: boolean;
    ariaLabel?: string;
    onchange?: (next: MappedMode) => void;
  }

  let {
    value = $bindable("theme"),
    modes = ["theme", "static", "field", "condition"],
    disabled = false,
    ariaLabel = "value mode",
    onchange,
  }: Props = $props();

  const SEGMENT: Record<MappedMode, PillSegment<MappedMode>> = {
    theme:     { value: "theme",     glyph: "mode.theme",     title: "Theme (inherit cascade)" },
    static:    { value: "static",    glyph: "mode.static",    title: "Static literal" },
    field:     { value: "field",     glyph: "mode.field",     title: "Bind to data column" },
    condition: { value: "condition", glyph: "mode.condition", title: "Bind to named condition" },
  };

  const segments = $derived(modes.map((m) => SEGMENT[m]));
</script>

<div class="mode" class:mode-condition={value === "condition"}>
  <Pill
    bind:value
    {segments}
    mono
    iconOnly
    {ariaLabel}
    {disabled}
    onchange={(v) => onchange?.(v as MappedMode)}
  />
</div>

<style>
  /* When mode=condition the active segment shifts to hot accent — a
     soft visual hint that the value is dynamic (condition-bound).
     Other modes use Pill's default ink-on-cream active. */
  .mode.mode-condition :global(.seg.active) {
    background: var(--v2-hot, #b53a1f);
    color: var(--v2-paper, #faf7f0);
  }
</style>

<!--
  EnumRow — the ONE way an enum input renders in the panel
  (settings-overhaul P1 dialect law: every discrete choice is a
  Field + Pill on the shared spine; no .seg groups, no SVG card grids,
  no click-to-cycle widgets).

  Thin by design: hosts pass the current value + segments and splice the
  result into ThemeInputs themselves.
-->
<script lang="ts" generics="T extends string">
  import Field from "$components/primitives/v2/Field.svelte";
  import Pill from "$components/primitives/v2/Pill.svelte";
  import type { PillSegment } from "$components/primitives/v2/types";

  interface Props {
    label: string;
    hint?: string;
    value: T;
    segments: PillSegment<T>[];
    pinned?: boolean;
    onreset?: () => void;
    disabled?: boolean;
    onchange: (next: T) => void;
  }

  const { label, hint, value, segments, pinned, onreset, disabled, onchange }: Props = $props();
</script>

<Field {label} {hint} {pinned} {onreset}>
  <Pill {value} {segments} {disabled} ariaLabel={label} {onchange} />
</Field>

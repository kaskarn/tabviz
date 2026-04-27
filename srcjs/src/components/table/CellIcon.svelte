<script lang="ts">
  import type { IconColumnOptions } from "$types";

  interface Props {
    value: unknown;
    options?: IconColumnOptions;
    naText?: string;
  }

  let { value, options, naText }: Props = $props();

  const mapping = $derived(options?.mapping ?? {});
  const size = $derived(options?.size ?? "base");
  const color = $derived(options?.color);

  const displayValue = $derived.by(() => {
    if (value === undefined || value === null) return naText ?? "";
    const strValue = String(value);
    // If there's a mapping and the value is in it, use the mapped icon
    if (mapping && strValue in mapping) {
      return mapping[strValue];
    }
    // Otherwise, show the value as-is (could be an emoji)
    return strValue;
  });

  const sizeClass = $derived(
    size === "sm" ? "icon-sm"
    : size === "lg" ? "icon-lg"
    : size === "xl" ? "icon-xl"
    : "icon-base"
  );
</script>

{#if displayValue}
  <span
    class="cell-icon {sizeClass}"
    style:color={color}
    title={String(value ?? "")}
  >
    {displayValue}
  </span>
{/if}

<style>
  .cell-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .icon-sm {
    font-size: var(--tv-font-size-sm, 0.75rem);
  }

  .icon-base {
    font-size: var(--tv-font-size-base, 0.875rem);
  }

  .icon-lg {
    font-size: var(--tv-font-size-lg, 1rem);
  }

  /* xl is intended for editorial / pictographic single-glyph cells
     (pantry jar, mountain peak, fellbeast triangle). It will exceed
     normal rowHeight; best in tall rows that already contain a viz_*
     column, or with row spacing bumped up. */
  .icon-xl {
    font-size: 1.6rem;
  }
</style>

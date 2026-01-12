<script lang="ts">
  import type { BadgeColumnOptions } from "$types";

  interface Props {
    value: unknown;
    options?: BadgeColumnOptions;
  }

  let { value, options }: Props = $props();

  const variants = $derived(options?.variants ?? {});
  const colors = $derived(options?.colors ?? {});
  const size = $derived(options?.size ?? "base");

  const displayValue = $derived.by(() => {
    if (value === undefined || value === null) return "";
    return String(value);
  });

  // Get color based on: custom colors > variant mapping > default
  // Uses CSS variables for themeable badge colors
  const badgeColor = $derived.by(() => {
    const strValue = String(value ?? "");

    // Custom color takes precedence
    if (colors && strValue in colors) {
      return colors[strValue];
    }

    // Then check variant mapping - use CSS variables for theme awareness
    if (variants && strValue in variants) {
      const variant = variants[strValue];
      switch (variant) {
        case "success":
          return "var(--wf-badge-success, #16a34a)";
        case "warning":
          return "var(--wf-badge-warning, #f59e0b)";
        case "error":
          return "var(--wf-badge-error, #dc2626)";
        case "info":
          return "var(--wf-badge-info, #2563eb)";
        case "muted":
          return "var(--wf-badge-muted, var(--wf-muted, #64748b))";
        default:
          return "var(--wf-primary, #2563eb)";
      }
    }

    return "var(--wf-primary, #2563eb)";
  });

  const sizeClass = $derived(size === "sm" ? "badge-sm" : "badge-base");
</script>

{#if displayValue}
  <span
    class="cell-badge {sizeClass}"
    style:background-color="color-mix(in srgb, {badgeColor} 15%, var(--wf-bg, #fff))"
    style:color={badgeColor}
  >
    {displayValue}
  </span>
{/if}

<style>
  .cell-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    font-weight: 500;
    white-space: nowrap;
  }

  .badge-sm {
    padding: 1px 6px;
    font-size: var(--wf-font-size-sm, 0.75rem);
  }

  .badge-base {
    padding: 2px 8px;
    font-size: var(--wf-font-size-base, 0.875rem);
  }
</style>

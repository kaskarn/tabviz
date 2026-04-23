<script lang="ts">
  import type { StarsColumnOptions } from "$types";

  interface Props {
    value: number | undefined | null;
    options?: StarsColumnOptions;
    naText?: string;
  }

  let { value, options, naText }: Props = $props();

  const maxStars = $derived(Math.max(1, Math.min(20, options?.maxStars ?? 5)));
  const filledColor = $derived(options?.color ?? "#f59e0b");
  const emptyColor = $derived(options?.emptyColor ?? "#d1d5db");
  const halfStars = $derived(options?.halfStars ?? false);
  const domain = $derived(options?.domain ?? null);
  const size = $derived(options?.size ?? "base");
  const sizeClass = $derived(
    size === "sm" ? "stars-sm" : size === "lg" ? "stars-lg" : "stars-base"
  );

  // Unicode characters for stars
  const FILLED_STAR = "★";
  const EMPTY_STAR = "☆";
  const HALF_STAR = "⯪"; // Alternative: ★ with half-filled effect via CSS

  const starDisplay = $derived.by(() => {
    if (value === undefined || value === null) return [];

    let raw = value;
    if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[1] > domain[0]) {
      const clamped = Math.max(domain[0], Math.min(domain[1], raw));
      raw = ((clamped - domain[0]) / (domain[1] - domain[0])) * maxStars;
    }

    const rating = Math.max(0, Math.min(maxStars, raw));
    const stars: Array<{ char: string; filled: "full" | "half" | "empty" }> = [];

    for (let i = 1; i <= maxStars; i++) {
      if (i <= rating) {
        stars.push({ char: FILLED_STAR, filled: "full" });
      } else if (halfStars && i - 0.5 <= rating) {
        stars.push({ char: HALF_STAR, filled: "half" });
      } else {
        stars.push({ char: EMPTY_STAR, filled: "empty" });
      }
    }

    return stars;
  });
</script>

{#if value !== undefined && value !== null}
  <span class="cell-stars {sizeClass}" title="{value} / {maxStars}">
    {#each starDisplay as star, i (i)}
      <span
        class="star"
        class:filled={star.filled === "full"}
        class:half={star.filled === "half"}
        style:color={star.filled === "empty" ? emptyColor : filledColor}
      >
        {star.char}
      </span>
    {/each}
  </span>
{:else if naText}
  <span class="stars-na">{naText}</span>
{/if}

<style>
  .cell-stars {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    line-height: 1;
  }

  .stars-sm {
    font-size: 0.75em;
  }
  .stars-base {
    font-size: 0.9em;
  }
  .stars-lg {
    font-size: 1.1em;
  }

  .star {
    transition: color 0.15s ease;
  }
</style>

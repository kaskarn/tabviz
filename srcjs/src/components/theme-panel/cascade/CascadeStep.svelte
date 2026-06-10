<!--
  CascadeStep — the unit of pedagogical narration. Each cascade visualization
  sits inside a step whose chip ([category] · [facet]) anchors *where you
  are in the cascade*. Reading the panel top-to-bottom is reading the
  resolution flow:

    TIER 1 · COLOR        primitive ramps
    TIER 2 · BINDING      role spine
    TIER 2 · COLOR        semantic role contract
    TIER 3 · COLOR        component-token aliases
    SCALE · TYPE          type role samples
    RESILIENCE · FALLBACK Standard / RT / HC triptych

  The category is the row in the (tier × axis) grid; the facet is the
  domain at that step. Chip color-coding tracks category.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  /** Category names the kind of cascade we're stepping through; facet
   *  names the domain or action at this step. Free-form strings so future
   *  categories (GEOMETRY, EFFECTS, ...) drop in without a type bump. */
  type Category = "TIER 1" | "TIER 2" | "TIER 3" | "SCALE" | "RESILIENCE" | string;

  const {
    category,
    facet,
    heading,
    prose,
    aside,
    children,
  }: {
    category: Category;
    facet: string;
    heading: string;
    /** Markdown-style emphasis is honored via `<strong>` / `<em>` in raw HTML
     *  strings — keep it short. */
    prose: string;
    /** Optional right-aligned slot for filter chips, controls, etc. */
    aside?: Snippet;
    /** The cascade visualization body. */
    children?: Snippet;
  } = $props();

  /** Normalize "TIER 1" / "TIER 2" / "TIER 3" / "SCALE" / "RESILIENCE" into
   *  a stable data-attribute key for the chip color theme. */
  function categoryKey(c: string): string {
    const s = c.replace(/\s+/g, "-").toLowerCase();
    return s;
  }
</script>

<section class="cascade-step" data-category={categoryKey(category)}>
  <header>
    <div class="title">
      <span class="chip">
        <span class="chip-cat">{category}</span>
        <span class="chip-dot">·</span>
        <span class="chip-facet" data-facet={facet}>{facet}</span>
      </span>
      <h3>{heading}</h3>
    </div>
    {#if aside}
      <div class="aside">{@render aside()}</div>
    {/if}
  </header>
  <p class="prose">{@html prose}</p>
  {#if children}
    <div class="body">{@render children()}</div>
  {/if}
</section>

<style>
  .cascade-step {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 22px 24px 26px;
    border-top: 1px solid var(--tp-rule, #e8e6e1);
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .title { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--tp-chip-fg, #66635c);
    align-self: flex-start;
  }
  .chip-cat {
    padding: 3px 7px 2px;
    border-radius: 3px;
    background: var(--cat-bg, #1c1a17);
    color: var(--cat-fg, #faf9f6);
    letter-spacing: 0.08em;
  }
  .chip-facet {
    padding: 2px 7px;
    border: 1px solid var(--cat-rule, #c8c4bd);
    border-radius: 3px;
    color: var(--cat-cat, #66635c);
    background: var(--cat-faint, #faf9f6);
  }
  .chip-dot { opacity: 0.35; }
  h3 {
    margin: 0;
    /* Route through the v2 sans + size scale so cascade titles share the
       studio chrome's typeface — was a third heading font (-apple-system
       17px) competing in one viewport. */
    font-family: var(--v2-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    font-size: var(--v2-text-large, 16px);
    font-weight: 600;
    line-height: 1.2;
    color: var(--tp-fg, #1c1a17);
  }
  .prose {
    margin: 0;
    color: var(--tp-fg-muted, #4d4a45);
    font-size: 12.5px;
    line-height: 1.55;
    max-width: 64ch;
  }
  .prose :global(strong) { color: var(--tp-fg, #1c1a17); font-weight: 600; }
  .prose :global(em) { font-style: italic; }
  .aside {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .body { margin-top: 6px; }

  /* Category color-coding — chip tier follows rgc's tier palette
     (warm-amber TIER 1, violet TIER 2, teal TIER 3) + neutrals for the
     non-numeric cascades (SCALE, RESILIENCE). */
  .cascade-step[data-category="tier-1"]    { --cat-bg: #1c1a17; --cat-fg: #fdf6ef; --cat-faint: #fdf6ef; --cat-rule: #e3d4be; --cat-cat: #946a2c; }
  .cascade-step[data-category="tier-2"]    { --cat-bg: #1c1a17; --cat-fg: #f0eef8; --cat-faint: #f0eef8; --cat-rule: #c8c3e0; --cat-cat: #5e51a3; }
  .cascade-step[data-category="tier-3"]    { --cat-bg: #1c1a17; --cat-fg: #eef5f4; --cat-faint: #eef5f4; --cat-rule: #b6cfcc; --cat-cat: #3f6f6b; }
  .cascade-step[data-category="scale"]     { --cat-bg: #1c1a17; --cat-fg: #f0f4f8; --cat-faint: #f0f4f8; --cat-rule: #b9c7d8; --cat-cat: #3d5878; }
  .cascade-step[data-category="resilience"] { --cat-bg: #1c1a17; --cat-fg: #fceee9; --cat-faint: #fceee9; --cat-rule: #e5b9aa; --cat-cat: #a04c34; }
  /* GEOMETRY + EFFECTS sit under TIER 1 but use distinct facet tones so
     the chip identifies the axis at a glance. */
  .cascade-step[data-category="tier-1"]:has(.chip-facet:where([data-facet="GEOMETRY"])) { --cat-rule: #c4dbc4; --cat-cat: #3f7045; }
  .cascade-step[data-category="tier-1"]:has(.chip-facet:where([data-facet="EFFECTS"]))  { --cat-rule: #e5c8e9; --cat-cat: #7a3d92; }
</style>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title?: string | null;
    subtitle?: string | null;
    /**
     * When true the component always renders its slot layout and adds
     * ghost-text "Add title…" / "Add subtitle…" affordances for missing
     * labels. Each label becomes dblclick-editable via the `onedit`
     * callback. When false the component only shows existing labels and
     * exposes no edit affordances (pure presentational mode).
     */
    enableEdit?: boolean;
    /** Fired when a label is double-clicked (or the Add-label slot is clicked). */
    onedit?: (
      field: "title" | "subtitle",
      anchor: HTMLElement,
    ) => void;
    controls?: Snippet;
  }

  let {
    title,
    subtitle,
    enableEdit = false,
    onedit,
    controls,
  }: Props = $props();

  // Render the area only when a real label is present. An always-reserved
  // header slot (to host Add-label affordances) breaks intentional spacing
  // between the table and whichever labels ARE set — e.g. when a widget has
  // a title but no subtitle, an empty subtitle slot introduces a gap the
  // author didn't ask for. Users add labels via the Basics settings tab.
  const show = $derived(!!title || !!subtitle);

  function handle(field: "title" | "subtitle", e: MouseEvent) {
    if (!enableEdit || !onedit) return;
    e.preventDefault();
    onedit(field, e.currentTarget as HTMLElement);
  }

  function handleKey(field: "title" | "subtitle", e: KeyboardEvent) {
    if (!enableEdit || !onedit) return;
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      onedit(field, e.currentTarget as HTMLElement);
    }
  }
</script>

{#if show}
  <div class="header-area" class:has-both={title && subtitle}>
    <div class="title-area">
      {#if title}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <h2
          class="plot-title"
          class:editable={enableEdit}
          ondblclick={(e) => handle("title", e)}
          onkeydown={(e) => handleKey("title", e)}
          tabindex={enableEdit ? 0 : undefined}
          role={enableEdit ? "button" : undefined}
          title={enableEdit ? "Double-click to edit title" : undefined}
        >{title}</h2>
      {/if}
      {#if subtitle}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <p
          class="plot-subtitle"
          class:editable={enableEdit}
          ondblclick={(e) => handle("subtitle", e)}
          onkeydown={(e) => handleKey("subtitle", e)}
          tabindex={enableEdit ? 0 : undefined}
          role={enableEdit ? "button" : undefined}
          title={enableEdit ? "Double-click to edit subtitle" : undefined}
        >{subtitle}</p>
      {/if}
    </div>
    {#if controls}
      <div class="controls-area">
        {@render controls()}
      </div>
    {/if}
  </div>
{/if}

<style>
  .header-area {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 8px 4px 2px;
  }


  .title-area {
    flex: 1;
    min-width: 0;
  }

  .controls-area {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-top: 2px;
  }

  .plot-title {
    margin: 0;
    padding: 0 0 0.15rem 0;
    border: none;
    font-size: var(--wf-font-size-lg, 1rem);
    font-weight: var(--wf-font-weight-bold, 600);
    color: var(--wf-fg, #1a1a1a);
    line-height: 1.3;
    white-space: normal;
    word-wrap: break-word;
  }

  .plot-subtitle {
    margin: 4px 0 0;
    font-size: var(--wf-font-size-base, 0.875rem);
    font-weight: var(--wf-font-weight-normal, 400);
    color: var(--wf-secondary, #64748b);
    line-height: 1.4;
    white-space: normal;
    word-wrap: break-word;
  }

  /* Subtle separator above subtitle when both title and subtitle exist.
     Total gap (border + padding) is themable via
     `--wf-title-subtitle-gap` so the SVG export and live widget agree
     on the same number; the CSS subtracts the border's 1px from the
     padding so the visible gap matches the theme value. Defaults to
     13 (1 border + 12 padding) which matches the prior hardcoded
     6+1+6 chain. */
  .has-both .plot-subtitle {
    border-top: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 30%, transparent);
    padding-top: calc(var(--wf-title-subtitle-gap, 13px) - 1px);
    margin-top: 0;
  }

  /* Editable hover feedback. The label itself keeps its font/color; only the
     cursor changes so authors can spot where edits land without visual noise. */
  .editable {
    cursor: text;
  }
</style>

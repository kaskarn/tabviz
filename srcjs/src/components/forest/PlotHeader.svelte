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

  // Render the area whenever we have a real label OR we're in edit mode and
  // need to show Add-label affordances. This avoids a fully-empty header
  // row on non-editable widgets (back-compat with the old behavior).
  const show = $derived(!!title || !!subtitle || enableEdit);

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
      {:else if enableEdit}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <h2
          class="plot-title add-label"
          onclick={(e) => handle("title", e)}
          onkeydown={(e) => handleKey("title", e)}
          tabindex="0"
          role="button"
          title="Click to add a title"
        >Add title…</h2>
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
      {:else if enableEdit}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <p
          class="plot-subtitle add-label"
          onclick={(e) => handle("subtitle", e)}
          onkeydown={(e) => handleKey("subtitle", e)}
          tabindex="0"
          role="button"
          title="Click to add a subtitle"
        >Add subtitle…</p>
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

  /* Subtle separator above subtitle when both title and subtitle exist */
  .has-both .plot-subtitle {
    border-top: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 30%, transparent);
    padding-top: 6px;
    margin-top: 6px;
  }

  /* Editable hover feedback. The label itself keeps its font/color; only the
     cursor changes so authors can spot where edits land without visual noise. */
  .editable {
    cursor: text;
  }

  /* "Add title…" / "Add subtitle…" placeholder slots — only rendered when
     enableEdit is on AND the matching label is absent. Faded so they read
     as chrome, not content. */
  .add-label {
    cursor: text;
    opacity: 0.35;
    font-style: italic;
    font-weight: var(--wf-font-weight-normal, 400);
  }

  .add-label:hover,
  .add-label:focus-visible {
    opacity: 0.8;
    outline: none;
  }
</style>

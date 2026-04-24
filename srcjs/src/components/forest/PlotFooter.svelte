<script lang="ts">
  interface Props {
    caption?: string | null;
    footnote?: string | null;
    /**
     * When true the footer always renders and exposes Add-label slots for
     * missing caption/footnote, matching PlotHeader's edit mode. Each label
     * becomes dblclick-editable via the `onedit` callback.
     */
    enableEdit?: boolean;
    onedit?: (
      field: "caption" | "footnote",
      anchor: HTMLElement,
    ) => void;
  }

  let { caption, footnote, enableEdit = false, onedit }: Props = $props();

  const show = $derived(!!caption || !!footnote || enableEdit);

  function handle(field: "caption" | "footnote", e: MouseEvent) {
    if (!enableEdit || !onedit) return;
    e.preventDefault();
    onedit(field, e.currentTarget as HTMLElement);
  }

  function handleKey(field: "caption" | "footnote", e: KeyboardEvent) {
    if (!enableEdit || !onedit) return;
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      onedit(field, e.currentTarget as HTMLElement);
    }
  }
</script>

{#if show}
  <div class="plot-footer">
    {#if caption}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <p
        class="plot-caption"
        class:editable={enableEdit}
        ondblclick={(e) => handle("caption", e)}
        onkeydown={(e) => handleKey("caption", e)}
        tabindex={enableEdit ? 0 : undefined}
        role={enableEdit ? "button" : undefined}
        title={enableEdit ? "Double-click to edit caption" : undefined}
      >{caption}</p>
    {:else if enableEdit}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <p
        class="plot-caption add-label"
        onclick={(e) => handle("caption", e)}
        onkeydown={(e) => handleKey("caption", e)}
        tabindex="0"
        role="button"
        title="Click to add a caption"
      >Add caption…</p>
    {/if}
    {#if footnote}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <p
        class="plot-footnote"
        class:editable={enableEdit}
        ondblclick={(e) => handle("footnote", e)}
        onkeydown={(e) => handleKey("footnote", e)}
        tabindex={enableEdit ? 0 : undefined}
        role={enableEdit ? "button" : undefined}
        title={enableEdit ? "Double-click to edit footnote" : undefined}
      >{footnote}</p>
    {:else if enableEdit}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <p
        class="plot-footnote add-label"
        onclick={(e) => handle("footnote", e)}
        onkeydown={(e) => handleKey("footnote", e)}
        tabindex="0"
        role="button"
        title="Click to add a footnote"
      >Add footnote…</p>
    {/if}
  </div>
{/if}

<style>
  .plot-footer {
    padding: 8px 12px 12px 2px;
    border-top: 1px solid var(--wf-border, #e2e8f0);
  }

  .plot-caption {
    margin: 0;
    font-size: var(--wf-font-size-sm, 0.75rem);
    font-weight: var(--wf-font-weight-normal, 400);
    color: var(--wf-secondary, #64748b);
    line-height: 1.4;
    white-space: normal;
    word-wrap: break-word;
  }

  .plot-footnote {
    margin: 4px 0 0;
    font-size: var(--wf-font-size-sm, 0.75rem);
    font-weight: var(--wf-font-weight-normal, 400);
    color: var(--wf-muted, #94a3b8);
    font-style: italic;
    line-height: 1.4;
    white-space: normal;
    word-wrap: break-word;
  }

  .editable {
    cursor: text;
  }

  .add-label {
    cursor: text;
    opacity: 0.35;
    font-style: italic;
  }

  .add-label:hover,
  .add-label:focus-visible {
    opacity: 0.8;
    outline: none;
  }
</style>

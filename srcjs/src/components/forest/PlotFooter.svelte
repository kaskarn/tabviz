<script lang="ts">
  import EdgeResize from "$components/ui/EdgeResize.svelte";

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
    /** Current footer gap in px — drives the drag handle's value. */
    footerGap?: number;
    /** Live update during a drag (does not record). */
    onpreviewfootergap?: (value: number) => void;
    /** Commit on pointerup (records + re-measures). */
    oncommitfootergap?: (value: number) => void;
  }

  let {
    caption,
    footnote,
    enableEdit = false,
    onedit,
    footerGap,
    onpreviewfootergap,
    oncommitfootergap,
  }: Props = $props();

  const showHandle = $derived(
    enableEdit &&
    typeof footerGap === "number" &&
    !!onpreviewfootergap &&
    !!oncommitfootergap,
  );

  // Render only when a label is present. An always-reserved footer slot
  // would introduce spacing the author didn't ask for (see PlotHeader
  // for the matching rationale). Labels are added via the Basics settings
  // tab; this component keeps dblclick-to-edit on labels that are set.
  const show = $derived(!!caption || !!footnote);

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
    {#if showHandle}
      <EdgeResize
        value={footerGap!}
        min={0}
        max={80}
        onpreview={(v) => onpreviewfootergap!(v)}
        oncommit={(v) => oncommitfootergap!(v)}
        label="Footer gap"
      />
    {/if}
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
    {/if}
  </div>
{/if}

<style>
  .plot-footer {
    /* Top padding is themable via `spacing.footer_gap` (R) /
       `spacing.footerGap` (JS) so authors can tighten or loosen the gap
       between the plot / axis region and the caption band. */
    padding: var(--tv-footer-gap, 8px) 12px 12px 2px;
    border-top: 1px solid var(--tv-border, #e2e8f0);
    position: relative;
  }

  .plot-caption {
    margin: 0;
    font-size: var(--tv-text-caption-size, var(--tv-font-size-sm, 0.75rem));
    font-weight: var(--tv-text-caption-weight, var(--tv-font-weight-normal, 400));
    font-style: var(--tv-text-caption-italic, normal);
    color: var(--tv-secondary, #64748b);
    line-height: 1.4;
    white-space: normal;
    word-wrap: break-word;
  }

  .plot-footnote {
    margin: 4px 0 0;
    font-size: var(--tv-text-footnote-size, var(--tv-font-size-sm, 0.75rem));
    font-weight: var(--tv-text-footnote-weight, var(--tv-font-weight-normal, 400));
    font-style: var(--tv-text-footnote-italic, italic);
    color: var(--tv-muted, #94a3b8);
    line-height: 1.4;
    white-space: normal;
    word-wrap: break-word;
  }

  .editable {
    cursor: text;
  }
</style>

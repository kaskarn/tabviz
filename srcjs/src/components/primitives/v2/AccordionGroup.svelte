<!--
  AccordionGroup — wrap a region whose <Section> descendants should
  behave as one-open-at-a-time. The first Section to register opens
  by default. Each Section auto-collapses when another opens.

  Use:
    <AccordionGroup>
      <Section title="Layout">...</Section>
      <Section title="Banding">...</Section>
      <Section title="Borders">...</Section>
    </AccordionGroup>

  Section sees the context, becomes collapsible, and coordinates open
  state through the group. No prop drilling on the caller side.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { setContext } from "svelte";

  interface Props {
    /** Initial section id to open. Defaults to the first registered. */
    initialOpen?: string | null;
    children?: Snippet;
  }
  let { initialOpen = null, children }: Props = $props();

  // eslint-disable-next-line svelte/state-referenced-locally — the
  // initial value is captured intentionally; later prop changes
  // shouldn't reset which section is open after the user clicked.
  let openId = $state<string>(initialOpen ?? "");

  setContext("v2-accordion-group", {
    get openId() { return openId; },
    setOpen(id: string) { openId = id; },
    register(id: string) {
      // First section to register becomes the default-open if no
      // initial was specified.
      if (openId === "") openId = id;
    },
  });
</script>

{@render children?.()}

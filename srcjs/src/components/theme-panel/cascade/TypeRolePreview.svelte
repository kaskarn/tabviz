<!--
  TypeRolePreview — Scale × Type cascade step.

  Lists every text role with a live sample rendered in its actual
  family × size × weight; the right side prints `--font-X` and the
  `(family · size · weight)` spec. The cascade reads as a working
  type specimen.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { inspectorStore } from "$stores/inspector-store.svelte";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  type Role = {
    key: string;
    /** Bare role name (e.g. `text-title`); the leading `--tv-` is added
     *  at use. Stored without the prefix so the drift gate's literal
     *  scan doesn't treat the displayed label as a consumer reference. */
    base: string;
    family: "display" | "body" | "mono";
    sample: string;
  };

  // Curated subset of the typography roles, ordered top-down by visual
  // weight. Tabviz exposes more roles than rgc; we lean on the most
  // editorially load-bearing ones for the specimen.
  const ROLES: Role[] = [
    { key: "title",    base: "text-title",    family: "display", sample: "Change in primary endpoint" },
    { key: "subtitle", base: "text-subtitle", family: "body",    sample: "A randomised controlled trial" },
    { key: "body",     base: "text-body",     family: "body",    sample: "Compound A, 50 mg" },
    { key: "numeric",  base: "text-numeric",  family: "body",    sample: "−8.4 (−10.1 to −6.7)" },
    { key: "label",    base: "text-label",    family: "mono",    sample: "TABLE 2" },
    { key: "caption",  base: "text-caption",  family: "body",    sample: "Adjusted for baseline score, age, and study site." },
    { key: "footnote", base: "text-footnote", family: "body",    sample: "Lower scores indicate improvement." },
  ];

  const VAR_PREFIX = "--tv-";

  function read(suffix: string, fallback: string): string {
    const v = resolved.cssVars[`${VAR_PREFIX}${suffix}`];
    return v && v.length > 0 ? v : fallback;
  }

  function familyFor(role: Role): string {
    return read(`${role.base}-family`, "system-ui, -apple-system, sans-serif");
  }
  function sizeFor(role: Role): string {
    return read(`${role.base}-size`, "14px");
  }
  function weightFor(role: Role): string {
    return read(`${role.base}-weight`, "400");
  }
  function lhFor(role: Role): string {
    return read(`${role.base}-lh`, "1.4");
  }

  function shortFamily(role: Role): string {
    // Show the family slot (display / body / mono) — rgc-style. The
    // resolved family stack is too long to print inline.
    return role.family;
  }

  function shortSize(role: Role): string {
    const s = sizeFor(role);
    // Normalize "16px" → "16", "1rem" → "1rem", strip trailing "px"
    return s.endsWith("px") ? s.slice(0, -2) + "px" : s;
  }

  function click(role: Role): void {
    inspectorStore.trace(`${VAR_PREFIX}${role.base}-font`, resolved);
  }
</script>

<div class="type-role-preview">
  {#each ROLES as role (role.key)}
    <button
      type="button"
      class="row"
      onclick={() => click(role)}
      aria-label={`Trace ${VAR_PREFIX}${role.base}`}
    >
      <span
        class="sample"
        style:font-family={familyFor(role)}
        style:font-size={sizeFor(role)}
        style:font-weight={weightFor(role)}
        style:line-height={lhFor(role)}
      >{role.sample}</span>
      <span class="spec">
        <code class="name">{VAR_PREFIX}{role.base}</code>
        <span class="dims">
          <span class="dim">{shortFamily(role)}</span>
          <span class="sep">·</span>
          <span class="dim">{shortSize(role)}</span>
          <span class="sep">·</span>
          <span class="dim">{weightFor(role)}</span>
        </span>
      </span>
    </button>
  {/each}
</div>

<style>
  .type-role-preview {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--tp-rule, #e8e6e1);
    border-radius: 6px;
    overflow: hidden;
    background: var(--tp-bg, #ffffff);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
    align-items: center;
    padding: 16px 18px;
    border-bottom: 1px solid var(--tp-rule-faint, #f1efea);
    background: transparent;
    border-left: 0;
    border-right: 0;
    border-top: 0;
    text-align: left;
    cursor: pointer;
    color: var(--tp-fg, #1c1a17);
    transition: background 80ms ease;
  }
  .row:last-child { border-bottom: 0; }
  .row:hover { background: var(--tp-row-active, #f9f7f2); }
  .sample {
    color: var(--tp-fg, #1c1a17);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .spec {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    min-width: 0;
  }
  .name {
    font-size: 11.5px;
    color: var(--tp-rhs, #5e51a3);
  }
  .dims {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    font-size: 10.5px;
    color: var(--tp-muted, #6b6760);
  }
  .sep { opacity: 0.45; }
</style>

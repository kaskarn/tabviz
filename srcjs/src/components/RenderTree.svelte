<!--
  RenderNode → DOM mounter.

  Recursive Svelte component that walks a RenderNode tree and mounts
  the right DOM. Paired with `schema/render-svg.ts` — both consume
  the same tree shape, letting cell formatters stay pure and
  renderer-agnostic.

  Theme tokens (font: "base"|"display"|…; size: "major"|"minor"|…;
  color: "primary"|"muted"|…) get translated to CSS classes; the
  active theme's CSS owns the literal values. Numeric / hex values
  pass through as inline style. Tags are also emitted as CSS classes
  (`.tag-<name>`) so themes can target structural nodes via plain
  CSS selectors — same model as the SVG path's `applyTheme` overlays
  but in the cascade.
-->

<script lang="ts">
  import type {
    RenderNode,
    RenderText,
    RenderGroup,
    RenderSvg,
    RenderSpacer,
    RenderImage,
    RenderComponent,
    TextStyle,
    GroupStyle,
  } from "../schema/render-types";
  import Self from "./RenderTree.svelte";
  import { getCellComponent } from "./render-component-registry";

  interface Props { node: RenderNode; }
  let { node }: Props = $props();

  // Theme tokens → CSS class names; raw values → inline style.
  function textClasses(s: TextStyle | undefined, tags: string[] | undefined): string {
    const out: string[] = [];
    if (s?.font   && isToken(s.font,   FONTS))   out.push(`font-${s.font}`);
    if (s?.size   && isToken(s.size,   SIZES))   out.push(`text-${s.size}`);
    if (s?.color  && isToken(s.color,  COLORS))  out.push(`text-${s.color}`);
    if (s?.weight && isToken(s.weight, WEIGHTS)) out.push(`fw-${s.weight}`);
    if (s?.italic) out.push("italic");
    if (tags) for (const t of tags) out.push(`tag-${cssSafe(t)}`);
    return out.join(" ");
  }
  function textStyle(s: TextStyle | undefined): string {
    const out: string[] = [];
    if (s?.font   && !isToken(s.font,   FONTS))   out.push(`font-family:${s.font}`);
    if (s?.size   && !isToken(s.size,   SIZES))   out.push(`font-size:${s.size}px`);
    if (s?.color  && !isToken(s.color,  COLORS))  out.push(`color:${s.color}`);
    if (s?.weight && !isToken(s.weight, WEIGHTS)) out.push(`font-weight:${s.weight}`);
    return out.join(";");
  }

  function groupClasses(s: GroupStyle | undefined, tags: string[] | undefined, layout: string, align: string): string {
    const out: string[] = [];
    out.push(`layout-${layout}`, `align-${align}`);
    if (s?.bg && isToken(s.bg, BGS)) out.push(`bg-${s.bg}`);
    if (tags) for (const t of tags) out.push(`tag-${cssSafe(t)}`);
    return out.join(" ");
  }
  function groupStyle(g: RenderGroup): string {
    const out: string[] = [];
    if (g.gap != null) out.push(`gap:${g.gap}px`);
    if (g.style?.padding != null) out.push(`padding:${g.style.padding}px`);
    if (g.style?.borderRadius != null) out.push(`border-radius:${g.style.borderRadius}px`);
    if (g.style?.bg && !isToken(g.style.bg, BGS)) out.push(`background:${g.style.bg}`);
    return out.join(";");
  }

  const FONTS   = ["base", "display", "number", "mono"];
  const SIZES   = ["major", "base", "minor"];
  const WEIGHTS = ["normal", "medium", "semibold", "bold"];
  const COLORS  = ["primary", "secondary", "muted", "accent"];
  const BGS     = ["base", "muted", "accent"];

  function isToken(v: unknown, allowed: string[]): boolean {
    return typeof v === "string" && allowed.includes(v);
  }
  function cssSafe(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]/g, "-");
  }
</script>

{#if node.kind === "text"}
  {@const t = node as RenderText}
  <span class={textClasses(t.style, t.tags)} style={textStyle(t.style)}>{t.value}</span>
{:else if node.kind === "group"}
  {@const g = node as RenderGroup}
  <span class={groupClasses(g.style, g.tags, g.layout ?? "row", g.align ?? "baseline")} style={groupStyle(g)}>
    {#each g.children as child (child)}
      <Self node={child} />
    {/each}
  </span>
{:else if node.kind === "svg"}
  {@const s = node as RenderSvg}
  <svg width={s.width} height={s.height} viewBox={s.viewBox ?? `0 0 ${s.width} ${s.height}`}>
    {@html s.markup}
  </svg>
{:else if node.kind === "spacer"}
  {@const sp = node as RenderSpacer}
  <span class="spacer" style={`width:${sp.size}px;height:${sp.size}px;display:inline-block`}></span>
{:else if node.kind === "image"}
  {@const im = node as RenderImage}
  <img src={im.src} alt={im.alt ?? ""} width={im.width} height={im.height} />
{:else if node.kind === "component"}
  {@const cn = node as RenderComponent}
  {@const Comp = getCellComponent(cn.name)}
  {#if Comp}
    <Comp {...cn.props} />
  {:else}
    <span class="render-tree-missing-component">[?{cn.name}]</span>
  {/if}
{/if}

<style>
  /* `layout-row` uses inline display so adjacent text fragments
     concatenate naturally — flex collapses internal whitespace,
     which mangles text composition (interval bounds, value+unit,
     etc.). column / stack are inline-flex because they need
     explicit stacking. */
  .layout-row    { display: inline; }
  .layout-column { display: inline-flex; flex-direction: column; align-items: flex-start; }
  .layout-stack  { display: inline-flex; flex-direction: column; align-items: flex-start; }

  .align-start    { align-items: flex-start; }
  .align-center   { align-items: center; }
  .align-end      { align-items: flex-end; }
  .align-baseline { align-items: baseline; }

  /* Theme tokens → CSS variables. The active WebTheme owns these
     vars via its scoped root; tokens below are the defaults so a
     RenderTree renders sensibly even without theme injection. */
  .text-major   { font-size: var(--tabviz-text-major, 14px); }
  .text-base    { font-size: var(--tabviz-text-base,  12px); }
  .text-minor   { font-size: var(--tabviz-text-minor, 10px); }

  .text-primary   { color: var(--tabviz-fg-primary,   inherit); }
  .text-secondary { color: var(--tabviz-fg-secondary, inherit); }
  .text-muted     { color: var(--tabviz-fg-muted,     #888); }
  .text-accent    { color: var(--tabviz-fg-accent,    inherit); }

  .fw-normal   { font-weight: 400; }
  .fw-medium   { font-weight: 500; }
  .fw-semibold { font-weight: 600; }
  .fw-bold     { font-weight: 700; }

  .italic { font-style: italic; }

  .font-base    { font-family: var(--tabviz-font-base,    inherit); }
  .font-display { font-family: var(--tabviz-font-display, inherit); }
  .font-number  { font-family: var(--tabviz-font-number,  inherit); }
  .font-mono    { font-family: var(--tabviz-font-mono,    monospace); }

  .bg-base   { background: var(--tabviz-bg-base,   transparent); }
  .bg-muted  { background: var(--tabviz-bg-muted,  rgba(0,0,0,0.05)); }
  .bg-accent { background: var(--tabviz-bg-accent, rgba(0,120,255,0.1)); }

  /* Visible diagnostic when a RenderComponent's `name` isn't found
     in the registry — surfaces missing registrations during dev. */
  .render-tree-missing-component {
    color: #c00;
    font-style: italic;
    font-family: monospace;
  }
</style>

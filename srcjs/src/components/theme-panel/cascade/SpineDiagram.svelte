<!--
  SpineDiagram — Tier 2 binding viz (read-only, purely pedagogical).

  Three vertical ramp columns (neutral / brand / accent) of wide grade
  boxes, each with an internal OKLCH triple. `PAPER` / `INK` directional
  anchors flank the neutral column. Role tokens render as pill chips
  pinned to their bound grades, with off-ramp lanes for grades that carry
  more than one role.

  Drag-to-rebind lives in the studio's RoleSpine component, which
  remains the editor surface. This diagram teaches the binding; it does
  not edit it.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { hexToOklch } from "$lib/oklch";
  import { ROLE_KIND, OFF_RAMP_ROLES, type RoleName, type RoleKind } from "$types/theme-roles";
  import { DEFAULT_ROLE_BINDINGS } from "$lib/theme/role-bindings";
  import { studioStore } from "../../../studio/studio-store.svelte";
  import { inspectorStore } from "$stores/inspector-store.svelte";
  import { TOKENS_BY_ROLE } from "$lib/theme/component-tokens";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  const ramps = $derived(resolved.ramps);

  // Filter — restricts visible role pins by their RoleKind.
  type Filter = "all" | RoleKind;
  let filter = $state<Filter>("all");

  type RampKey = "neutral" | "brand" | "accent";
  const RAMP_KEYS: RampKey[] = ["neutral", "brand", "accent"];
  const RAMP_LABEL: Record<RampKey, string> = {
    neutral: "neutral",
    brand:   "brand",
    accent:  "accent",
  };

  // Pull the studio's effective bindings (defaults + overrides). Roles
  // not present in the panel host (e.g. raw widget mount) fall back to
  // DEFAULT_ROLE_BINDINGS only.
  const overrides = $derived(studioStore.roleOverrides ?? {});

  interface Pin {
    role: RoleName;
    ramp: RampKey;
    grade: number;       // 1..11
    kind: RoleKind;
  }

  // Effective bindings for all on-ramp roles.
  const pins = $derived<Pin[]>(buildPins());

  function buildPins(): Pin[] {
    const out: Pin[] = [];
    for (const [name, def] of Object.entries(DEFAULT_ROLE_BINDINGS)) {
      const role = name as RoleName;
      if (OFF_RAMP_ROLES.has(role)) continue;
      const o = overrides[role];
      const b = o ?? def;
      if (b.ramp !== "neutral" && b.ramp !== "brand" && b.ramp !== "accent") continue;
      out.push({ role, ramp: b.ramp, grade: b.grade, kind: ROLE_KIND[role] });
    }
    return out;
  }

  const visiblePins = $derived(filter === "all" ? pins : pins.filter((p) => p.kind === filter));

  // Group visible pins by (ramp, grade) so we can render off-ramp lanes
  // when more than one role sits on the same grade.
  type GradeKey = `${RampKey}:${number}`;
  const pinsByGrade = $derived<Map<GradeKey, Pin[]>>(((): Map<GradeKey, Pin[]> => {
    const m = new Map<GradeKey, Pin[]>();
    for (const p of visiblePins) {
      const k: GradeKey = `${p.ramp}:${p.grade}`;
      let arr = m.get(k);
      if (!arr) { arr = []; m.set(k, arr); }
      arr.push(p);
    }
    return m;
  })());

  function pinsAt(ramp: RampKey, grade: number): Pin[] {
    return pinsByGrade.get(`${ramp}:${grade}`) ?? [];
  }

  // Roles that route to neutral but live on the *outside* of the brand /
  // accent columns (the visual "interior" pins). Surface/fill/text live
  // to the LEFT of the neutral column (the column reads as a "ledger"
  // page); brand/accent role pins live to the RIGHT of their column.
  function laneSide(ramp: RampKey): "left" | "right" {
    return ramp === "neutral" ? "left" : "right";
  }

  // ── click + hover ─────────────────────────────────────────────────────────
  function hoverRole(role: RoleName): void {
    document.documentElement.setAttribute("data-hovered-role", role);
  }
  function unhoverRole(): void {
    document.documentElement.removeAttribute("data-hovered-role");
  }
  function clickPin(role: RoleName): void {
    const tokens = TOKENS_BY_ROLE.get(role);
    if (tokens && tokens.length > 0) {
      inspectorStore.trace(tokens[0].cssVar, resolved);
    }
  }
  function clickGrade(ramp: RampKey, grade: number): void {
    inspectorStore.trace(`--tv-${ramp}-${grade}`, resolved);
  }

  // ── triple formatting + ink-on-plate contrast ────────────────────────────
  function fmt(hex: string): string {
    const t = hexToOklch(hex);
    return `${t.L.toFixed(3)} ${t.C.toFixed(3)} ${Math.round(t.H)}`;
  }
  function isLight(hex: string): boolean {
    return hexToOklch(hex).L > 0.55;
  }

  // ── pin label formatting — role-name → "surface · subtle" style ──────────
  function pinLabel(role: RoleName): string {
    return role.replace(/-/g, "·");
  }

  // Mini-swatch for the pin chip is the role's resolved hex.
  function pinSwatch(role: RoleName): string {
    return resolved.roles[role] ?? "#999";
  }

  // ── filter button helpers ────────────────────────────────────────────────
  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",    label: "all" },
    { key: "fill",   label: "fills" },
    { key: "border", label: "borders" },
    { key: "text",   label: "text" },
  ];
</script>

<div class="spine-diagram">
  <!-- Filter chip strip — restricts pin visibility by RoleKind. -->
  <div class="filter-bar" role="radiogroup" aria-label="Filter role pins by kind">
    {#each FILTERS as f (f.key)}
      <button
        type="button"
        role="radio"
        aria-checked={filter === f.key}
        class:on={filter === f.key}
        onclick={() => (filter = f.key)}
      >
        <span class="dot" data-kind={f.key}></span>{f.label}
      </button>
    {/each}
  </div>

  <div class="columns">
    {#each RAMP_KEYS as key (key)}
      {@const arr = ramps[key]}
      {@const side = laneSide(key)}
      <div class="column" data-ramp={key} data-side={side}>
        <header>
          <span class="dot" style:background={arr[8]}></span>
          <span class="name">{RAMP_LABEL[key]}</span>
        </header>

        {#if key === "neutral"}
          <div class="anchor anchor-top">PAPER</div>
        {/if}

        <div class="grades">
          {#each arr.slice(0, 11) as hex, i (i)}
            {@const grade = i + 1}
            {@const light = isLight(hex)}
            {@const at = pinsAt(key, grade)}
            <div class="row" data-ramp={key}>
              {#if side === "left"}
                <div class="lane">
                  {#each at as p (p.role)}
                    <button
                      type="button"
                      class="pin"
                      data-kind={p.kind}
                      onmouseenter={() => hoverRole(p.role)}
                      onmouseleave={unhoverRole}
                      onfocus={() => hoverRole(p.role)}
                      onblur={unhoverRole}
                      onclick={() => clickPin(p.role)}
                      aria-label={`Trace role ${p.role}`}
                    >
                      <span class="pin-label">{pinLabel(p.role)}</span>
                      <span class="pin-swatch" style:background={pinSwatch(p.role)}></span>
                    </button>
                  {/each}
                </div>
              {/if}
              <button
                type="button"
                class="grade-box"
                class:on-light={light}
                style:background={hex}
                onclick={() => clickGrade(key, grade)}
                title={`${key}.${grade} · ${hex}`}
                aria-label={`Trace ${key} grade ${grade}`}
              >
                <span class="grade-label">{key.charAt(0)}{grade}</span>
                <span class="grade-triple">{fmt(hex)}</span>
              </button>
              {#if side === "right"}
                <div class="lane">
                  {#each at as p (p.role)}
                    <button
                      type="button"
                      class="pin"
                      data-kind={p.kind}
                      onmouseenter={() => hoverRole(p.role)}
                      onmouseleave={unhoverRole}
                      onfocus={() => hoverRole(p.role)}
                      onblur={unhoverRole}
                      onclick={() => clickPin(p.role)}
                      aria-label={`Trace role ${p.role}`}
                    >
                      <span class="pin-swatch" style:background={pinSwatch(p.role)}></span>
                      <span class="pin-label">{pinLabel(p.role)}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>

        {#if key === "neutral"}
          <div class="anchor anchor-bottom">INK</div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .spine-diagram {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── filter chips ─────────────────────────────────────────────────────── */
  .filter-bar {
    display: inline-flex;
    align-self: flex-end;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--tp-rule, #e8e6e1);
    border-radius: 6px;
    background: var(--tp-input-bg, #faf9f6);
  }
  .filter-bar button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--tp-fg-muted, #4d4a45);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    letter-spacing: 0.04em;
  }
  .filter-bar button.on {
    background: var(--tp-fg, #1c1a17);
    color: var(--tp-input-bg, #faf9f6);
  }
  .filter-bar .dot {
    width: 8px; height: 8px; border-radius: 999px;
    background: currentColor;
    opacity: 0.85;
  }
  .filter-bar .dot[data-kind="fill"]   { background: #4a90e2; }
  .filter-bar .dot[data-kind="border"] { background: #2bb673; }
  .filter-bar .dot[data-kind="text"]   { background: #c8553d; }
  .filter-bar .dot[data-kind="all"]    { background: linear-gradient(135deg, #4a90e2 30%, #2bb673 50%, #c8553d 70%); }

  /* ── three-column layout ──────────────────────────────────────────────── */
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    column-gap: 24px;
    align-items: start;
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .column header {
    display: inline-flex;
    align-items: center;
    align-self: center;
    gap: 8px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 13px;
    color: var(--tp-fg, #1c1a17);
    padding-bottom: 4px;
  }
  .column header .dot {
    width: 9px; height: 9px; border-radius: 999px;
  }
  .column header .name {
    letter-spacing: 0.06em;
    text-transform: lowercase;
  }
  .anchor {
    align-self: center;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--tp-fg-muted, #4d4a45);
    padding: 2px 0;
  }
  .anchor-top    { margin-bottom: -2px; }
  .anchor-bottom { margin-top: -2px; }

  /* ── grade column ─────────────────────────────────────────────────────── */
  .grades {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .row {
    display: grid;
    align-items: stretch;
    column-gap: 8px;
  }
  .row[data-ramp="neutral"] { grid-template-columns: minmax(0, 1fr) 90px; }
  .row[data-ramp="brand"]   { grid-template-columns: 90px minmax(0, 1fr); }
  .row[data-ramp="accent"]  { grid-template-columns: 90px minmax(0, 1fr); }
  /* When pins are absent the lane collapses; the grade box stretches. */

  .lane {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    gap: 4px;
    min-width: 0;
  }
  .row[data-ramp="neutral"] .lane { justify-content: flex-end; }
  .row[data-ramp="brand"] .lane,
  .row[data-ramp="accent"] .lane  { justify-content: flex-start; }

  .grade-box {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
    border: 1px solid rgba(0, 0, 0, 0.10);
    border-radius: 5px;
    padding: 6px 10px;
    min-height: 38px;
    cursor: pointer;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.16);
    outline: 2px solid transparent;
    outline-offset: -2px;
  }
  .grade-box.on-light {
    color: rgba(20, 18, 16, 0.86);
    text-shadow: none;
  }
  .grade-box:hover,
  .grade-box:focus-visible {
    outline-color: var(--tp-fg, #1c1a17);
  }
  .grade-label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .grade-triple {
    font-size: 9px;
    line-height: 1.1;
    opacity: 0.75;
    word-spacing: 0.04em;
  }

  /* ── role pin chips ───────────────────────────────────────────────────── */
  .pin {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border: 1px solid var(--tp-rule, #d8d4cc);
    border-radius: 999px;
    background: var(--tp-input-bg, #ffffff);
    color: var(--tp-fg, #1c1a17);
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10.5px;
    line-height: 1.6;
    letter-spacing: 0.02em;
    cursor: pointer;
    max-width: 100%;
    white-space: nowrap;
    transition: border-color 80ms ease, transform 80ms ease;
  }
  .pin:hover { border-color: var(--tp-fg, #1c1a17); transform: translateY(-1px); }
  .pin-label { overflow: hidden; text-overflow: ellipsis; }
  .pin-swatch {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.12);
  }
  .pin[data-kind="border"] { border-style: dashed; }
  .pin[data-kind="text"]   { background: transparent; }

  /* Hovered role wires up via the document attribute (the existing chart
     consumer reads data-hovered-role for the "learning mode" highlight). */
  :global([data-hovered-role]) .pin { opacity: 0.45; }
  :global([data-hovered-role]) .pin:hover { opacity: 1; }
</style>

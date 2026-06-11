<!--
  RoleChipGrid — the compact color-role picker (component model Stage 2,
  docs/dev/component-model.md "Roles page" / "color chip grid").

  Swatch squares for every Tier-2 COLOR role, grouped by family; hover
  names the role (title attr + a live readout line); click picks. This
  is the RE-ROUTE surface — picking a role binds a component channel to
  it (cascade-coherent), never a raw value.
-->
<script lang="ts">
  import { ALL_ROLES, ROLE_KIND, type RoleName } from "../../../types/theme-roles";

  interface Props {
    /** Resolved role hexes — `resolveTheme(...).roles` (the SpineDiagram
     *  pattern). */
    roles: Partial<Record<RoleName, string>>;
    /** Currently bound role (highlight ring), if any. */
    value?: string | null;
    onpick: (role: RoleName) => void;
  }
  const { roles, value = null, onpick }: Props = $props();

  // Stable presentation groups — surfaces first, then text, borders,
  // engagement, status. Series slots are deliberately ABSENT (the slot
  // system is separate; component-model.md "Adjacent, deliberately
  // separate").
  const GROUPS: { label: string; filter: (r: RoleName) => boolean }[] = [
    { label: "Surface",  filter: (r) => r.startsWith("surface") || r.startsWith("fill") },
    { label: "Text",     filter: (r) => ROLE_KIND[r] === "text" && !r.startsWith("pos-") && !r.startsWith("neg-") && !r.startsWith("warn-") && !r.startsWith("info-") },
    { label: "Border",   filter: (r) => ROLE_KIND[r] === "border" && !r.startsWith("series-") },
    { label: "Brand + accent", filter: (r) => r.startsWith("brand-") || r.startsWith("accent-") || r.startsWith("highlight-") },
    { label: "Status",   filter: (r) => r.startsWith("pos-") || r.startsWith("neg-") || r.startsWith("warn-") || r.startsWith("info-") },
  ];
  const claimed = new Set<RoleName>();
  const grouped = GROUPS.map((g) => {
    const members = ALL_ROLES.filter((r) =>
      !r.startsWith("series-") && !claimed.has(r) && g.filter(r));
    for (const m of members) claimed.add(m);
    return { label: g.label, members };
  }).filter((g) => g.members.length > 0);

  let hovered = $state<RoleName | null>(null);
</script>

<div class="role-chip-grid" role="listbox" aria-label="Color roles">
  {#each grouped as group (group.label)}
    <div class="chip-group">
      <span class="group-label">{group.label}</span>
      <div class="chips">
        {#each group.members as role (role)}
          <button
            type="button"
            role="option"
            aria-selected={value === role}
            class="chip"
            class:selected={value === role}
            title={role}
            style:background={roles[role] ?? "#999"}
            onclick={() => onpick(role)}
            onmouseenter={() => (hovered = role)}
            onmouseleave={() => (hovered = null)}
            onfocus={() => (hovered = role)}
            onblur={() => (hovered = null)}
            aria-label={role}
          ></button>
        {/each}
      </div>
    </div>
  {/each}
  <div class="readout" aria-live="polite">{hovered ?? value ?? " "}</div>
</div>

<style>
  .role-chip-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
  }
  .chip-group {
    display: grid;
    grid-template-columns: 86px 1fr;
    align-items: start;
    gap: 6px;
  }
  .group-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.65;
    padding-top: 3px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    padding: 0;
    cursor: pointer;
  }
  .chip:hover { outline: 2px solid rgba(80, 130, 220, 0.55); outline-offset: 1px; }
  .chip.selected { outline: 2px solid rgba(80, 130, 220, 0.95); outline-offset: 1px; }
  .readout {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 10.5px;
    min-height: 14px;
    opacity: 0.8;
    padding-left: 92px;
  }
</style>

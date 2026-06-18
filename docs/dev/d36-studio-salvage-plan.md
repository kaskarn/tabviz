# D36 — Studio retirement via salvage-then-delete (option c)

**Status:** DECIDED (option c, 2026-06-18) — salvage the worthwhile pieces into
the live settings panel as part of a *careful final rethink of that menu*, then
delete the rest. This doc scopes the arc; it deliberately leaves the design
questions OPEN for that rethink rather than pre-deciding them.

## Why this isn't a quick delete

The studio is marked DORMANT/SUPERSEDED in CLAUDE.md, and the live settings
panel (`src/components/ui/settings/`) imports **nothing** from the studio
subgraph — so the subgraph is cleanly separable and a blind `rm` would compile.
But two of its sub-trees are genuinely worth a look before they go, and the
dependency map was misreported by the round-2 review agents in both directions.
Corrected facts (verified 2026-06-18):

- The live `ui/settings` panel does **not** reach `studio/`, `theme-panel/`, or
  `spine/`. (The one apparent `RoleChipGrid → SpineDiagram` hit is a **comment**,
  not an import.)
- `theme-diff.ts`'s header claims "the settings panel's divergence badge imports
  this" — **STALE**: nothing in the live panel imports it; it's reached only by
  `studio/snippet-generator.ts` (`rString`, `SnippetStep`). It rides with the
  studio, not separately.
- Accurate LOC (the agent's "~5,800 TS/Svelte" was overstated):

  | Sub-tree | LOC | Nature |
  |---|---|---|
  | `studio/` | 2,169 | gadget frame: Shell/Rail/Chart, store, pins/preset/snippet panels, snippet-generator |
  | `components/theme-panel/` (incl `cascade/`) | 1,944 | **the salvage candidates** — pedagogical cascade visualizations |
  | `components/spine/RoleSpine.svelte` | 295 | role-spine diagram (studio-only) |
  | `lib/theme/theme-diff.ts` | 281 | ThemeInputs diff machinery (studio-only now) |
  | **TS/Svelte total** | **~4,689** | + R `studio.R` (~385) + `tabviz_studio()` export + `build:studio` + `inst/studio/studio.js` (938 KB shipped) |

## What's worth salvaging (the open question)

The value is concentrated in `theme-panel/cascade/` — a tier-by-tier teaching
view of the V4 theme cascade, which is exactly the "teaching-by-default tiered
cascade visualization" the rgc-design lab vision called for (see the
`project_rgc_design_lab` memory + `docs/dev/rgc-design/`). Inventory:

- `RampPlateGrid` — Tier-1 reference plates (the anchor ramps).
- `EffectsPreview` / `GeometrySamples` / `TypeRolePreview` — Tier-1 effects /
  geometry / scale×type visualizations.
- `SpineDiagram` — Tier-2 role-binding viz (read-only, pedagogical).
- `OffTheScales` — semantic + computed roles that don't bind to a (ramp, grade).
- `ResilienceTriptych` — resilience × fallback cascade step.
- `TraceInspector` — click-to-trace a token back up the cascade.
- `AliasTable` / `CascadeStep` — alias-chain table + the narration unit.

These teach *how a theme resolves* — a genuinely useful thing the live panel
(which is task-oriented: pick a variation, edit a role, tweak this figure) does
NOT currently offer. The `studio/` gadget frame and `spine/RoleSpine` are the
editing-surface scaffolding the settings redesign already replaced — low salvage
value.

## OPEN DESIGN QUESTIONS for the menu rethink (do NOT pre-decide)

The settings panel's current taxonomy (D21) is `variations | labels | edit
theme | this figure`, with "edit theme" an inner cluster of `identity | plots |
styling`. The rethink should answer:

1. **Does cascade *teaching* belong in the settings menu at all?** It's
   explanatory, not task-oriented — maybe it's a separate "explain this theme"
   affordance (a popover / a docs surface / an inspector mode) rather than a
   settings tab. Or maybe a lightweight `TraceInspector` ("why is this token this
   color?") is the one piece that earns a place inline.
2. **If yes, which pieces?** The full tier-by-tier walkthrough, or just the
   high-value inspector(s)? Salvaging all 11 cascade components re-imports ~1,900
   LOC; salvaging only `TraceInspector` + `SpineDiagram` is a much smaller graft.
3. **Does this change the menu's spine?** A "rethink of that menu" might
   restructure the D21 tabs, not just bolt teaching on — e.g. an `inspect` peer
   to `edit theme`. This is the part the user flagged as wanting careful.
4. **Reader vs author surface.** Teaching viz is author/developer-facing; the
   D9 reversal made affordances default-on for developer-tinkerers. Decide
   whether the cascade view is gated (dev-only) or always available.

## Sequencing (once the rethink decides the above)

1. Rethink the menu → decide which cascade pieces (if any) graft in and where.
2. Move the salvaged components out of `theme-panel/` into the live panel tree,
   rewire their data source from `studio-store` to the live theme store, and
   wire them into the chosen menu surface. Extend `panel-liveness` +
   `settings-consequence` to cover the new controls/surface.
3. Delete the residual studio subgraph: `studio/`, the un-salvaged
   `theme-panel/` + `spine/`, `theme-diff.ts` (if snippet-generator goes),
   `R/studio.R` + `tabviz_studio()` export, `build:studio` + the Vite config,
   `tests/browser/studio-shot.mjs`, and the `inst/studio/` bundle.
4. Update CLAUDE.md (drop the studio from the architecture map + the DORMANT
   note) and the roadmap.

Until the rethink runs, the studio stays as-is (dormant but shipped). No partial
deletion — salvage and cut land together so the cascade pedagogy is never
homeless mid-flight.

# The component model — roles + routable components

Status: **design locked in discussion 2026-06-11** (user + Claude, two
design rounds). This is the centerpiece of roadmap area E (ontology
engagement) and the retirement path for the last v3 theme remnants (W4).
Wire work is W6 in `wire-freeze-inventory.md` — must land pre-freeze.

## Thesis

The theme system's three-tier ontology becomes **operable, not just
visible**, through a uniform two-level indirection:

- **T2 roles** = named values, one roster per channel type:
  color roles (`text`, `text-muted`, `surface-bg`, … → ramp grades),
  family roles (`display / body / mono / numeric` → font stacks),
  weight slots (`regular / medium / semibold / bold` → numbers),
  size slots (the type ladder), geometry slots (corners / rules).
  All of these EXIST today; they were built channel-by-channel
  (color roles, `type_roles`, `CORNER_SLOTS`/`RULE_SLOTS`) without a
  unifying surface.
- **T3 components** = sparse records of channel→role bindings, organized
  by table region, overridable per channel:
  `axis-label → { col: text-main, family: numeric, weight: regular }`.
  The component-tokens manifest already IS the default table — each
  token hardcodes its source role; this model makes those bindings
  editable.

### The three edit verbs

1. **Re-tune a role** — `text-muted → neutral.7`, `regular → 500`.
   Global: everything bound to the role follows. (Exists: `set_role`,
   RoleSpine, type_weights.)
2. **Re-route a component channel** — `title.col → accent-text`,
   `table-frame.col → border-muted`. Local, and cascade-coherent: the
   role re-resolves under polarity flips, anchor edits, HC mode — unlike
   a raw pin. (NEW — this is the missing middle layer.)
3. **Pin** — token → raw value. Last resort, unchanged.

Every editing surface states which verb it performs. This grammar IS the
"crisp T1–T2–T3 engagement" ship goal.

## Component taxonomy

Components are instances of a small set of **archetypes**, each a typed
channel signature. Channels come in three types: **role-ref** (validated
against that channel's roster), **enum literal**, **bounded scalar**.

| Archetype | Channels |
|---|---|
| Text | `col`(color role) · `family` · `size` · `weight` · `figures`(tabular/proportional) · `case/tracking` (flag-text smcp) |
| Border/rule | `col`(color role) · `width`(rule slot) · `style`(enum: solid/dashed/dotted) |
| Surface | `bg`(color role) · `radius`(corner slot) · `outline{col,width,style}` · `elevation`(effect enum) |
| Icon/indicator | `col` · `size` (chevrons, sort arrows, status glyphs, summary diamond — currently scattered hardcodes) |
| Decorative/effect | bespoke signatures: gradient bar `{from,to}`(color-role pair)`+angle`; watermark `col·opacity`; glow `anchor·intensity` |

**States.** The record is `component × state → sparse channel record`,
`base` implied, states sparse (most components define only base). Rows:
base/alt/hover/selected; cells: emphasis/muted/accent paint states;
headers: variant. This also gives HC mode a principled future home (a
state overlay) replacing inline resolver branches.

**Curated roster, not raw tokens.** ~25 named components grouped by
region — Header (header-cell, column-group), Rows (row-base,
group-header, summary, spacer), Plot (marks scaffold, axis-label,
axis-tick, reference-line, null-line), Frame (shell, paper, table-frame,
cell-grid, first-col-rule), Captions (title, subtitle, caption,
footnote, caption-chip, gradient-strip) — never the 147-token manifest
directly. Substrate: `region` + `component` grouping fields on
`ComponentToken` (also powers introspection + docs).

**Adjacent, deliberately separate.** Series slots (fill/stroke/shape per
series INDEX) keep the existing slot system — "components indexed by
series", same channel vocabulary, different key. Do not unify.

**Excluded.** Spacing (density + the spacing system own rhythm — routing
padding per component would fork the sizing model) and interaction
chrome (toolbar/panels/popovers — deliberately neutral; portaled chrome
can't inherit theme vars anyway, register D4).

## Wire shape (W6 — pre-freeze)

One sparse block on the theme envelope beside `roleOverrides`/`pins`:

```json
"components": {
  "axis-label": { "base": { "col": "text-main", "family": "numeric", "weight": "regular" } },
  "table-frame": { "base": { "col": "border-muted", "style": "solid" } }
}
```

- Validated per channel type at EVERY ingress (untrusted-wire rule):
  role-refs against the channel's roster, enums against vocab, scalars
  clamped. Structured `ThemeIssue` errors.
- Resolution: manifest default binding → `components` override →
  role/slot resolution → pins overlay. Must ride BOTH resolve paths in
  lockstep (`getCssVars` + `_emitV4CssVarsBody`) like pins do.
- R surface: `set_component(theme, "axis-label", col = "text-main",
  weight = "regular")` (naming TBD with the API review); rides
  `theme_to_wire`/`theme_from_wire`.
- This block is also the **retirement path for the v3 theme-css bridges**
  (borders cluster, first-column variant, header variant, container —
  old #72–74): they become manifest-table components and the bridge
  code deletes (W4 and W6 land together or W6 first).

## UI

- **Roles page (advanced settings + studio)**: per-channel compact
  pickers — the color chip grid (swatch squares, hover names the role),
  the existing weight ladder, a four-chip family row, the size ladder.
  Spine-equivalent manipulation, space-efficient.
- **Components page**: region accordions → component rows showing the
  live resolution as a spec line (`axis-label · ▪ text-main · numeric ·
  500`); each channel opens its chip picker. The pedagogy and the
  controls are the same surface.
- Settings panel hosts the compact form; studio the roomy form (the
  Tier1Sections sharing pattern — minus its tab regression, register
  D16).

## Staging

1. **Substrate + wire (pre-freeze, one arc)**: manifest `region`/
   `component` fields; the `components` wire block; both resolvers;
   ingress validation; R verb; parity + lockstep gates.
2. **Color channel UI**: chip-grid picker; components page (read +
   col-channel edit); borders re-routing ("table borders → border-muted"
   works end-to-end).
3. **Text + border-style channels**: family/size/weight/figures pickers
   (fold `type_roles` consumption into the same surface); icon records.
4. **States + decorative**: hover/selected/paint-state records; chip /
   gradient-strip / watermark records; HC-as-state-overlay exploration.

## Open questions (register)

- D17 — naming review: legibility names (`text-main`, `wgt-normal`
  style) vs the current roster names; ONE vocabulary, renamed in place
  if needed (aliases are migratable pre-freeze). Never two.

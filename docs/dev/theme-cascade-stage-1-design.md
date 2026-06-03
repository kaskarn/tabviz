# Stage 1 substrate-design

> **Status:** v0.6 — 2026-06-02. Phases 1–6 of Stage 1 design (full Stage 1 design complete).
> **Parent vision:** [`theme-cascade-rework.md`](theme-cascade-rework.md) — §4a (substrate moves), §5 Stage 1 scope.
> **Locks once approved:** the contract everything else in Stage 1 implementation reads from.

---

## 0. What this document settles

This doc settles **the contract everything else in Stage 1 reads from**:

- **Phase 1** — manifest shape, CSS-variable naming, drift gate. [§1–§7]
- **Phase 2** — override schema (`{role, ramp, grade}`), `theme-wire.ts` rewrite, `ResolvedTheme` shape, R `set_role_binding()` modifier. [§8–§14]
- **Phase 3** — `data-*` variant attribute namespace + scope-element ownership + SVG-export `<style>` embedding mechanics + librsvg envelope. [§15–§21]
- **Phase 4** — resolver capabilities (polarity flip, HC/RT modes, alpha companion ramps, curves, off-ramp roles, 18-preset audit, new Tier-1 variant inputs). [§22–§30]
- **Phase 5** — row-kind height cascade (layers 1–4 resolution, settings-panel control, drag-handle overlay-layer DOM plumbing). [§33–§37]
- **Phase 6** — migration plan, branch commit rhythm, visual regression strategy, v3 deletion checklist. [§39–§44]

Downstream Stage 1 work consumes this contract:
- The CSS-var wire emitter (`theme-css.ts` rewrite).
- Consumer migration (~30 files, in-branch).
- Settings-panel data-plumbing refactor.
- SVG-export `<style>` embedding (Phase 3).
- R-side `R/classes-theme.R` slimming + new modifier API.

What this doc does **not** settle (later Phase docs):
- Phase 3 — `data-*` variant attribute namespace + scope-element ownership + SVG-export embedding mechanics.
- Phase 4 — Polarity flip + HC/RT modes + alpha companions + curves + 18-preset audit.
- Phase 5 — Row-kind height cascade (layers 1–4 + dual affordance).
- Phase 6 — Migration plan + branch commit rhythm + visual regression strategy.

---

## 1. v3 token surface inventory (informs the manifest)

The current v3 cascade emits **~130 `--tv-*` CSS variables** across **~230 leaf fields** in `WebTheme`, consumed by **~30 renderer/UI files**. Highlights:

- **Row state cluster** — 10 row variants (`base`/`alt`/`hover`/`selected`/`emphasis`/`muted`/`accent`/`bold`/`fill`/`banding`), each with 4–6 leaves (`bg`, `fg`, `border`, `markerFill`, `markerStroke`, `fontWeight`).
- **Header cluster** — 3 styles (`light`/`tint`/`bold`) × 3 paint leaves + 6 text leaves.
- **Row-group cluster** — `L1`/`L2`/`L3` nesting × 4 paint + 6 text + `indentPerLevel`.
- **Text roles** — 9 named roles (`title`/`subtitle`/`body`/`cell`/`label`/`tick`/`footnote`/`caption`/`numeric`) × 6 leaves (`family`/`size`/`weight`/`figures`/`fg`/`italic`).
- **Spacing tokens** — 15 spacing fields (`rowHeight`/`headerHeight`/`padding`/`cellPaddingX`/`axisGap`/...).
- **Plot scaffold** — axis-line/tick/gridline/reference paints + axisLabel/tickLabel text-roles + `tickMarkLength`/`lineWidth`/`pointSize`.
- **Series slots** — 5 anchors × 8 leaves (fill/stroke + dim/hot variants + textFg + shape).
- **Marks recipes** — 6 mark types × 3 slot selectors (body/outline/line).
- **Layout / Axis / Borders / Variants** — assorted metadata + paint/border fields.

Full inventory captured in this conversation's Explore-agent output; will be the authoritative source as we populate manifest entries.

---

## 2. Naming convention: the `--tv-*` namespace, four layers visible

The v4 CSS-variable namespace makes the cascade's four layers visible in DevTools (the educational value rgc_v4 demonstrates). Prefix stays `--tv-` (consistent with v3; matches the npm package `@tabviz/core`).

### 2a. Layer prefixes

| Layer | Prefix | Example | Notes |
|---|---|---|---|
| Anchors (Tier 1 raw) | `--tv-anchor-*` | `--tv-anchor-paper`, `--tv-anchor-ink`, `--tv-anchor-brand` | The seed OKLCH triples. Rarely consumed directly. |
| Ramps (Tier 1 derived) | `--tv-ramp-{ramp}-{grade}` | `--tv-ramp-neutral-1`, `--tv-ramp-brand-9`, `--tv-ramp-accent-11`, `--tv-ramp-neutral-alpha-3` | 11-step ramps + alpha companions. Grade 1–11 (1-indexed, matches rgc_v4). |
| Roles (Tier 2) | `--tv-role-{role}` | `--tv-role-surface`, `--tv-role-text-muted`, `--tv-role-accent-fill`, `--tv-role-pos-text` | Semantic vocabulary the renderer thinks in. Bound to `(ramp, grade)` per the override schema. |
| Components (Tier 3) | `--tv-{cluster}-{leaf}` | `--tv-row-alt-bg`, `--tv-header-text-size`, `--tv-spacing-cell-padding-x` | The wire the renderer consumes. Each aliases a role (paint) or carries a scalar value (spacing/typography). |

### 2b. Component-token naming rules

- **All lowercase, hyphen-separated.** No camelCase.
- **Cluster prefix is required** (`row`, `header`, `cell`, `row-group`, `plot`, `spacing`, `text`, `series`, `marks`, etc.). Establishes scope.
- **Leaf names are descriptive, not abbreviated.** `cell-padding-x` not `cell-px`. `tick-mark-length` not `tick-len`. DevTools is the audience.
- **Compound leaves use dot-equivalent hyphenation**: `text.title.size` → `--tv-text-title-size`; `row.hover.bg` → `--tv-row-hover-bg`.
- **Indices use `-N`**: `series[0].fill` → `--tv-series-1-fill` (1-indexed in CSS, like ramp grades).

### 2c. Tier 1 inputs that consumers read directly

A handful of Tier-1 input values are read by consumers without going through Tier 2 (e.g. font families, status hex values that don't derive from ramps). These are emitted as `--tv-input-{name}`:

| Variable | Source |
|---|---|
| `--tv-input-font-body` | `inputs.fonts.body` |
| `--tv-input-font-display` | `inputs.fonts.display` |
| `--tv-input-font-mono` | `inputs.fonts.mono` |
| `--tv-input-status-positive` | `inputs.status.positive` (hex) |
| `--tv-input-status-negative` | `inputs.status.negative` |
| `--tv-input-status-warning` | `inputs.status.warning` |
| `--tv-input-status-info` | `inputs.status.info` |

### 2d. What changes from v3

| v3 variable | v4 variable | Why |
|---|---|---|
| `--tv-bg` | `--tv-row-base-bg` | "bg" was ambiguous (surface? row? container?). |
| `--tv-fg` | `--tv-cell-fg` (or `--tv-role-text` for renderers reading the role directly) | "fg" was overloaded across consumers. |
| `--tv-primary` | `--tv-anchor-brand` | "primary" was a v3 input-name; v4 uses anchor vocabulary. |
| `--tv-text-title-fg` | `--tv-text-title-fg` | Unchanged where naming was already cluster-prefixed and descriptive. |
| `--tv-row-bg` | `--tv-row-base-bg` | Disambiguate from `row-alt-bg`, `row-hover-bg`, etc. The "default" state is `base`. |
| `--tv-axis-line` | `--tv-plot-axis-line` | Cluster-prefixed. |
| `--tv-row-height` | `--tv-spacing-row-height` | Spacing tokens get the `spacing` cluster prefix. |
| `--tv-ramp-neutral-1` | (new) | v3 didn't expose ramps directly; v4 does for the Spine UI + Inspector + power users. |
| `--tv-role-surface` | (new) | v3 didn't expose Tier-2 roles directly; v4 does. |

This is mostly **regularization**, not rewriting for the sake of it. The substantive additions are the `--tv-ramp-*` and `--tv-role-*` layers; component tokens mostly get cluster prefixes they lacked or get disambiguating leaf-names.

---

## 3. Manifest entry shape

The manifest is a frozen const exported from `srcjs/src/lib/theme/component-tokens.ts`. Each entry describes one Tier-3 component token: its CSS variable, what kind of value it carries, where the value comes from in Tier 2 (or upstream), which renderer files consume it, and any per-mode behavior.

### 3a. The TypeScript shape

```typescript
/** What kind of value a component token carries. Determines how the CSS-var
 *  wire emits it, how the SVG `<style>` block interprets it, and how the
 *  Cascade Inspector classifies it. */
export type TokenKind =
  | "paint-fill"     // background-color / fill attribute
  | "paint-stroke"   // border-color / stroke attribute
  | "paint-color"    // color (text foreground)
  | "spacing-px"     // numeric px value (padding, gap, height)
  | "border-width"   // numeric px for border widths
  | "font-family"    // CSS font-family stack
  | "font-size"      // CSS font-size (px or rem)
  | "font-weight"    // CSS font-weight (numeric)
  | "font-italic"    // CSS font-style flag (true/false → "italic"/"normal")
  | "font-figures"   // font-variant-numeric ("tabular" | "proportional")
  | "opacity"        // 0..1 scalar
  | "shape"          // marker-shape enum (renderer-side)
  | "flag";          // boolean (rendered as data-* attribute, NOT a CSS var)

/** Where a token's value comes from. Used by the Cascade Inspector for
 *  provenance display and by the drift gate for "unsourced" detection. */
export type TokenSource =
  | { tier: "role"; role: RoleName }
  | { tier: "input"; input: keyof ThemeInputs }
  | { tier: "anchor"; anchor: AnchorName }
  | { tier: "computed"; note: string }   // resolver math, not a direct alias
  | { tier: "const"; note: string };     // hard-coded value (rare)

/** Per-mode behavior applied at resolve time. */
export type ModeBehavior = {
  /** HC mode: "drop" → emit transparent; "swap" → switch to a different role. */
  hc?: "drop" | { swap: RoleName };
  /** RT mode: "swap" → switch translucent role to opaque equivalent. */
  rt?: "drop" | { swap: RoleName };
};

/** One entry in the manifest. */
export type ComponentToken = {
  /** The CSS variable name emitted into :root. The wire identifier. */
  cssVar: string;
  /** What this token paints/scales/sizes. */
  kind: TokenKind;
  /** Provenance — where the resolved value comes from. */
  source: TokenSource;
  /** Consumer files (relative to srcjs/src/) that read this token. The drift
   *  gate enforces: every cssVar referenced by a consumer must appear here,
   *  and every cssVar declared here must be referenced by at least one
   *  consumer (modulo KNOWN_UNCONSUMED grandfathering). */
  consumedBy: readonly string[];
  /** Optional: per-mode behavior the resolver applies. Inspector reads this. */
  modes?: ModeBehavior;
  /** Optional: short human-readable description for the Inspector. */
  description?: string;
};

/** The manifest. Frozen at module load. Drift gate operates against this. */
export const COMPONENT_TOKENS: ReadonlyArray<ComponentToken>;
```

### 3b. Reverse lookups derived from the manifest

The manifest is the canonical source; everything else derives from it:

```typescript
/** Index by cssVar (the most common lookup — used by the resolver and Inspector). */
export const TOKENS_BY_VAR: ReadonlyMap<string, ComponentToken>;

/** Inverted: for a given Tier-2 role, which component tokens consume it.
 *  Used by the Spine UI's "hover a role → highlight what it paints" logic. */
export const TOKENS_BY_ROLE: ReadonlyMap<RoleName, readonly ComponentToken[]>;

/** Inverted: for a given consumer file, which tokens it reads. Used by the
 *  drift gate's per-file validation pass. */
export const TOKENS_BY_CONSUMER: ReadonlyMap<string, readonly ComponentToken[]>;
```

These are built once at module load from the frozen manifest. O(N) construction; subsequent lookups are O(1).

### 3c. Sample entries

A few representative entries to illustrate the shape (real manifest will have ~150 entries after dropping v3 fields nothing reads):

```typescript
export const COMPONENT_TOKENS = [
  // ── Row state cluster ────────────────────────────────────────────────────
  {
    cssVar: "--tv-row-base-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "surface" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "lib/swatches.ts",
    ],
    description: "Default row background fill",
  },
  {
    cssVar: "--tv-row-alt-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "surface-subtle" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
    ],
    modes: { hc: "drop" },   // HC mode drops zebra striping
    description: "Alternating (zebra) row background fill",
  },
  {
    cssVar: "--tv-row-hover-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "fill-hover" },
    consumedBy: [
      "svelte/TabvizPlot.svelte",          // browser-only; SVG export skips
    ],
    description: "Row background on pointer hover",
  },
  {
    cssVar: "--tv-row-emphasis-bg",
    kind: "paint-fill",
    source: { tier: "role", role: "highlight-bg" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "lib/semantic-styling.ts",
    ],
    modes: { hc: "drop", rt: { swap: "fill-hover" } },
    description: "Highlighted row background (paint-tool emphasis token)",
  },
  // ── Spacing ──────────────────────────────────────────────────────────────
  {
    cssVar: "--tv-spacing-cell-padding-x",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },   // density × densityFactor
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "stores/slices/columns.svelte.ts",
      "lib/layout/table-metrics.ts",
    ],
    description: "Horizontal padding inside each cell",
  },
  // ── Header text ──────────────────────────────────────────────────────────
  {
    cssVar: "--tv-header-text-size",
    kind: "font-size",
    source: { tier: "computed", note: "body.size × header.scale" },
    consumedBy: [
      "export/svg-generator.ts",
      "svelte/TabvizPlot.svelte",
      "components/forest/PlotHeader.svelte",
    ],
    description: "Column header text size",
  },
  // ── Plot scaffold ────────────────────────────────────────────────────────
  {
    cssVar: "--tv-plot-tick-mark-length",
    kind: "spacing-px",
    source: { tier: "input", input: "density" },
    consumedBy: [
      "export/svg-generator.ts",
      "components/forest/EffectAxis.svelte",
      "stores/slices/axis.svelte.ts",
    ],
    description: "Length of axis tick marks",
  },
  // ── Series slot ──────────────────────────────────────────────────────────
  {
    cssVar: "--tv-series-1-fill",
    kind: "paint-fill",
    source: { tier: "role", role: "series-1-fill" },
    consumedBy: [
      "export/svg-generator.ts",
      "components/forest/RowInterval.svelte",
    ],
    description: "Primary series fill color (slot 1 of 5)",
  },
  // ── Mark recipe (flag — not a CSS var) ───────────────────────────────────
  {
    cssVar: "--tv-marks-forest-body",
    kind: "shape",   // actually a slot-selector enum, but conceptually shape
    source: { tier: "const", note: "renderer recipe table" },
    consumedBy: [
      "export/svg-generator.ts",
      "components/forest/RowInterval.svelte",
    ],
    description: "Which slot field paints the forest mark's body",
  },
] as const;
```

The full manifest follows the inventory pattern: ~150 entries covering row × cell × header × column-group × row-group × cell × first-column × plot × spacing × text × series × marks × layout × axis × borders.

---

## 4. The drift gate

A single bun test: `srcjs/src/lib/theme/component-tokens.drift.test.ts`. Runs at every PR; promotes from `warn` to `error` in CI.

### 4a. What it enforces

```
For every entry E in COMPONENT_TOKENS:
  For every file F in E.consumedBy:
    The file F (read from srcjs/src/{F}) must contain a reference to E.cssVar.
    (Regex match: /\b{cssVar}\b/ in the file contents.)
    Otherwise → fail: "Token {E.cssVar} declares consumer {F} but {F} doesn't reference it."

For every file F under srcjs/src/{components,svelte,export,stores,lib,schema}:
  For every CSS variable V matching /--tv-[a-z][a-z0-9-]*/ in F:
    Either V is the cssVar of some entry in COMPONENT_TOKENS,
    Or V is in KNOWN_UNCONSUMED (grandfathered).
    Otherwise → fail: "File {F} references undeclared CSS variable {V}."

For every entry E in COMPONENT_TOKENS:
  E.consumedBy must be non-empty (no orphan tokens),
  Or E.cssVar must be in KNOWN_UNCONSUMED (grandfathered).
  Otherwise → fail: "Token {E.cssVar} has no declared consumer."
```

### 4b. `KNOWN_UNCONSUMED` grandfathering

A const allow-list in the same file: `KNOWN_UNCONSUMED: ReadonlySet<string>`. Permits temporary tolerance for:

- Tokens emitted today but no longer read (Stage 1 cleanup target — list shrinks each PR).
- Tokens added speculatively for a feature in flight (rare; should land their consumer in the same PR).

**Rule per CLAUDE.md:** the list can only shrink. A CI guard checks that the list size doesn't grow between commits (the same pattern used by the columns drift gate at `srcjs/src/schema/columns/drift.test.ts`).

### 4c. What the drift gate does NOT enforce

- **Whether the CSS variable's value is correct.** That's the resolver's job, checked by the existing APCA-contrast + ramp tests.
- **Whether the consumer uses the token correctly.** A consumer reading `--tv-row-base-bg` and applying it as a `color` would be wrong but the gate can't tell. Type-checked at consumer-side TS code.
- **Per-mode behavior.** The `modes` field is metadata for the Inspector; resolver tests verify the actual mode transforms.

### 4d. Why this is sufficient

The drift gate catches the two failure modes the v3 surface suffered:

1. **Dead emissions** — variables emitted by the cascade but no longer read by any consumer. Wasted wire, confusing inspectors. Today these exist (e.g. `--tv-cell-padding-y` deprecated but still emitted). Gate forces explicit listing.
2. **Undeclared reads** — variables a consumer reads but the cascade no longer emits. Silent fallback to browser-default (transparent, 0px, etc.). Today these are caught only at visual-regression time; the gate makes them a unit-test failure.

It does *not* catch semantic correctness; that's outside the gate's scope and remains tests' + reviewers' job.

---

## 5. Phase-1 open design questions

### Q-P1.1 — Does the manifest live in TS or in a generated JSON?

**RESOLVED 2026-06-02.** Hand-authored TS const. The manifest *is* the contract; humans write each entry deliberately. Drift gate validates against actual consumer reads. See Decisions log.

### Q-P1.2 — Where does the `RoleName` union live?

**RESOLVED 2026-06-02.** Dedicated `srcjs/src/types/theme-roles.ts`. Centralized vocabulary shared between the resolver, manifest, override schema, R-side, and inspector; avoids circular imports. Pattern matches existing `theme-inputs.ts`. See Decisions log.

### Q-P1.3 — Do role variables (`--tv-role-*`) and ramp variables (`--tv-ramp-*`) appear in the manifest, or only component tokens?

**RESOLVED 2026-06-02.** Tier-3 component tokens only. Ramps and roles are emitted by the resolver and inspectable in DevTools but don't enter the drift-gate contract. Spine UI and Inspector read roles via the resolver's API, not via CSS vars. See Decisions log.

### Q-P1.4 — What's the consumer-path format in `consumedBy`?

**RESOLVED 2026-06-02.** Relative to `srcjs/src/`. Entries look like `"export/svg-generator.ts"`. Drift gate prepends `srcjs/src/` when resolving for fs reads. See Decisions log.

### Q-P1.5 — How are component-token entries ordered in the manifest?

**RESOLVED 2026-06-02.** By cluster with block comments (`// ── Row state ────`, `// ── Header ────`, etc.). Reverse-lookup map `TOKENS_BY_ROLE` handles role-grouping for the Spine UI separately. See Decisions log.

### Q-P1.6 — Backwards compatibility with v3 `--tv-*` names?

**RESOLVED 2026-06-02.** No dual-emit. Rename happens cleanly; consumers migrate inside the long-lived branch; v3 names never reach main. The clean-break commitment (§4c of the rework doc). See Decisions log.

---

## 6. Forward references

Once this doc is approved, Phase 2 covers:

- The `{role, ramp, grade}` override schema TypeScript shape.
- The `theme-wire.ts` rewrite: pins, releases, resolution.
- The R `set_role_binding(role, ramp, grade)` modifier surface and its V8 round-trip.
- How overrides interact with the manifest's `source.tier === "role"` entries.

Phase 3 covers the `data-*` variant attribute namespace and SVG-export `<style>` embedding. Phase 4 covers polarity flip + modes + alpha + curves + preset audit. Phase 5 covers the row-kind height cascade. Phase 6 covers migration mechanics + branch rhythm.

---

## 7. Phase-1 Decisions log

> Append-only. Resolved Phase-1 questions get an entry here; cross-referenced from the parent rework doc's §9.

### 2026-06-02 — Q-P1.1 closed: hand-authored TS const

**Decision:** `COMPONENT_TOKENS` is a hand-authored TS `const` array exported from `srcjs/src/lib/theme/component-tokens.ts`. **Rationale:** the manifest *is* the contract. Humans write each entry deliberately; the drift gate validates it against actual consumer reads. Generated manifests drift silently when the resolver changes its internal shape — the contract would follow the code instead of the code following the contract.

### 2026-06-02 — Q-P1.2 closed: `RoleName` lives in `srcjs/src/types/theme-roles.ts`

**Decision:** the Tier-2 role vocabulary (`RoleName` union, related types like `AnchorName`, `RampName`) lives in a new dedicated module at `srcjs/src/types/theme-roles.ts`. **Rationale:** roles are shared between the resolver, the manifest, the override schema, the R-side classes, and the Cascade Inspector. A dedicated module avoids circular imports (the manifest needs `RoleName`; the resolver emits role values; the override schema references them) and centralizes the vocabulary. Pattern matches the existing `srcjs/src/types/theme-inputs.ts`.

### 2026-06-02 — Q-P1.3 closed: drift gate covers Tier-3 component tokens only

**Decision:** the drift gate validates only `--tv-{cluster}-*` entries against consumer reads. Tier-1 anchors (`--tv-anchor-*`), ramps (`--tv-ramp-*`), and Tier-2 roles (`--tv-role-*`) are emitted by the resolver and inspectable in DevTools but don't enter the drift-gate contract. **Rationale:** consumers read Tier-3 tokens; the gate's purpose is consumer-contract enforcement. The Spine UI and Cascade Inspector read roles via the resolver's typed API, not via CSS vars. Layer-1 and Layer-2 vars exist for DevTools inspection, power-user overrides, and future tooling — drift-gating them would balloon manifest maintenance (~250 entries vs. ~150) for marginal value.

### 2026-06-02 — Q-P1.4 closed: `consumedBy` paths are relative to `srcjs/src/`

**Decision:** entries express consumer paths as e.g. `"export/svg-generator.ts"`, `"svelte/TabvizPlot.svelte"`. Drift gate prepends `srcjs/src/` when resolving for fs reads. **Rationale:** concise; the `srcjs/src/` prefix is implied by the manifest's location at `srcjs/src/lib/theme/component-tokens.ts`. Repeating the prefix on every entry adds noise without clarification.

### 2026-06-02 — Q-P1.5 closed: manifest is ordered by cluster with block comments

**Decision:** entries are grouped by Tier-3 cluster (`Row state`, `Header`, `Cell`, `Column group`, `Row group`, `First column`, `Plot scaffold`, `Spacing`, `Text roles`, `Series slots`, `Marks recipes`, `Layout / Axis / Borders`), with ASCII-rule block comments delimiting each group. Within a cluster, entries are ordered logically (state-set together, then text-properties together, etc.) — not alphabetically. **Rationale:** most human-readable; matches how the inventory and the renderer mental model are organized. The reverse-lookup map `TOKENS_BY_ROLE` handles role-grouping for the Spine UI separately, so manifest order doesn't need to serve that consumer.

### 2026-06-02 — Q-P1.6 closed: no dual-emit; v3 `--tv-*` names disappear at the substrate landing

**Decision:** during the Stage 1 long-lived branch, the cascade emits *only* the v4 `--tv-*` names. No backwards-compatible dual-emit. Consumers migrate to the new names inside the branch; v3 names never reach main. **Rationale:** matches the clean-break commitment (§4c of the rework doc). The long-lived branch IS the migration window — there's no need for a dual-emit window on top of it. Dual-emit would be co-maintenance of v3 and v4 names inside the branch, the exact pattern the clean break rules out.

---

# Phase 2 — override schema, wire rewrite, R modifier

## 8. The override schema

The only thing a user can override is **the binding of a Tier-2 role to a `(ramp, grade)` pair**. Everything else flows from that: changing the role binding changes the role's resolved value, which changes every component token sourced from that role.

### 8a. Why role-level only

Three things a user might think they want to override:

| What they think | What's actually changing | Where it happens |
|---|---|---|
| "Change the alt-row background" | The role `surface-subtle` binding | Override schema (this section) |
| "Use a different brand color" | The `brand` Tier-1 input | Existing input modifier (`set_brand`) |
| "Make this specific token always green" | A *token*-level pin, breaking the role abstraction | **Not supported** — see §8b |

The override schema covers only the first. Tier-1 input changes go through the existing modifier API (`set_brand`, `set_decorative`, `set_categorical`, `set_mode`). Token-level pinning is explicitly rejected.

### 8b. Why no token-level overrides

Token-level pinning (e.g. "force `--tv-row-alt-bg` to `#e0e0e0` regardless of role") would let different consumers of the same role get different paints. That breaks the manifest's contract: the manifest declares `--tv-row-alt-bg` derives from role `surface-subtle`, and the drift gate enforces this — but a token-level override would silently route around the source.

The same concrete need ("I want this token specifically to be different") is better served by:
- **Splitting the role** in the manifest (introduce a new role that paints only this token), or
- **Changing the Tier-1 input** that propagates to the role.

Both routes preserve the cascade's semantic integrity. The override schema stays clean: roles bind to `(ramp, grade)`; nothing else moves.

### 8c. The shape

```typescript
import type { RoleName, RampName } from "../types/theme-roles";

/** A single role binding — a pin from a role to a `(ramp, grade)` pair. */
export type RoleBinding = {
  ramp: RampName;     // "neutral" | "brand" | "accent"
  grade: number;      // 1..11 (1-indexed, matches the CSS-var ramp grades)
};

/** The override schema — partial map of pinned role bindings. Missing roles
 *  use their defaults from `DEFAULT_ROLE_BINDINGS`. */
export type RoleOverrides = Partial<Record<RoleName, RoleBinding>>;
```

The `DEFAULT_ROLE_BINDINGS: Record<RoleName, RoleBinding>` const lives next to the resolver in `srcjs/src/lib/theme/theme-resolve.ts` and is the rgc_v4 `DEFAULT_GRADES` equivalent.

---

## 9. The wire (`theme-wire.ts` rewrite)

### 9a. The wire type

```typescript
import type { ThemeInputs } from "../../types/theme-inputs";

/** The wire: a self-contained, serializable theme. The complete authoring
 *  state lives here. */
export type ThemeWire = {
  $schema: "tabviz-theme/v4";
  inputs: ThemeInputs;
  roleOverrides: RoleOverrides;
};
```

The wire is **immutable**. All mutation functions return a new wire. This is what makes resolver memoization safe (§11b).

The wire is **fully serializable** — it's exactly what gets written to JSON for export, sent over the htmlwidget bridge, or round-tripped through R via V8. No closures, no class instances.

### 9b. The wire API

```typescript
/** Create a wire from inputs alone; no overrides. */
export function createWire(inputs: ThemeInputs): ThemeWire;

/** Pin a role to a (ramp, grade) pair. Returns a new wire. */
export function setRoleBinding(
  wire: ThemeWire,
  role: RoleName,
  ramp: RampName,
  grade: number,
): ThemeWire;

/** Friendly token-name lookup: pin by the more familiar component-token name,
 *  not the underlying role. Looks up the token in COMPONENT_TOKENS, finds its
 *  source role, and pins that role. Throws on non-role-sourced tokens (see
 *  §9c for error cases). */
export function pinTokenByName(
  wire: ThemeWire,
  tokenName: string,           // e.g. "row-alt-bg" or "--tv-row-alt-bg" (both accepted)
  ramp: RampName,
  grade: number,
): ThemeWire;

/** Remove a role's override, falling back to its default binding. */
export function releaseRole(wire: ThemeWire, role: RoleName): ThemeWire;

/** Remove all role overrides at once. */
export function releaseAllRoles(wire: ThemeWire): ThemeWire;

/** Is this role currently pinned (overridden)? */
export function isRolePinned(wire: ThemeWire, role: RoleName): boolean;

/** Get the current binding for a role — override if pinned, default otherwise. */
export function getRoleBinding(wire: ThemeWire, role: RoleName): RoleBinding;

/** Tier-1 input convenience setters (existing modifier API stays). */
export function setBrand(wire: ThemeWire, hex: string): ThemeWire;
export function setDecorative(wire: ThemeWire, hex: string | null): ThemeWire;
// ... etc., one per Tier-1 input
```

All mutators are pure functions returning new wires. The convenience setters for Tier-1 inputs (existing v3 modifier names) stay — they're the public ergonomic surface.

### 9c. `pinTokenByName` — error cases for non-role sources

The friendly lookup `pinTokenByName(wire, "row-alt-bg", "neutral", 2)` works by finding the token in `COMPONENT_TOKENS` and pinning its `source.role`. But not every token has a role source. The function handles each `source.tier` case:

| `source.tier` | Behavior |
|---|---|
| `"role"` | Look up `source.role`, call `setRoleBinding(wire, source.role, ramp, grade)`. ✓ Common case. |
| `"input"` | Throw `TokenNotPinnableError`: "Token `{name}` derives from input `{source.input}`; use the input modifier (e.g. `setBrand`) instead." |
| `"anchor"` | Throw `TokenNotPinnableError`: "Token `{name}` derives from anchor `{source.anchor}`; modify the anchor via inputs." |
| `"computed"` | Throw `TokenNotPinnableError`: "Token `{name}` is computed (`{source.note}`); not pinnable. Change the source roles instead." |
| `"const"` | Throw `TokenNotPinnableError`: "Token `{name}` is a hard-coded constant; not pinnable." |
| (unknown token) | Throw `UnknownTokenError`: "Token `{name}` is not in COMPONENT_TOKENS." |

The errors are explicit and actionable. The function accepts both `"row-alt-bg"` and `"--tv-row-alt-bg"` as inputs (auto-normalizes by stripping the `--tv-` prefix). R-side mirror function (`pin_token_by_name`) gets the same error surface via `cli::cli_abort`.

---

## 10. The resolver pipeline

### 10a. `ResolvedTheme` shape

```typescript
import type { ThemeWire, RoleBinding, RoleOverrides } from "./theme-wire";
import type { RoleName } from "../../types/theme-roles";

/** Per-ramp 11-step color array (OKLCH strings). */
export type Ramp = readonly string[];   // length 11; index 0 = grade 1

/** What the resolver produces from a wire. The CSS-var map is the public
 *  consumer interface; everything else is internal/inspector-facing. */
export type ResolvedTheme = {
  /** Echo of the inputs that produced this resolution. */
  inputs: ThemeInputs;
  /** Tier-1 ramps + alpha companions. Exposed for Spine UI and Inspector. */
  ramps: {
    neutral: Ramp;
    brand: Ramp;
    accent: Ramp;
    neutralAlpha: Ramp;
    brandAlpha: Ramp;
  };
  /** Tier-2 role values (resolved hex/oklch strings) keyed by role name. */
  roles: Record<RoleName, string>;
  /** Provenance: what `(ramp, grade)` each role resolved through. Default OR
   *  override. Used by the Cascade Inspector to walk the cascade. */
  roleSource: Record<RoleName, RoleBinding>;
  /** The wire — the consumer interface. Every key is a CSS-var name. */
  cssVars: Readonly<Record<string, string>>;
};
```

### 10b. The pipeline

```
ThemeWire
  → buildRamps(inputs)                         (Tier 0 → Tier 1)
  → resolveRoles(ramps, defaultBindings, wire.roleOverrides, mode-transforms)
                                               (Tier 1 → Tier 2)
  → emitCssVars(COMPONENT_TOKENS, roles, ramps, inputs)
                                               (Tier 2 → Tier 3 wire)
  → ResolvedTheme
```

`resolveRoles` is the single point where overrides apply. It:
1. Walks every role in the `RoleName` union.
2. Looks up its binding: `wire.roleOverrides[role] ?? DEFAULT_ROLE_BINDINGS[role]`.
3. Resolves the binding to a color: `ramps[binding.ramp][binding.grade - 1]`.
4. Applies any mode-transforms (HC pushes border grades up; RT swaps alpha→solid). [Phase 4 detail.]
5. Returns the `(roles, roleSource)` pair.

`emitCssVars` walks `COMPONENT_TOKENS` and for each entry:
1. Looks at `source.tier`:
   - `"role"` → look up `roles[source.role]`.
   - `"input"` → look up `inputs[source.input]`.
   - `"anchor"` → look up the relevant anchor in the OKLCH input map.
   - `"computed"` → call the per-token resolver function (e.g. `header.size = body.size × header.scale`).
   - `"const"` → return the hard-coded value.
2. Applies `modes` behavior if active (HC drop → `"transparent"`; HC swap → look up the swap role).
3. Writes `cssVars[entry.cssVar] = resolved_value`.

The CSS-var map IS the consumer interface. No other surface escapes the resolver.

### 10c. Where this lives

- `srcjs/src/lib/theme/theme-resolve.ts` — `buildRamps`, `resolveRoles`, `DEFAULT_ROLE_BINDINGS`, mode-transform functions.
- `srcjs/src/lib/theme/theme-css.ts` — `emitCssVars`, the manifest walker.
- `srcjs/src/lib/theme/theme-wire.ts` — wire type + API.
- `srcjs/src/lib/theme/theme-adapter.ts` — **deleted**. The v3 cluster-shape intermediate is gone; manifest walking replaces it.

### 10d. Resolver entry point

```typescript
/** One-shot resolve: wire in, ResolvedTheme out. Memoized by wire identity
 *  (§11b). */
export function resolveTheme(wire: ThemeWire): ResolvedTheme;
```

This is the function consumers (and SVG-export, and R via V8) call. Single entry point; everything else is internal to the theme module.

---

## 11. Resolver caching

### 11a. The cost

A full resolve is small in absolute terms but not free:
- Build ramps: ~33 OKLCH triples computed via cube-root interpolation (~1ms).
- Resolve roles: ~30 lookups + mode transforms (~0.1ms).
- Emit CSS vars: ~150 manifest walks + per-token computations (~0.5ms).

Total: low-single-digit-ms per call. Negligible for one-off paints, but called every animation frame during paint-tool drags, settings-panel slider scrubs, or column-resize previews.

### 11b. Memoization by wire identity

The wire is immutable; the resolver is a pure function of the wire. **Memoize the resolver result by referential equality of the wire object.**

```typescript
let lastWire: ThemeWire | null = null;
let lastResolved: ResolvedTheme | null = null;

export function resolveTheme(wire: ThemeWire): ResolvedTheme {
  if (wire === lastWire && lastResolved) return lastResolved;
  const resolved = doResolve(wire);
  lastWire = wire;
  lastResolved = resolved;
  return resolved;
}
```

Single-slot cache. The wire only changes when a user action mutates it (slider drag, paint-tool token application) — and at those moments, the *new* wire is passed in and a fresh resolve runs. Between those moments, every render call reuses the cached resolve.

A two-slot cache (or LRU) is overkill: typical theme-edit flow is "drag, drag, drag, drag" with one wire identity per frame; previous wires aren't recalled.

### 11c. Cache invalidation

Trivially correct because the wire is immutable. There's no scenario where the same wire object identity should resolve to different values.

---

## 12. R modifier API

The R modifier API is the user-facing R surface. It mirrors the wire API with `set_*` / `release_*` verbs, kept terse but R-idiomatic.

### 12a. The modifiers

R signature convention: `theme` is the first positional argument (pipe-friendly); subsequent arguments are positional, with named usage available where helpful. Examples below use positional style for terseness.

```r
# Pin a role to a (ramp, grade) pair.
set_role_binding(theme, "surface-subtle", "neutral", 2)

# Friendly token-name lookup — pin a role by its more familiar component-token
# name. Resolves the source role internally; errors if the token doesn't
# derive from a role (see §9c for error cases).
pin_token_by_name(theme, "row-alt-bg", "neutral", 2)

# Release one role's override.
release_role(theme, "surface-subtle")

# Release all role overrides at once.
release_all_roles(theme)

# Tier-1 input modifiers (existing API stays; the names below already ship in v3).
set_brand(theme, "#3366CC")
set_decorative(theme, "#CC6633")
set_mode(theme, "dark")
set_categorical(theme, palette = "okabe_ito")
```

All modifiers take `theme` as first argument (pipe-friendly) and return a modified `theme` (the R-side wire wrapper). Named arguments for everything past the first positional — matches `set_brand` etc.

### 12b. The R wire wrapper

`R/classes-theme.R` is slimmed to just the Tier-1 input class (`ThemeInputs` S7) plus a thin wrapper for the wire:

```r
new_theme <- S7::new_class(
  "theme",
  properties = list(
    inputs        = S7::class_list,   # ThemeInputs
    role_overrides = S7::class_list   # named list, role → list(ramp = ..., grade = ...)
  )
)
```

That's it. No `WebTheme`, `Surfaces`, `Content`, `Dividers`, `RowCluster`, etc. The S7 surface mirrors the wire JSON exactly — nothing more.

### 12c. V8 round-trip

The wire serializes to JSON identically in TS and R; V8 returns the resolved CSS-var map for SVG export. R-side resolve is V8-only.

```r
# R-side resolve (in V8)
resolved <- ts_call("resolveTheme", as.list(theme))   # returns ResolvedTheme JSON

# Pull just the CSS-var map for SVG export
css_vars <- resolved$cssVars
```

R consumers never read the resolved object's `roles` or `ramps` — those are inspector-facing. The CSS-var map is the only surface R touches.

### 12d. Validation

Modifier inputs validated with `checkmate`, matching existing pattern:

```r
set_role_binding <- function(theme, role, ramp, grade) {
  checkmate::assert_choice(role, VALID_ROLE_NAMES)
  checkmate::assert_choice(ramp, c("neutral", "brand", "accent"))
  checkmate::assert_integerish(grade, lower = 1, upper = 11, len = 1)
  # ... return new theme with the override applied
}
```

`VALID_ROLE_NAMES` is a hard-coded literal vector in `R/themes-api.R`. An R↔TS parity test (`test-parity-role-names.R`) verifies the R list matches the TS `RoleName` union via V8 and fails the test suite on drift. Matches the established R↔TS parity-test pattern.

### 12e. Discovery and inspection helpers

Four small R helpers ship in Stage 1, each falling out of the manifest + resolver almost for free. Together they solve the discoverability friction surfaced by the design scenarios (the user's "what tokens exist, what do they do, why is this color, did my change actually do anything") without waiting for the Stage 3 editor.

```r
# Print the manifest — every Tier-3 component token, its source role, current
# binding, and a one-line description. Filterable by cluster or role.
list_component_tokens(theme, cluster = NULL, role = NULL)

# Walk the cascade trace for one token: Tier 3 → Tier 2 → Tier 1 → resolved.
inspect_token(theme, "row-alt-bg")
# Token --tv-row-alt-bg (paint-fill)
#   Tier 3: aliases --tv-role-surface-subtle
#   Tier 2 role: surface-subtle
#     Bound to: neutral.2 (default — not overridden)
#     Mode behavior: hc → drop
#   Tier 1 ramp: neutral[2] = oklch(0.97 0.005 250)
#   Resolved: oklch(0.97 0.005 250)
# Consumed by:
#   - export/svg-generator.ts
#   - svelte/TabvizPlot.svelte

# Programmable APCA contrast assertions over the resolved theme. Returns a
# structured object with one entry per checked pair; `$all_pass` is the gate.
contrast_report(theme, mode = "standard")
# Useful for IRB / accessibility audits, and for CI gates:
stopifnot(contrast_report(theme)$all_pass)

# Structured diff between two themes — inputs, role bindings, and resolved
# CSS-var values. Useful for visual-regression debugging and PR review.
diff_themes(theme_before, theme_after)
# Returns: list(inputs = ..., role_bindings = ..., resolved_diff = ..., unchanged_count = N)
```

These are user-facing R surfaces; the equivalents are also exposed JS-side via the wire API (`listComponentTokens`, `inspectToken`, `contrastReport`, `diffThemes`) for parity. The Cascade Inspector (Stage 3) consumes the same underlying logic via the resolver's `roleSource` map.

**Why these and not others?** Each maps to a concrete user need surfaced by the scenarios in conversation: discoverability of the manifest surface (`list_*`), explaining a specific color (`inspect_*`), accessibility audit (`contrast_*`), regression debugging (`diff_*`). None of them require additional theme-side architecture; all consume what the resolver already produces. The cost is ~3–4 days of R wrapping work; the benefit is that ordinary R users have a complete inspection toolkit on day one of Stage 1's landing.

---

## 13. Phase-2 open design questions

### Q-P2.1 — Role-level vs token-level override granularity

**RESOLVED 2026-06-02.** Role-level only. Token-level pinning would silently route around the manifest's `source` declarations and break the cascade's semantic integrity. Need-to-paint-this-one-thing-differently is solved by splitting the role in the manifest (a manifest change) or by changing the Tier-1 input. See Decisions log.

### Q-P2.2 — Ship friendly token-name lookup API in Stage 1, or wait for Stage 3?

**RESOLVED 2026-06-02.** Stage 1 ships both `setRoleBinding(role, ramp, grade)` AND the friendly `pinTokenByName(tokenName, ramp, grade)` lookup. The friendly API internally finds the token's source role via `COMPONENT_TOKENS` and pins it; throws explicit errors for tokens that aren't role-sourced (see §9c). R-side mirror: `pin_token_by_name(theme, token, ramp, grade)`. See Decisions log.

### Q-P2.3 — Per-mode user overrides (HC-specific bindings)?

**RESOLVED 2026-06-02.** No per-mode user overrides. Mode behavior is encoded in the manifest's `modes` field; users override role bindings globally; modes apply uniformly across the override. Override surface stays simple. HC-specific needs that exceed the manifest's `modes` vocabulary become manifest changes, not user-surface complexity. See Decisions log.

### Q-P2.4 — Resolver caching strategy

**RESOLVED 2026-06-02.** Single-slot memoization by wire identity. The wire is immutable; the resolver is pure; cached result returned if wire is referentially equal to the last call. Covers paint-tool drag (one wire identity per frame). See Decisions log.

### Q-P2.5 — R modifier argument style: named vs positional

**RESOLVED 2026-06-02.** Positional allowed. R always supports both, but examples and docs use positional style for terseness: `set_role_binding(theme, "surface-subtle", "neutral", 2)`. Named args remain available where they aid clarity. See Decisions log.

### Q-P2.6 — `release_all_roles()` utility?

**RESOLVED 2026-06-02.** Ship it. One exported symbol; clean alternative to `Reduce()` over role names. Useful for "reset to preset defaults" in interactive contexts and for tests. See Decisions log.

### Q-P2.7 — Where does `VALID_ROLE_NAMES` come from?

**RESOLVED 2026-06-02.** Hard-coded literal vector in `R/themes-api.R`; R↔TS parity test (`test-parity-role-names.R`) verifies it matches the TS `RoleName` union via V8. Drift caught at test time. Matches existing R↔TS parity pattern. See Decisions log.

### Q-P2.8 — Ship the four discovery/inspection R helpers in Stage 1?

**RESOLVED 2026-06-02.** Ship all four: `list_component_tokens`, `inspect_token`, `contrast_report`, `diff_themes`. Each falls out of the manifest + resolver almost for free; together they solve the discoverability friction surfaced by the design scenarios without waiting for Stage 3. JS-side equivalents (`listComponentTokens`, `inspectToken`, etc.) ship in parallel for parity. See Decisions log.

---

## 14. Phase-2 Decisions log

> Populated as Phase-2 questions are resolved.

### 2026-06-02 — Q-P2.1 closed: role-level overrides only; no token-level pinning

**Decision:** the override schema covers only Tier-2 role bindings: `(role, ramp, grade)`. Token-level pinning (overriding a specific component token to bypass its source role) is explicitly rejected. **Rationale:** the manifest declares every Tier-3 token's source; the drift gate enforces this. A token-level pin would silently route around the source declaration, contradicting the manifest's contract. The same concrete need ("I want this token to be different from its role-siblings") is better served by splitting the role in the manifest (introduce a new role that paints only this token) or by changing the Tier-1 input. Cascade integrity > granular control.

### 2026-06-02 — Q-P2.2 closed: Stage 1 ships both `setRoleBinding` and `pinTokenByName`

**Decision:** Stage 1's user-facing override surface includes both the role-level `setRoleBinding(wire, role, ramp, grade)` and the friendly token-name lookup `pinTokenByName(wire, tokenName, ramp, grade)`. The friendly API finds the token in `COMPONENT_TOKENS`, identifies its `source.role`, and pins that role. R-side mirror: `pin_token_by_name(theme, token, ramp, grade)`. Non-role-sourced tokens (computed, anchor, input, const) throw explicit `TokenNotPinnableError` with actionable messages directing the user to the right modifier (e.g. "use `setBrand` instead"). **Rationale:** the friendly API is small additional surface (a single function + error class) and lets ordinary users author overrides in their natural vocabulary (component-token names like `row-alt-bg`) without waiting for Stage 3 editor work. The error surface keeps the abstraction honest: the function isn't a panacea for arbitrary token mutation — it's a convenience shortcut for the common case (role-derived tokens).

### 2026-06-02 — Q-P2.3 closed: no per-mode user overrides

**Decision:** the override schema is `Partial<Record<RoleName, RoleBinding>>` — one binding per role, applied uniformly across all modes. There is no `{role, mode, ramp, grade}` override. **Rationale:** modes (HC, RT) are resolver transforms encoded in the manifest's `modes` field (e.g. HC drops zebra row-alt-bg; RT swaps alpha washes for opaque tints). They are *behaviors of the cascade*, not user-customizable preferences. Allowing per-mode overrides would multiply the override schema's dimensionality and let users contradict the manifest's mode rules in confusing ways. If a real need emerges that exceeds the manifest's mode-behavior vocabulary, the right fix is to extend the manifest's `ModeBehavior` type, not to layer user complexity on top.

### 2026-06-02 — Q-P2.4 closed: single-slot wire-identity memoization

**Decision:** `resolveTheme(wire)` memoizes its result by referential equality of the wire object. Single-slot cache: if `wire === lastWire`, return `lastResolved`; otherwise resolve fresh and update the cache. **Rationale:** the wire is immutable; the resolver is a pure function of the wire. Identity equality is correct because the wire only changes when a user action mutates it (slider drag, paint-tool token application), and at those moments a new wire is constructed. Between mutations, every render call shares the same wire identity and reuses the cached resolve. Single-slot is enough because the typical edit flow is "drag, drag, drag" with one wire identity per frame; previous wires aren't recalled. LRU is unjustified complexity until a use case demands it.

### 2026-06-02 — Q-P2.5 closed: positional R modifier args allowed; examples use positional

**Decision:** R modifier signatures expose positional arguments past the `theme` first arg. Examples in docs and gallery use positional style for terseness — `set_role_binding(theme, "surface-subtle", "neutral", 2)` rather than `set_role_binding(theme, role = "surface-subtle", ramp = "neutral", grade = 2)`. Named usage remains valid in R as always. **Rationale:** the role/ramp/grade argument order is unambiguous in context. Verbose named-arg style adds character count without clarifying anything for users who read the function docs. Power users (the primary audience for these modifiers) prefer terseness; ordinary users go through the friendly `pin_token_by_name` lookup or the Stage 3 settings panel anyway.

### 2026-06-02 — Q-P2.6 closed: ship `release_all_roles(theme)` utility

**Decision:** export `release_all_roles(theme)` as a one-liner that returns a wire with empty `roleOverrides`. **Rationale:** the verbose alternative (`Reduce(\(t, r) release_role(t, r), names(theme@role_overrides), init = theme)`) is genuinely awkward and would surface in every "reset" code path. One exported symbol + docstring is cheap; the ergonomic improvement is non-trivial for both interactive contexts ("undo all my customizations") and tests ("start from a clean theme baseline").

### 2026-06-02 — Q-P2.7 closed: `VALID_ROLE_NAMES` hard-coded + R↔TS parity test

**Decision:** `VALID_ROLE_NAMES` is a literal `c(...)` vector in `R/themes-api.R`. A parity test (`tests/testthat/test-parity-role-names.R`) calls into V8, retrieves the TS `RoleName` union members, and asserts the R list matches exactly. **Rationale:** the role vocabulary changes rarely (mostly only when extending the cascade); a build-time generator's complexity isn't justified by the drift-prevention benefit a test-time check delivers equally well. Matches the established R↔TS parity-test pattern (`test-parity-columns.R`, `test-parity-themes.R`) so future agents know where to look.

### 2026-06-02 — Q-P2.8 closed: ship four discovery/inspection R helpers in Stage 1

**Decision:** Stage 1 ships `list_component_tokens`, `inspect_token`, `contrast_report`, and `diff_themes` as R helpers, with JS-side equivalents in parallel. **Rationale:** the design scenarios surfaced concrete user needs each helper addresses — discoverability of the manifest surface (`list_component_tokens`), explaining a resolved color (`inspect_token`), accessibility / IRB audits (`contrast_report`), visual-regression debugging and PR review (`diff_themes`). Each is a small wrapper over the resolver + manifest (~3–4 days total work); none requires additional theme-side architecture. Shipping all four on day one of Stage 1's landing means ordinary R users have a complete inspection toolkit without waiting for the Stage 3 editor. The four helpers' presence in Stage 1 also forces the manifest's `description` field and the resolver's `roleSource` provenance map to be load-bearing from the start, which keeps Stage 3's Cascade Inspector cheap.

---

# Phase 3 — `data-*` variants, scope ownership, SVG embedding

## 15. The variant model

Paint-state variants — the categorical choices a theme makes (which header style, which rules mode, which density preset, which color mode) — are not expressed as JS-object reads. They're expressed as `data-*` attributes on a **scope element** that the renderer stamps, with CSS attribute selectors driving the painting.

This is the rgc_v4 pattern (`[data-head-style="fill"] .colhead { ... }`). It collapses what was JS-side branching (in v3, the renderer reads `theme.variants.headerStyle`, then conditionally applies CSS classes or inline styles) into pure CSS resolution. Renderer ships the same DOM/SVG nodes for every variant; CSS does the conditional work.

### 15a. Why `data-*` instead of CSS classes

Two equivalent-looking mechanisms:
- `data-mode="high-contrast"` + `[data-mode="high-contrast"] .row { ... }`
- `class="mode-high-contrast"` + `.mode-high-contrast .row { ... }`

We use `data-*`. Reasons:
1. **Self-documenting.** `data-mode="high-contrast"` reads as a key-value pair; a class `mode-high-contrast` looks the same as any other class and the dimensionality is implicit.
2. **Discoverable in DevTools.** Inspecting the scope element shows all active variants at a glance under the element's attribute table — no class-name parsing.
3. **Multi-valued cleanly.** `data-rules="grid"` is a single source of truth; `class="rules-grid"` mixes into the same string with everything else.
4. **Stable selector targets.** Variant CSS selectors are unambiguous (`[data-rules="grid"]`), not subject to class-collision with utility/state classes.
5. **rgc_v4 precedent + librsvg support.** Attribute selectors work in browser CSS and in librsvg's CSS-in-SVG since ~2.50.

### 15b. The scope element

The renderer has **one scope element** that owns all scope-level data-* attributes and bears the inline CSS-var map. In browser DOM: the outermost `<div class="tabviz-scope">` of `TabvizPlot.svelte`. In SVG export: the top-level `<g class="tabviz-scope">` inside the `<svg>` root.

The scope element's role:
- Carries `data-*` attributes (one per scope-level variant — see §15c).
- Carries the inline `style` attribute with the CSS-var map (`style="--tv-row-base-bg: ...; --tv-cell-fg: ...; ..."`).
- Acts as the CSS-selector ancestor for all per-variant rules.
- In SVG export, the embedded `<style>` block is the sibling of this `<g>` (under `<svg>`), and its selectors all start with `.tabviz-scope[data-*]` so they only match this scope.

**One scope per widget.** Multiple tabviz widgets on a page each have their own `.tabviz-scope`. No global theme leakage; no inheritance from arbitrary ancestors.

### 15c. Scope-level `data-*` attributes (complete taxonomy)

These attributes are stamped on the scope element by the renderer, derived from the theme inputs + resolver outputs. The set is closed (drift-gated by Phase 4's manifest extension — see §20):

| Attribute | Values | Source | Notes |
|---|---|---|---|
| `data-mode` | `standard` \| `high-contrast` \| `reduced-transparency` | `inputs.mode` (extended in Phase 4) | The current rendering mode; drives HC/RT CSS overrides. |
| `data-polarity` | `light` \| `dark` | Resolver: `inputs.anchors.paper.L < 0.5 ? "dark" : "light"` | Computed, not user-set. Lets CSS rules adapt to dark themes without inspecting anchor values. |
| `data-head-style` | `light` \| `tint` \| `fill` | `inputs.head_style` (new Tier-1 input) | Column-header presentation. |
| `data-title-style` | `normal` \| `bar` \| `underline` | `inputs.title_style` (new Tier-1 input) | Caption/title presentation. |
| `data-rules` | `horizontal` \| `vertical` \| `grid` \| `none` | `inputs.rules` (new Tier-1 input) | Interior divider topology. |
| `data-frame` | `on` \| `off` | `inputs.frame` (new Tier-1 input) | Outer container frame visibility. |
| `data-density` | `compact` \| `cozy` \| `comfortable` \| `spacious` | `inputs.density` | Spacing-token preset (multiplied by continuous `densityFactor`). |
| `data-banding` | `none` \| `row` \| `group` \| `group-N` (N ∈ 1..5) | `inputs.banding_mode` | Alternating-background mode. `group-N` selects nesting depth. |
| `data-first-col-style` | `default` \| `bold` | `inputs.first_col_style` (new Tier-1 input) | First-column emphasis treatment. |
| `data-shell-mode` | `flush` \| `raised` \| `float` \| `transparent` | `inputs.shell_mode` (Phase 4 / Stage 2 — added when shell/paper two-surface lands) | Chrome elevation; Phase 4 work but reserve the attribute now. |

**Kebab-case values throughout.** Consistent with `RowKind` rename (Q9 closure) and with HTML's attribute-value convention. No camelCase, no underscores.

**The set is closed.** Renderer adds no other scope-level data-* attributes. New variants require manifest extension + renderer change + drift-gate update (Phase 4 work; see §20).

### 15d. Why some of these are new Tier-1 inputs

The taxonomy above introduces several inputs that don't exist in v3 (`head_style`, `title_style`, `rules`, `frame`, `first_col_style`). In v3 these were `theme.variants.*` fields on the Tier-3 resolved theme — set at construction, read by the renderer, branched on in code. In v4 they're Tier-1 inputs (authored by user, on the wire) and the renderer translates them to `data-*` attributes on the scope.

The shift makes sense because: these *are* user choices, not derived values. They belong in the input vocabulary alongside `brand`, `mode`, `fonts`. R modifiers expose them (`set_head_style("fill")`, `set_rules("grid")`, etc.).

---

## 16. Element-level `data-*` attributes

Beyond the scope, two element-level attributes get stamped per-row and per-column:

### 16a. `data-row-kind` (per row)

Every rendered row element carries `data-row-kind="<kind>"` where `<kind>` is one of:

`data` | `group-header` | `section-header` | `summary` | `spacer` | `panel` | `header`

This is the kebab-cased `RowKind` enum (Q9 closure). Stamped by the renderer (both DOM and SVG paths) on the row's container element (`<tr>` in DOM, `<g class="row">` in SVG).

CSS rules target this for kind-specific paint:
```css
.tabviz-scope tr[data-row-kind="summary"] {
  background: var(--tv-row-summary-bg);
  font-weight: 600;
}
.tabviz-scope tr[data-row-kind="group-header"] {
  background: var(--tv-row-group-1-bg);
  /* group-header-specific paint */
}
```

(Or the equivalent SVG selectors — `g[data-row-kind="summary"] .row-bg-rect { fill: var(--tv-row-summary-bg); }`.)

The per-row appearance model — `row_kinds.<kind>.heightRatio` and future paint fields per kind — feeds tokens like `--tv-row-summary-bg`, which are consumed via the `data-row-kind` selector.

### 16b. `data-row-token` (per row, optional)

The paint-tool emphasis-token system gets one element-level attribute: `data-row-token` on the row, with values:

`none` (default, absent) | `emphasis` | `muted` | `accent` | `bold` | `fill`

When present, CSS rules paint the row with the corresponding token surface:
```css
.tabviz-scope tr[data-row-token="emphasis"] {
  background: var(--tv-row-emphasis-bg);
  color: var(--tv-row-emphasis-fg);
  /* etc. */
}
```

This is per-row data (the paint tool writes it; the cascade provides the painting). Two surfaces, cleanly separated — same as in v3 but via `data-*` instead of CSS class manipulation.

### 16c. `data-col-id` and `data-header-id` (already in v3)

These already exist in v3 for interaction targeting (column resize, header editing). No changes; included here for completeness so the full data-* surface is documented in one place.

---

## 17. CSS organization + source-of-truth

### 17a. The runtime CSS surface

Stage 1 ships a single canonical CSS stylesheet that both browser and SVG export consume: `srcjs/src/lib/theme/theme-runtime.css` (or `.css.ts` — to be decided in Q-P3.5).

The rules are organized by cluster, matching the manifest order:
- `/* ── Scope + reset ── */`
- `/* ── Row state ── */`
- `/* ── Header ── */`
- `/* ── Column group ── */`
- `/* ── Row group ── */`
- `/* ── Cell ── */`
- `/* ── First column ── */`
- `/* ── Plot scaffold ── */`
- `/* ── Spacing / layout ── */`
- `/* ── Mode overrides (HC, RT) ── */`
- `/* ── Variant overrides (head-style, rules, frame, etc.) ── */`

Every rule starts with `.tabviz-scope` (or `.tabviz-scope[data-...]`) so the rules are scoped and can't leak into a host page.

Variable references use `var(--tv-...)` exclusively — no hard-coded colors, no per-rule literals. The cascade owns all values.

### 17b. What lives in component `<style>` blocks vs the runtime CSS

A Svelte component's `<style>` block is scoped to that component (Svelte adds hashing). For the v4 substrate:
- **Component `<style>` blocks** hold *layout-only* CSS for that component — grid templates, flex direction, sizing rules that aren't variant-driven.
- **Runtime CSS** (`theme-runtime.css`) holds *theme-driven* paint rules — anything that references `var(--tv-...)` or uses `[data-*]` selectors.

This split keeps theme rules in one place (the file the SVG export reads from) and component rules in their component. A Svelte component's runtime style imports/inherits `theme-runtime.css` via the root stylesheet; the SVG export reads the same file at build time.

### 17c. Browser-only rules — flagged for SVG omission

Some rules are browser-only and don't translate to SVG:
- `:hover`, `:focus-visible`, `:active` pseudo-classes
- Transitions and animations
- `backdrop-filter`, certain `filter` effects
- `::before`/`::after` pseudo-elements

These are kept in their own clearly-marked block at the bottom of `theme-runtime.css`:

```css
/* ── Browser-only (omitted from SVG export) ── */
/* sv-omit-begin */
.tabviz-scope tr:hover { background: var(--tv-row-hover-bg); }
.tabviz-scope tr { transition: background .14s ease; }
/* ... etc */
/* sv-omit-end */
```

The build-time SVG-CSS extractor strips everything between `/* sv-omit-begin */` and `/* sv-omit-end */` comment markers. Anything else passes through verbatim. Simple, mechanical, no AST parsing needed.

### 17d. Theme-runtime.css as canonical artifact

The file `theme-runtime.css` is **the single source of truth** for theme paint rules. It's:
- Imported by Svelte components (via the build).
- Read at SVG-export time (V8-side) and inlined as a `<style>` block in the exported SVG (with browser-only sections stripped).
- Reviewable in PRs as plain CSS.
- Searchable: "which rules consume `--tv-row-alt-bg`?" → grep one file.

No multiple-CSS-files concatenation; no per-cluster files; no embedded CSS strings in TS code. One file, deterministic, source-controlled.

---

## 18. SVG-export `<style>` embedding mechanics

### 18a. The embedded SVG anatomy

The exported SVG looks like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="..." height="..." viewBox="...">
  <style>
    /* Contents of theme-runtime.css with /* sv-omit-* */ blocks stripped */
    .tabviz-scope { ... }
    .tabviz-scope tr[data-row-kind="summary"] { background: var(--tv-row-summary-bg); ... }
    .tabviz-scope[data-mode="high-contrast"] tr[data-row-kind="data"]:has([data-row-token="emphasis"]) { ... }
    /* ... etc */
  </style>
  <g class="tabviz-scope"
     data-mode="standard"
     data-polarity="light"
     data-head-style="light"
     data-title-style="normal"
     data-rules="horizontal"
     data-frame="on"
     data-density="comfortable"
     data-banding="group"
     data-first-col-style="default"
     style="--tv-row-base-bg: oklch(0.99 0.005 250);
            --tv-row-alt-bg: oklch(0.97 0.005 250);
            --tv-cell-fg: oklch(0.18 0.01 250);
            /* ... ~150 CSS variables */">

    <!-- Rows -->
    <g class="row" data-row-kind="data">
      <rect class="row-bg-rect" width="..." height="..." fill="var(--tv-row-base-bg)"/>
      <text class="cell" fill="var(--tv-cell-fg)">...</text>
      <!-- etc -->
    </g>
    <g class="row" data-row-kind="summary" data-row-token="emphasis">
      <rect class="row-bg-rect" width="..." height="..." fill="var(--tv-row-summary-bg)"/>
      <!-- etc -->
    </g>
    <!-- ... more rows, marks, axis, etc. -->

  </g>
</svg>
```

Three load-bearing pieces:
1. **`<style>` block at the top** with the cluster CSS rules.
2. **Scope `<g>` with `data-*` attributes** matching the runtime.
3. **Scope `<g>`'s inline `style` with CSS variables** matching the runtime resolved values.

Each SVG element that needs paint references the variables via `fill="var(--tv-...)"`, `stroke="var(--tv-...)"`, etc. — librsvg resolves these at render time.

### 18b. Why the variables live on the scope's `style` attribute

Two places we could put the CSS-var declarations:
- (a) Inside the `<style>` block as `.tabviz-scope { --tv-...: ...; --tv-...: ...; }`
- (b) Inline on the scope `<g>`'s `style="..."`

We use (b). Reasons:
- The `<style>` block is mostly *rules* (selector → declarations); the variable values are *data*. Keeping them separate is honest.
- Multiple themed scopes in a single SVG (rare but possible — e.g. a split-by view) each carry their own values without `<style>`-block duplication.
- Editing a tweaked SVG by hand is easier when the values are visible on the scope element, not buried in a stylesheet.

The `<style>` block stays small (rules only); the scope's `style` attribute carries the resolved data.

### 18c. How `theme-runtime.css` reaches the export pipeline

The V8-side `svg-generator.ts` needs the file's contents at export time. Three options:
- **(a) Bundle the file as a TS string at build time** (e.g. `import css from "./theme-runtime.css?raw"`). Build emits the string into the TS module; V8 inlines it directly.
- **(b) Read the file from disk at export time** (V8 calls back to R/Node fs). Adds a runtime dependency on the file's presence.
- **(c) Re-author the CSS as a TS string in code** (manual sync between authoring CSS and exported CSS). Drift-prone.

Recommendation: (a). Build-time string bundling — one source of truth, no runtime fs dependency, no drift. The Stage 1 substrate sprint adds a CSS-bundling step to the Vite/build pipeline.

### 18d. The SVG-CSS extractor

A small build step strips browser-only rules from `theme-runtime.css` and produces `theme-runtime.svg.css` — the SVG-safe subset:

```typescript
function extractSvgCss(source: string): string {
  // Strip everything between /* sv-omit-begin */ and /* sv-omit-end */
  return source.replace(/\/\*\s*sv-omit-begin\s*\*\/[\s\S]*?\/\*\s*sv-omit-end\s*\*\//g, "");
}
```

Twelve lines of mechanical regex. Output is what gets embedded in the exported SVG's `<style>` block. The original CSS file is the browser-side surface; the extracted subset is the export-side surface.

### 18e. Per-element paint attributes — `var()` everywhere

Every paint-bearing SVG element references CSS variables:
- `<rect fill="var(--tv-row-base-bg)">`
- `<line stroke="var(--tv-plot-axis-line)" stroke-width="var(--tv-borders-major-thickness)">`
- `<text fill="var(--tv-cell-fg)" font-family="var(--tv-text-cell-family)" font-size="var(--tv-text-cell-size)" font-weight="var(--tv-text-cell-weight)">`

No `fill="#abcdef"` in the SVG generator's output. No literal colors, no literal sizes (except `width`/`height`/`x`/`y` geometry, which are computed). Every paint surface goes through a variable.

This is the substrate sprint's largest single-file rewrite: `srcjs/src/export/svg-generator.ts` is ~4730 LOC with ~223 `theme.*` field reads, virtually all of which become `var(--tv-...)` references via the manifest. The rewrite is mechanical — each `theme.row.alt.bg` becomes `var(--tv-row-alt-bg)` — but it's hundreds of substitutions. Worth tracking in the refactor-notes log.

---

## 19. librsvg envelope discipline

librsvg has specific CSS support boundaries. Stage 1's CSS choices must stay inside them.

### 19a. What librsvg 2.50+ supports (we use)

- **CSS custom properties + `var()`** — variable resolution at render time.
- **Attribute selectors** — `[data-mode="high-contrast"]`, `[data-row-kind="summary"]`. ✓ Critical for variants.
- **Class + type + descendant selectors** — `.tabviz-scope tr[data-row-kind="data"] .cell-num`. ✓
- **Presentation attributes** as targets of CSS — `fill`, `stroke`, `font-family`, `font-size`, `font-weight`, `opacity`, `text-anchor`, `dominant-baseline`. ✓
- **SVG-specific properties** — `stroke-width`, `stroke-dasharray`, `stroke-linecap`. ✓
- **`<pattern>` and `<linearGradient>` / `<radialGradient>`** — defined elsewhere in the SVG, referenced by URL. ✓ Used for surface textures (Phase 4/Stage 2).
- **Basic `<filter>` effects** — `<feGaussianBlur>`, `<feOffset>`, `<feMerge>`. ✓ Used for elevation shadows (Phase 4/Stage 2).

### 19b. What librsvg supports inconsistently — pre-resolve to be safe

- **`oklch()` color function** — recent rsvg versions support it; older ones fall back to black. Risk for users on legacy systems.
- **`color-mix(in oklch, ...)`** — recent rsvg only; not universally available.

**Discipline:** pre-resolve OKLCH to hex in the CSS-variable values emitted to the SVG's scope `style` attribute. Browser-side keeps the `oklch()` strings (browsers handle them universally); SVG-side gets hex equivalents.

The resolver already produces both: `roleSource` carries OKLCH triples; the CSS-var emitter formats them as either `oklch(...)` (browser) or `#abcdef` (SVG). One resolver, two output forms.

### 19c. What librsvg does NOT support (we avoid)

- **`::before` / `::after` pseudo-elements** — no rendering. Anywhere we'd reach for these in browser CSS, we emit a real SVG element instead in the SVG path.
- **`:hover` / `:focus-visible` / `:active`** — no interactivity. Wrapped in `/* sv-omit-* */` blocks.
- **Animations and transitions** — no time dimension. Wrapped in `/* sv-omit-* */` blocks.
- **`backdrop-filter`** — not supported. Glass effects degrade to flat in SVG (Stage 2 work).
- **CSS Grid / Flex layout** — not relevant; SVG positions geometrically.
- **`:has()` selector** — librsvg support is recent (~2.58+). Avoid; emit per-element `data-*` instead so the parent selectors don't need `:has()`.

### 19d. The discipline in practice

A simple rule: **anything that wouldn't work without JavaScript or DOM events doesn't belong in the runtime CSS's non-omitted section.** If a rule depends on user interaction, browser layout, or pseudo-element generation, it goes in a `/* sv-omit-* */` block.

This forces variants to be declarative: a header-style change is "the cascade resolves new values for the relevant component tokens; the renderer stamps a new attribute; CSS picks up the change." No animation between, no transition; the SVG is a snapshot. The browser layers transitions on top for interactivity (browser-only section).

The discipline is the contract that makes WYSIWYG honest.

---

## 20. Phase-3 open design questions

### Q-P3.1 — Single CSS file vs build-time multi-file concatenation

**RESOLVED 2026-06-02.** Single `theme-runtime.css`. Matches the manifest's one-file pattern; navigable at ~1000 lines (rgc_v4 precedent). One source of truth, one grep target for "rules consuming `--tv-row-alt-bg`." See Decisions log.

### Q-P3.2 — Where does `theme-runtime.css` live in the source tree?

**RESOLVED 2026-06-02.** `srcjs/src/lib/theme/theme-runtime.css`. Colocated with the cascade and manifest; the theme module's directory is the public-contract home. See Decisions log.

### Q-P3.3 — Browser-only rule marker syntax

**RESOLVED 2026-06-02.** Comment-block markers (`/* sv-omit-begin */` / `/* sv-omit-end */`). Simple regex extraction; no AST; no build dependency. See Decisions log.

### Q-P3.4 — Pre-resolve OKLCH to hex for SVG: at build time, at export time, or never?

**RESOLVED 2026-06-02.** Pre-resolve to hex at export time. Browser keeps `oklch()` (universally supported); SVG-side CSS-var values are hex. Resolver produces both forms. WYSIWYG honored across all librsvg versions. See Decisions log.

### Q-P3.5 — CSS file format: `.css` or `.css.ts` template literal?

**RESOLVED 2026-06-02.** Plain `.css`. Vite bundles via `?raw` import for the export-time string consumer; CSS gets proper editor support (syntax highlighting, lints, formatters). See Decisions log.

### Q-P3.6 — Should we drift-gate the `data-*` attribute set?

**RESOLVED 2026-06-02.** Yes — `VARIANT_ATTRIBUTES` const + drift test. Declares every scope-level and element-level `data-*` attribute, allowed values, and stamping renderer paths. Catches silent additions; ~50 lines of test code. See Decisions log.

### Q-P3.7 — Are paint-tool tokens (`data-row-token`) part of Stage 1 or deferred?

**RESOLVED 2026-06-02.** Stage 1 includes the paint-tool substrate. `data-row-token` attribute, the five tokens (`emphasis` / `muted` / `accent` / `bold` / `fill`), their role bindings, and CSS rules all ship together. v3 paint-tool functionality preserved through the substrate move; no user-facing regression. See Decisions log.

---

## 21. Phase-3 Decisions log

> Populated as Phase-3 questions are resolved.

### 2026-06-02 — Q-P3.1 closed: single `theme-runtime.css`

**Decision:** the runtime CSS for the v4 substrate is a single canonical file. **Rationale:** matches the one-file pattern of the manifest (Phase 1). Easier to grep across the runtime surface for "which rules consume `--tv-row-alt-bg`," easier for PR review to see the full theme-paint surface in one place, easier for SVG-export extraction to read a single file. rgc_v4's `lab.css` (982 lines) is precedent for the navigability claim. Multiple per-cluster files would scatter the surface and require build-time concatenation logic the single-file approach doesn't need.

### 2026-06-02 — Q-P3.4 closed: pre-resolve OKLCH to hex for SVG export

**Decision:** the resolver produces two forms of every color value — `oklch(...)` for browser-side CSS variable values, and hex `#abcdef` for SVG-side CSS variable values. SVG export emits the hex form into the scope's inline `style` attribute. **Rationale:** browsers handle `oklch()` universally; librsvg support varies by version. SVG is the *export* artifact — it has to render reliably wherever the user opens it, regardless of which librsvg they have installed. CLAUDE.md's "Supported Runtimes" section makes the V8/SVG path's universality a hard constraint. The cost of dual-emission (one extra hex formatter per value) is trivial; the alternative (emitting `oklch()` to SVG and requiring rsvg 2.50+) fails ugly on legacy systems. Cascade Inspector + DevTools still see `oklch()` strings in the browser path; the hex form is invisible to non-export users.

### 2026-06-02 — Q-P3.6 closed: drift-gate the `data-*` attribute set

**Decision:** Stage 1 ships a `VARIANT_ATTRIBUTES` const exported from `srcjs/src/lib/theme/variant-attributes.ts` and a drift test (`variant-attributes.drift.test.ts`) parallel to the `COMPONENT_TOKENS` machinery. Each entry: attribute name, allowed values, scope (scope-level / element-level), stamping renderer paths. Drift test enforces: every renderer-stamped `data-*` attribute is declared; every declared attribute has at least one stamping renderer path; CSS selectors targeting unknown attributes fail the gate. **Rationale:** the variant surface is the substrate's *variant-selection* contract, just as `COMPONENT_TOKENS` is the consumer contract. Drift-gating it costs ~50 LOC and catches a real failure mode (a renderer adds `data-foo="bar"` without anyone updating the CSS rules or documentation). Small surface (~10 attributes); discipline scales as Phase 4+ adds variants.

### 2026-06-02 — Q-P3.7 closed: paint-tool substrate ships in Stage 1

**Decision:** the paint-tool's `data-row-token` element-level attribute (values: `none` / `emphasis` / `muted` / `accent` / `bold` / `fill`), its role bindings in the resolver, its CSS rules in `theme-runtime.css`, and the existing R/JS paint-tool API surface all ship together in Stage 1. No interim state where the paint tool is unavailable. **Rationale:** the paint tool is existing v3 user-facing functionality; the substrate sprint preserves user-facing capability per the "no half-states" hard constraint (vision doc §5). The `data-row-token` attribute IS the substrate's mechanism for per-row token application — separating it from Stage 1 would mean shipping v4 without one of its core capabilities, contradicting the substrate's design. The work is small (a handful of role bindings + CSS rules + one element-level attribute + the existing paint-tool API delegation).

### 2026-06-02 — Q-P3.2 closed: `theme-runtime.css` lives at `srcjs/src/lib/theme/theme-runtime.css`

**Decision:** the runtime CSS file is colocated with the manifest, resolver, override schema, and other theme-module artifacts under `srcjs/src/lib/theme/`. **Rationale:** the theme module's directory is the public-contract home for everything theme — the consumer interface (Phase 2), the manifest contract (Phase 1), the override schema, and now the runtime CSS. Future agents look in one place for the whole substrate. Alternative locations (`styles/`, top-of-src `runtime.css`) would scatter the substrate across directories or require future agents to know two places to look.

### 2026-06-02 — Q-P3.3 closed: comment-block markers for browser-only rules

**Decision:** browser-only rules in `theme-runtime.css` are wrapped in `/* sv-omit-begin */` / `/* sv-omit-end */` comment markers. The SVG-CSS extractor strips everything between matched markers via a single regex. **Rationale:** mechanically simple — twelve lines of regex; no AST parsing; no PostCSS or other build dependency. The marker syntax is self-explanatory to readers (a `/* sv-omit-* */` block is clearly meta-CSS, not a regular comment). PostCSS-style at-rules would add a build-pass dependency for marginal stylistic gain. The semantic of the markers ("everything here is browser-only") matches the discipline they enforce.

### 2026-06-02 — Q-P3.5 closed: plain `.css` file with Vite `?raw` import

**Decision:** `theme-runtime.css` is authored as a regular CSS file. The export-time consumer (V8/svg-generator) imports it as a raw string via Vite's `?raw` query (`import css from "./theme-runtime.css?raw"`). The browser path consumes it via the standard CSS bundling path. **Rationale:** plain CSS gets full editor support — syntax highlighting, lints, formatters, autocomplete for CSS variables. Vite's `?raw` mechanism is well-established and adds one config entry, not a build pass. The alternative (`.css.ts` template literal) loses editor support and makes large CSS files painful to maintain. The runtime CSS will grow to ~1000 lines; tooling matters.

---

# Phase 4 — resolver capabilities

This phase covers the resolver's full v4 capability surface: polarity flip, modes, alpha companions, curves, off-ramp roles, plus the new Tier-1 variant inputs introduced in Phase 3. All of these land inside the Stage 1 substrate sprint per Q11 closure (vision doc §9).

## 22. Polarity flip via anchor L-reflection

### 22a. The mechanic

A light theme and its dark counterpart are related by an **involutive lightness reflection** on every anchor. Each anchor's `L` component flips around a central pivot:

```
L → 1.1 − L   (clamped to [0.04, 0.99])
```

`paper.L`, `ink.L`, `brand.L`, `decorative.L`, status anchor lightness — all reflect together. Chroma and hue stay constant.

The reflection is *involutive* (`reflect(reflect(L)) = L`) so toggling light↔dark is exact, not an approximation. The cascade re-resolves from reflected anchors and everything downstream — ramps, roles, component tokens, modes — re-derives correctly because every downstream computation keys off `paper.L < 0.5` to decide direction.

### 22b. Where it lives in the resolver

```typescript
// In theme-resolve.ts, before ramp construction:
export function applyPolarity(inputs: ThemeInputs): ThemeInputs {
  if (inputs.mode === "light") return inputs;  // no-op
  return {
    ...inputs,
    anchors: {
      paper:      reflectAnchor(inputs.anchors.paper),
      ink:        reflectAnchor(inputs.anchors.ink),
      brand:      reflectAnchor(inputs.anchors.brand),
      decorative: inputs.anchors.decorative
                    ? reflectAnchor(inputs.anchors.decorative)
                    : null,
      // status anchors reflect too (they have their own L)
      status: {
        positive: reflectAnchor(inputs.anchors.status.positive),
        negative: reflectAnchor(inputs.anchors.status.negative),
        warning:  reflectAnchor(inputs.anchors.status.warning),
        info:     reflectAnchor(inputs.anchors.status.info),
      },
    },
  };
}

function reflectAnchor(a: OklchTriple): OklchTriple {
  return { L: clamp(1.1 - a.L, 0.04, 0.99), C: a.C, H: a.H };
}
```

`applyPolarity` is a pure function on inputs; called once at the top of `resolveTheme`. Everything downstream is unchanged — same `buildRamps`, same `resolveRoles`, same `emitCssVars`.

### 22c. Per-preset escape hatch

Some presets won't reflect cleanly (e.g. a dark preset whose brand needs to be a different hue than its light sibling). For those, the input includes an explicit `anchor_overrides_dark: Partial<Anchors>` field that takes precedence over the reflection result.

```typescript
type ThemeInputs = {
  mode: "light" | "dark";
  anchors: Anchors;
  /** Optional: per-anchor overrides applied AFTER polarity reflection when
   *  mode is "dark". For presets that don't reflect cleanly. */
  anchor_overrides_dark?: Partial<Anchors>;
  // ... rest
};
```

The 18-preset audit (§28) determines which presets need this field populated.

---

## 23. HC + RT modes as resolver transforms

### 23a. The model

`mode` has three values: `standard` (default), `high-contrast`, `reduced-transparency`. Stored on `inputs.mode` (extended from light/dark which becomes a separate `inputs.polarity` field — see §30).

```typescript
type ThemeInputs = {
  polarity: "light" | "dark";   // controls L-reflection (§22)
  mode: "standard" | "high-contrast" | "reduced-transparency";   // controls resolver transforms
  // ... rest
};
```

**Polarity and mode are orthogonal.** A user can run dark + high-contrast simultaneously; the cascade resolves both correctly.

### 23b. HC mode resolver transforms

When `mode === "high-contrast"`:
- **Border roles push by +2/+3 grades.** `border-subtle` (default neutral.6) → neutral.8; `border-strong` (default neutral.8) → neutral.10; `border` (default neutral.7) → neutral.9. Pushes through `clamp(0, 10)` so it doesn't overflow.
- **Wash fills drop to transparent.** Roles with `kind: "translucent-wash"` in the manifest become `transparent`. Examples: `highlight-bg`, `accent-fill`, status fill roles.
- **Translucent backgrounds are replaced with strong borders.** Where a wash dropped, the consuming token gains a `border` declaration (handled via mode-specific CSS rules in `theme-runtime.css`).

Encoding fidelity for HC (caret glyphs, ring chips, bar thickening) is Stage 2 work — these are *renderer* changes, not resolver changes. Stage 1's HC only does the resolver-level transforms; Stage 2 adds the encoding-fidelity layer.

### 23c. RT mode resolver transforms

When `mode === "reduced-transparency"`:
- **Alpha-companion ramps swap to opaque equivalents.** Wash roles that normally read from `--tv-ramp-brand-alpha-3` switch to a solid `--tv-ramp-brand-3` lookup. Manifest's `modes.rt: { swap: "..." }` declares the swap target.
- **Translucent material effects degrade.** Glass surfaces become flat (the `surface.raised` falls back to the solid `paper_raised` value). Brand gradients flatten to mean solid.

### 23d. Manifest integration

The mode behavior is encoded in the `COMPONENT_TOKENS` manifest's `modes` field, where applicable:

```typescript
{
  cssVar: "--tv-row-emphasis-bg",
  kind: "paint-fill",
  source: { tier: "role", role: "highlight-bg" },
  modes: {
    hc: "drop",                          // → transparent under HC
    rt: { swap: "fill-hover" },          // → swap to solid equivalent
  },
  // ...
},
```

The resolver consults `modes` when computing each token's value:
1. Look up the token's `source` to get its default value.
2. Check `modes[currentMode]`:
   - `"drop"` → return `"transparent"`.
   - `{ swap: roleName }` → look up `roles[swap]` instead.
   - Absent → use the source value unchanged.
3. Return the resolved value.

This keeps the per-mode logic declarative and centralized in the manifest, not scattered as `if (mode === "hc")` branches in the resolver.

---

## 24. Alpha companion ramps

### 24a. The concept

Every ramp has an alpha-companion ramp: the same hue at rising opacity instead of changing lightness. Composited over `paper`, the alpha companion approximates the solid ramp at the corresponding grade.

```typescript
// In buildRamps:
const neutralAlpha = alphaCompanion(inputs.anchors.ink);
const brandAlpha   = alphaCompanion(inputs.anchors.brand);
const accentAlpha  = alphaCompanion(inputs.anchors.decorative ?? inputs.anchors.brand);

function alphaCompanion(anchor: OklchTriple): OklchTripleAlpha[] {
  const out = [];
  for (let i = 0; i < 11; i++) {
    const a = clamp(0.03 + Math.pow(i / 10, 1.25) * 0.9, 0, 0.95);
    out.push({ L: anchor.L, C: anchor.C, H: anchor.H, A: round(a, 3) });
  }
  return out;
}
```

The curve `0.03 + t^1.25 * 0.9` gives a gentle ramp from near-invisible (α ≈ 0.03) to nearly-opaque (α ≈ 0.93), with a slight concavity that matches how the solid ramp packs grades at the dark end.

### 24b. Emitted CSS variables

Alpha ramps emit alongside solid ramps:

```css
--tv-ramp-neutral-1: oklch(0.99 0.005 250);    /* solid */
--tv-ramp-neutral-alpha-1: oklch(0.18 0.01 250 / 0.030);   /* α companion */
--tv-ramp-neutral-2: oklch(0.97 0.005 250);
--tv-ramp-neutral-alpha-2: oklch(0.18 0.01 250 / 0.075);
/* ... etc */
```

Naming pattern: `--tv-ramp-{ramp}-alpha-{grade}`. 11 alpha grades per ramp × 3 ramps = 33 variables, in addition to the 33 solid ramp variables.

### 24c. Which roles use alpha companions

Per rgc_v4: only **wash roles** consume alpha companions. The default set:
- `highlight-bg` → `brand-alpha-3` (translucent wash row highlight)
- `accent-fill` → `accent-alpha-2`
- `info-fill` / `pos-fill` / `neg-fill` / `warn-fill` → status-color alpha (status doesn't have a real "ramp" but follows the same pattern via per-status alpha values, computed in `statusScale`)

The role's default binding marks `alpha: true` to indicate it reads from the alpha companion of its ramp:

```typescript
type RoleBinding = {
  ramp: RampName;
  grade: number;
  alpha?: boolean;   // optional; defaults false
};
```

Resolver looks up `ramps[ramp]` (solid) or `ramps[ramp]Alpha` (alpha) depending on the flag.

### 24d. User-side override

Pinning a wash role to a different grade keeps it as a wash:

```r
theme |> set_role_binding("highlight-bg", "brand", 4)
# Still uses brand alpha; just grade 4 instead of 3
```

Switching from alpha to solid (or vice versa) is a manifest-level concern (the role declares `alpha: true` in its default binding), not a user override. Users who want a solid version of a wash role use a different role.

---

## 25. Curves per ramp

### 25a. The mechanic

Each ramp's lightness progression is shaped by a *curve* — a function `[0,1] → [0,1]` that remaps the grade index before lightness interpolation.

```typescript
const CURVES = {
  linear: (t: number) => t,
  ease:   (t: number) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2) / 2,   // smooth S
  smooth: (t: number) => t * t * (3 - 2 * t),                              // smoothstep
  log:    (t: number) => Math.log(1 + t * (Math.E - 1)),                   // packs the dark end
  exp:    (t: number) => (Math.exp(t) - 1) / (Math.E - 1),                 // packs the light end
};
```

Default curves:
- Neutral: `ease` (smooth grade spacing)
- Brand: `linear` (uniform distribution; anchored at brand at grade 9)
- Accent: `linear` (same)

### 25b. Tier-1 input

Curves are a Tier-1 input under `inputs.curves`:

```typescript
type ThemeInputs = {
  // ...
  curves?: Partial<Record<RampName, CurveName>>;   // optional; defaults applied if absent
};
```

R modifier: `set_curve(theme, ramp, curve)`. JS: `setCurve(wire, ramp, curve)`.

### 25c. Why this matters aesthetically

Curve choice meaningfully changes the *feel* of a theme:
- `log` packs the dark end → more light grades available → airier, more open feel.
- `exp` packs the light end → more dark grades → moodier, more saturated feel.
- `ease` is a smooth S → standard well-distributed perceptual spacing.

The 18 presets pick curves to reinforce their aesthetic (the editorial themes lean `log`; the dark themes lean `ease` or `exp`). 18-preset audit (§28) picks curves per preset.

---

## 26. Off-ramp roles distinction

### 26a. The categories

Most roles bind to `(ramp, grade)`. Some don't — they live "off the ramps":

1. **Status roles** (`pos-text`, `pos-fill`, `pos-solid`, etc.) — anchored at Tier-1 status inputs, not derived from ramps. The status anchor has its own L/C/H; the role just reads from a fixed-position scale around it.
2. **Computed roles** (`text-onsolid`) — computed from contrast against a paired solid (APCA contrast pick).
3. **Mode-conditional roles** (`highlight-bg` under HC) — resolved as `transparent` or other constants depending on mode.

### 26b. How they interact with the override schema

Off-ramp roles **cannot be pinned via `(ramp, grade)` overrides.** The override schema doesn't apply. Two consequences:

- `setRoleBinding(wire, "pos-text", ...)` throws `RoleNotBindableError`: "Role `pos-text` is status-anchored; override the status input via `setStatus(\"positive\", \"#abcdef\")` instead."
- `pinTokenByName(wire, "row-pos-text", ...)` traces back to `source.tier === "input"` (status) and throws the same error class (which we already designed for in §9c).

The error surface is consistent: off-ramp roles surface a different override path (input-level), not silent failure.

### 26c. R-side off-ramp surface

```r
# Status anchor modifiers (already exist in v3; preserved)
set_status(theme, status = "positive", color = "#3F7D3F")
set_status(theme, status = "negative", color = "#B33A3A")
# etc.

# Off-ramp roles surface in `list_component_tokens` with their tier label so
# users see they're not (ramp, grade)-bindable
list_component_tokens(theme, role = "pos-fill")
# Token --tv-status-positive-bg
#   Source: tier=input (status.positive) — not (ramp, grade)-bindable
#   Override via: set_status(theme, "positive", "#...")
```

The discovery helper teaches the right modifier path; the user doesn't have to know the off-ramp distinction conceptually.

---

## 27. Status anchor coverage verification

The cascade has four status semantic anchors: `positive`, `negative`, `warning`, `info`. Each produces three role values (`fill`, `solid`, `text`) and three Tier-3 component tokens. Total: 12 status tokens.

Stage 1 verifies that:
1. All four anchors have default hex values in `theme-presets-inputs.ts` (no `null` defaults).
2. All 12 role values resolve to non-null hex.
3. APCA contrast invariants hold for the `text` variant against `paper` (Lc ≥ 45) in both light and dark polarities.
4. The drift gate catches manifest entries claiming `source.tier === "input"` against missing status fields.

This is a parity check during the substrate sprint; tested by `theme-resolve.test.ts` extensions covering all 18 presets × 2 polarities × 4 status anchors.

---

## 28. 18-preset polarity audit — **DEFERRED to Stage 4** (preset reimagining)

> **STATUS UPDATE 2026-06-02.** Per the Decisions log entry of 2026-06-02 ("Preset porting deferred to a new Stage 4"), the 18 v3 presets are **quarantined** during the Stage 1 substrate sprint. The 18-preset polarity audit does not happen in Stage 1; it happens in Stage 4 when each preset is reimagined from scratch against the v4 substrate.

### 28a. What this section originally covered

The 18-preset polarity audit was originally scoped into Stage 1 (per Q11 closure folding color extensions into the substrate sprint). The audit would have generated dark variants by L-reflection (§22a), visually inspected each one, and populated `anchor_overrides_dark` (§22c) on presets needing re-anchoring.

### 28b. Why the deferral makes more sense

Mechanically porting the 18 v3 presets during Stage 1 would have:
- consumed disproportionate sprint calendar (per-preset visual review × 18 × {light, dark});
- constrained the substrate's design with backward-aesthetic compatibility pressure;
- missed the opportunity to apply Stage 1–2 capabilities deliberately when authoring each preset.

Deferring to Stage 4 — *after* the full substrate + capability surface is stable — means each preset gets authored with intention rather than translated mechanically. Curves, shell modes, surface textures, typography pairings, and polarity choices all become deliberate design decisions per preset.

### 28c. What ships in Stage 1 instead — the minimal testing set

Stage 1 develops against a small set of sprint-internal "dev" themes (defined in §28d below). The polarity-flip mechanic itself (the L-reflection math, the `anchor_overrides_dark` escape hatch) ships in Stage 1; it's just exercised by the minimal testing set, not by 18 production presets.

The Stage 1 invariants the polarity audit was supposed to verify (APCA contrast in both polarities; clean reflection; etc.) are validated for the minimal testing set during Stage 1 and for each new preset as it's authored in Stage 4.

### 28d. The minimal testing set (Stage 1 sprint-internal)

Stage 1 ships two minimal sprint-internal themes, defined in `srcjs/src/lib/theme/dev-themes.ts`:

- **`dev-light`** — a light-polarity theme exercising the substrate's full capability surface: a generic blue brand (`#3366CC`), a contrasting decorative (`#CC6633`), default fonts (Inter / IBM Plex Mono), `head_style = "light"`, `rules = "horizontal"`, `frame = "on"`, `density = "comfortable"`, `mode = "standard"`. Not intended to be visually elegant — intended to be a clean exercise of the cascade.
- **`dev-dark`** — a dark-polarity theme derived from `dev-light` via the L-reflection mechanic. Used to verify polarity flip works without requiring 18-preset audit.

These themes drive:
- All Stage 1 visual baseline shoots.
- The browser ↔ SVG parity harness (§41b).
- The Fallback Triptych (§29) — which renders `dev-light` under all three modes.
- R↔TS parity tests for the wire round-trip.
- APCA contrast invariants verification.
- Cascade Inspector tests.

The minimal set covers ~95% of the substrate surface (the multi-effect / pictogram / sparkline / etc. tests use the same dev theme; the capability is in the renderer, not in the theme variety).

`dev-light` and `dev-dark` are **NOT user-facing presets.** They're shipped internally for testing and may be removed when Stage 4's reimagined presets land.

---

## 29. Fallback Triptych as docs artifact

### 29a. What it is

A live-rendered docs page (`docs/cascade/fallback-triptych.qmd`) showing three side-by-side mini-tables: one rendered under `standard` mode, one under `reduced-transparency`, one under `high-contrast`. Same data, same theme, three rendering modes.

Demonstrates visually that the highlight encoding survives all three modes:
- Standard: brand-α wash (translucent fill)
- RT: opaque tint (color-mix to solid)
- HC: drop fill, add bar + caret glyph (Stage 2 fidelity)

Stage 1 ships standard + RT. The HC caret glyph is Stage 2's renderer work; the resolver-level HC transforms (drop fills, push borders) ship in Stage 1 and are visible in the triptych immediately.

### 29b. Why it's a docs artifact

The triptych is *the proof* that the mode architecture works. It's also pedagogical — readers see how the cascade degrades gracefully without losing semantic encoding. Quarto live-renders it via the same htmlwidget path the rest of the docs use; the same code that powers the production widget powers the triptych.

---

## 30. New Tier-1 inputs landing in Stage 1

Stage 1 introduces several new Tier-1 inputs. Each gets an R modifier and a JS wire setter.

### 30a. Variant inputs

| Input | Type | Default | R modifier |
|---|---|---|---|
| `polarity` | `"light"` \| `"dark"` | `"light"` | `set_polarity(theme, "dark")` |
| `mode` | `"standard"` \| `"high-contrast"` \| `"reduced-transparency"` | `"standard"` | `set_mode(theme, "high-contrast")` |
| `head_style` | `"light"` \| `"tint"` \| `"fill"` | `"light"` | `set_head_style(theme, "fill")` |
| `title_style` | `"normal"` \| `"bar"` \| `"underline"` | `"normal"` | `set_title_style(theme, "bar")` |
| `rules` | `"horizontal"` \| `"vertical"` \| `"grid"` \| `"none"` | `"horizontal"` | `set_rules(theme, "grid")` |
| `frame` | `"on"` \| `"off"` | `"on"` | `set_frame(theme, "off")` |
| `first_col_style` | `"default"` \| `"bold"` | `"default"` | `set_first_col_style(theme, "bold")` |
| `curves` | `Partial<Record<RampName, CurveName>>` | per-ramp defaults | `set_curve(theme, "neutral", "log")` |

All are emitted as `data-*` attributes on the scope (Phase 3 §15c).

### 30b. The existing `mode` input changes meaning

v3's `inputs.mode` is `"light"` / `"dark"`. v4 splits this:
- `inputs.polarity = "light" | "dark"` (the L-reflection control)
- `inputs.mode = "standard" | "high-contrast" | "reduced-transparency"` (the resolver-transform control)

Existing v3 `inputs.mode = "dark"` becomes `inputs.polarity = "dark"`. The R modifier `set_mode("dark")` redirects to `set_polarity("dark")` with a deprecation warning during the substrate sprint, then the redirect is removed at landing. **Brief co-maintenance exception**, justified by the small surface and user-discoverability — `set_mode("dark")` is the single most-used theme modifier and silent breakage would be a footgun even in pre-release.

Actually — wait. The clean-break principle says no co-maintenance. The exception is small but real. Worth deciding (Q-P4.6).

---

## 31. Phase-4 open design questions

### Q-P4.1 — Where does `applyPolarity()` live in the resolver pipeline?

**RESOLVED 2026-06-02.** Explicit first step of `resolveTheme()`. Pure function on inputs; Inspector sees polarity-applied inputs as a distinct stage. See Decisions log.

### Q-P4.2 — Are alpha companion ramps emitted as separate CSS variables or computed via `color-mix()`?

**RESOLVED 2026-06-02.** Separate CSS variables (`--tv-ramp-{ramp}-alpha-{grade}`). 33 extra variables; portability across librsvg versions; matches Q-P3.4 / Q-P4 pattern. See Decisions log.

### Q-P4.3 — Curve names: presence and naming

**RESOLVED 2026-06-02.** Five curves (`linear`, `ease`, `smooth`, `log`, `exp`). Cheap to implement; meaningful aesthetic range; editorial themes benefit from `log`. See Decisions log.

### Q-P4.4 — Off-ramp roles in the override surface: throw or silently no-op?

**RESOLVED 2026-06-02.** Throw `RoleNotBindableError` with actionable message directing the user to the input-level modifier. Consistent with `pinTokenByName`'s error surface (§9c). See Decisions log.

### Q-P4.5 — Splitting `inputs.mode` into `polarity` + `mode`

**RESOLVED 2026-06-02.** Split now. `polarity = "light" | "dark"` controls L-reflection; `mode = "standard" | "high-contrast" | "reduced-transparency"` controls resolver transforms. Orthogonal axes — user can run dark + HC simultaneously. See Decisions log.

### Q-P4.6 — `set_mode("dark")` deprecation redirect during the sprint?

**RESOLVED 2026-06-02.** Hard error. `set_mode("dark")` throws with the message: `Did you mean set_polarity("dark")?`. Strict clean-break per §4c; the error message IS the migration path. See Decisions log.

### Q-P4.7 — Fallback Triptych: live-rendered Quarto page or static snapshot?

**RESOLVED 2026-06-02.** Live-rendered Quarto page (`docs/cascade/fallback-triptych.qmd`). Same htmlwidget the gallery uses; regenerates with every cascade change. See Decisions log.

### Q-P4.8 — Variant inputs flat or grouped?

**RESOLVED 2026-06-02.** Flat on `ThemeInputs`. R modifier names are flat; input shape matches modifier signature; no transformation layer between user surface and wire. See Decisions log.

---

## 32. Phase-4 Decisions log

> Populated as Phase-4 questions are resolved.

### 2026-06-02 — Q-P4.1 closed: `applyPolarity()` is an explicit first step of `resolveTheme()`

**Decision:** the polarity reflection is a pure function on `ThemeInputs` called as the first step of `resolveTheme()`, before `buildRamps()`. Cascade Inspector sees the polarity-applied inputs as a distinct stage in the resolver pipeline. **Rationale:** explicit pipeline steps are inspectable and testable in isolation; folding polarity into ramp building hides the reflection inside a function whose name says nothing about polarity. The Cascade Inspector's value for users includes "this dark-mode value is the L-reflected version of the light-mode anchor" — that trace only makes sense if `applyPolarity` is visible as its own step.

### 2026-06-02 — Q-P4.2 closed: alpha companion ramps emit as separate CSS variables

**Decision:** the resolver emits `--tv-ramp-{ramp}-alpha-{grade}` variables alongside the solid `--tv-ramp-{ramp}-{grade}` variables. 33 extra ramp variables across the three ramps. **Rationale:** matches the OKLCH-hex pre-resolution pattern from Q-P3.4 — pre-computed values guarantee portability across librsvg versions regardless of `color-mix()` support. The 33-variable wire overhead is trivial; the alternative (compute via `color-mix()` at consumption) introduces a per-rule fragility for negligible savings. Wash-role consumers reference `--tv-ramp-brand-alpha-3` directly; the indirection is one less moving part per rule.

### 2026-06-02 — Q-P4.3 closed: ship five curves (`linear`, `ease`, `smooth`, `log`, `exp`)

**Decision:** the curves vocabulary covers all five rgc_v4 curves. Per-preset and user-overridable via `set_curve(theme, ramp, curve)`. **Rationale:** cheap to implement (five one-line easing functions); meaningful aesthetic range for the 18 presets; editorial themes specifically benefit from `log` (per the `project_editorial_themes` memory) which packs the dark end and gives airy/open-feeling layouts. Shipping fewer curves now means re-opening the curves vocabulary later when editorial themes land in Stage 2/3 work — better to settle the full set now.

### 2026-06-02 — Q-P4.4 closed: off-ramp roles throw `RoleNotBindableError` with actionable message

**Decision:** `setRoleBinding(wire, role, ...)` checks if the role is off-ramp (status-anchored, computed, or mode-conditional) and throws `RoleNotBindableError` with a message directing the user to the correct override path (e.g. `setStatus("positive", "#abcdef")` for status roles). Similarly `pinTokenByName` propagates the error for tokens that trace back to off-ramp roles. **Rationale:** explicit failures with actionable messages beat silent surprises. Consistent with `pinTokenByName`'s error surface (§9c — `TokenNotPinnableError` for non-role-sourced tokens). The error message IS the documentation; user learns the right path on first attempt.

### 2026-06-02 — Q-P4.5 closed: split `inputs.mode` into `polarity` + `mode`

**Decision:** v4 `ThemeInputs` has two orthogonal fields: `polarity: "light" | "dark"` (controls L-reflection) and `mode: "standard" | "high-contrast" | "reduced-transparency"` (controls resolver transforms). Replaces v3's single `mode: "light" | "dark"`. **Rationale:** polarity and contrast-mode are orthogonal concerns — a user can run dark + HC simultaneously, and the resolver applies both transforms independently. Combining them into one field forces awkward enum values (`"dark-hc"`) and loses the orthogonality. Pre-release license to fix the input vocabulary.

### 2026-06-02 — Q-P4.6 closed: `set_mode("dark")` throws a hard error; no deprecation redirect

**Decision:** `set_mode("dark")` throws an error with the message `'dark' is not a valid mode in v4. Did you mean set_polarity("dark")?`. No silent redirect, no deprecation warning. **Rationale:** clean-break principle per §4c. The error message IS the migration path — no documentation lookup required. The clean-break commitment applies even to single-call ergonomic shortcuts: the new system is the system. Pre-release users hit the error once on first invocation, fix the call site, move on. The cost (one error per user, fixed by reading the message) is trivial compared to the discipline benefit of "the new vocabulary is the only vocabulary."

### 2026-06-02 — Q-P4.7 closed: Fallback Triptych ships as a live-rendered Quarto page

**Decision:** `docs/cascade/fallback-triptych.qmd` uses the same htmlwidget the gallery uses; renders three mini-tables side-by-side under standard / RT / HC modes; regenerates with every cascade change via the live R chunks. **Rationale:** the triptych's value is in *proving* the mode architecture works. A live-rendered version regenerates on every docs build and catches drift; a static snapshot drifts silently. Per CLAUDE.md, live-rendered Quarto pages catch JS regressions that SVG tests don't. The pedagogical value is highest when the triptych is currently true, not when it captures a state from three months ago.

### 2026-06-02 — Q-P4.8 closed: variant inputs are flat on `ThemeInputs`

**Decision:** `head_style`, `title_style`, `rules`, `frame`, `first_col_style`, `polarity`, `mode`, `curves` are top-level fields on `ThemeInputs` alongside `brand`, `accent`, `fonts`, `density`, etc. No `inputs.variants` sub-grouping. **Rationale:** R modifier names are flat (`set_head_style`); matching the input shape removes a transformation layer between user surface and wire. The variant inputs ARE inputs; grouping them under "variants" implies a sub-category that doesn't carry semantic weight (what's the difference between a "variant input" and a regular input? both are user-set Tier-1 values). Flat structure also makes JSON serialization more readable and import/export simpler.

---

# Phase 5 — row-kind height cascade

This phase covers the layers 1–4 of the per-row-kind height cascade (designed in `docs/dev/sizing-model.md §8 + §8a`, partially built — pin layer 5 already on main), plus the dual affordance (settings-panel control + drag handle with overlay-layer DOM plumbing).

Folded into Stage 1 per the Decisions log entry of 2026-06-02 (vision doc §9). The pin layer sits half-functional on main until Stage 1 lands; layers 1–4 + affordances complete the row-kind work.

## 33. The height cascade

### 33a. Resolution formula

```
resolvedHeight(row) =
  pin[kind]                                                 // layer 5 (built)
  ?? (rowHeight × resolveRatio(kind))                       // layers 1–4
```

Where `resolveRatio(kind)` walks the cascade:

```
resolveRatio(kind) =
  constructor.row_heights[kind]                             // layer 4 — author override
  ?? theme.row_kinds[kind].heightRatio                      // layer 3 — theme default
  ?? resolveRatio(parent(kind))                             // layer 2 — inheritance walk
  ?? INTRINSIC_KIND_RATIO[kind]                             // layer 1 — built-in default
```

Layers 4 and 3 are user-set Tier-1 input values. Layer 2 is the inheritance graph (constants). Layer 1 is the intrinsic ratio table (constants).

### 33b. Layer 1 — intrinsic kind ratios

```typescript
export const INTRINSIC_KIND_RATIO: Record<RowKind, number> = {
  "data":           1.0,
  "group-header":   1.0,
  "section-header": 1.0,
  "summary":        1.0,
  "spacer":         0.5,
  "panel":          1.0,    // height set by content; ratio doesn't really apply
  "header":         1.0,    // technically column-header row; rendered separately
};
```

**Spacer is the only non-1.0 default.** Half the row height matches v3 behavior. Per the handoff's `feedback_dont_pre_bake_defaults` warning, we don't speculate on other kind-specific ratios; we let real use drive deviations.

### 33c. Layer 2 — inheritance graph

A small fixed graph encoding "if this kind has no value, look at its parent":

```typescript
export const KIND_INHERITANCE: Partial<Record<RowKind, RowKind>> = {
  "summary":        "data",
  "section-header": "group-header",
};
```

Shallow (one hop); fixed; not user-extensible. The intuition: changing `data`'s ratio should propagate to `summary` unless summary is set independently, because summary rows visually relate to data rows.

### 33d. Layer 3 — theme-level default

Theme-level ratios live on the new structured input shape (per Q10 closure):

```typescript
type ThemeInputs = {
  // ... rest
  row_kinds: Partial<Record<RowKind, RowKindInputs>>;
};

type RowKindInputs = {
  heightRatio?: number;     // layer 3 in the cascade
  // future Stage 2 paint fields: bg, fg, weight, border, etc.
};
```

A theme that wants summary rows 25% taller than data rows:
```typescript
{
  // ... rest
  row_kinds: {
    summary: { heightRatio: 1.25 },
  }
}
```

The R modifier `set_row_kind_height_ratio(theme, "summary", 1.25)` writes this field.

### 33e. Layer 4 — constructor override

Per-spec authoring at construction time:

```r
forest_plot(data, row_heights = list(summary = 1.5, "section-header" = 0.9))
```

Constructor overrides win over theme defaults but not over the interactive pin (layer 5). The override is a *ratio* (cascade-consistent), not an absolute px — same logic as the theme default.

### 33f. Layer 5 — the pin (already shipped)

Interactive pin via `setRowKindHeight(kind, px)` writes an absolute px value that bypasses the ratio chain. Survives density and densityFactor changes. Resetting (`setRowKindHeight(kind, null)`) drops the pin and re-enters the cascade.

---

## 34. The dual affordance

### 34a. Settings-panel per-kind height control

In `srcjs/src/components/ui/SpacingControl.svelte` (or a new dedicated `RowKindHeightsControl.svelte` — Q-P5.3), a per-kind slider lets users:
- Adjust a ratio for the current kind (writes layer 3 — theme default)
- Or set an absolute px (writes layer 5 — pin)
- Reset to default (clears the pin AND the theme default for that kind, falling back through layers 4→3→2→1)

The slider shows the current resolved height; a small badge indicates which layer the current value comes from ("default" / "theme" / "pin").

### 34b. Drag handle on row bottom edge

Per the handoff's open build-time question: **rows have no wrapper element** (cells are individual CSS-grid children), so drag handles need an absolutely-positioned overlay layer at row boundaries with pointer capture + commit fallbacks. The overlay mirrors `ColumnHeaders.svelte::startResize`.

Mechanics:
1. **Overlay layer** (`RowEdgeHandles.svelte`) renders one absolutely-positioned `<div class="row-edge-handle">` per row boundary, at `top: rowPositions[i] + rowHeights[i] - HANDLE_THICKNESS/2`.
2. **Pointer interaction**: pointerdown on a handle captures the pointer; pointermove updates a transient `dragDelta` in store state; pointerup commits via `setRowKindHeight(resolvedKind, newHeight)`.
3. **Cursor + visual feedback**: handle shows `cursor: row-resize`; opacity 0 → visible on row-hover or while dragging; thin accent line on active.
4. **Commit fallback**: pointercancel (rare) clears the drag state without committing; pointerleave during drag stays in drag state (captured pointer).
5. **Browser harness**: `tests/browser/row-edge-resize.browser.ts` puppeteer test launches Chromium, mounts the widget, simulates a drag on a row edge, asserts the row height updated and the pin was set.

### 34c. What dragging actually pins

Per the §8 ontology in `sizing-model.md`: **drag edits the band-type's height token, table-wide**, not a per-row pin. Dragging a `data` row's bottom edge pins `data` kind to the new absolute px; all data rows resize together. Dragging a `summary` row pins `summary`. This matches the row-homogeneity invariant (uniform row height keeps the grid reading as a grid).

If a user wants a single "hero" row taller, that's authored content (a taller cell / `naturalHeight`) or an explicit `row.style.height` — not the drag handle.

---

## 35. R modifier surface

```r
# Set the theme-level height ratio for a kind (layer 3).
set_row_kind_height_ratio(theme, "summary", 1.25)
# Clear it (falls back through layers 4 → 2 → 1).
set_row_kind_height_ratio(theme, "summary", NULL)

# Authoring-time per-spec override (layer 4) on the forest_plot constructor.
forest_plot(data, row_heights = list(summary = 1.5, "section-header" = 0.9))

# Interactive pin (layer 5) — usually set via drag, but exposed for tests + scripts.
set_row_kind_height_pin(theme, "data", 32)         # absolute px
set_row_kind_height_pin(theme, "data", NULL)        # clear pin

# Reset all overrides (all layers 3-5) for a kind, falling back to layers 1-2.
release_row_kind_heights(theme, "data")
# Or for all kinds.
release_all_row_kind_heights(theme)

# Discovery helper (Stage 1 §12e pattern, extended for heights).
list_row_kind_heights(theme)
# Returns a table:
#   kind             intrinsic   inherited  theme   constructor  pin  resolved
#   data                  1.0          —      —             —     —      24
#   summary               1.0       data    1.25             —     —      30
#   section-header        1.0  group-header   —             —     —      24
#   ...
```

The cascade walk is visible to users via `list_row_kind_heights`. Same discovery pattern as `list_component_tokens` (§12e).

---

## 36. Tests required

The Phase 5 deliverable ships with:

| Test | Location | Asserts |
|---|---|---|
| Per-kind base | `srcjs/src/lib/layout/table-metrics.test.ts` | Each kind's resolved base height matches the cascade resolution for various input shapes. |
| Content grows above floor | `table-metrics.test.ts` | Content height still overrides cascade base when larger (the existing v3 invariant). |
| Density independence | `table-metrics.test.ts` | A pinned kind's px survives density preset changes and densityFactor changes. |
| Inheritance walk | `table-metrics.test.ts` | `summary` inherits `data`'s ratio when summary has no override; `section-header` inherits `group-header`. |
| Inheritance with override | `table-metrics.test.ts` | Setting `data`'s ratio propagates to `summary` unless `summary` is set. |
| Drag commit | `tests/browser/row-edge-resize.browser.ts` | Puppeteer-mounted widget; drag simulates; pin commits; row height updates. |
| Drag pointercancel | `tests/browser/row-edge-resize.browser.ts` | Drag interrupted by pointercancel doesn't commit; state restored. |
| R↔TS parity | `tests/testthat/test-parity-row-kind-heights.R` | R-side cascade resolution matches TS-side via V8 round-trip across all 5 layers. |
| Visual regression | `tests/visual/output/` | Forest plots with various row-kind ratios; baseline re-shot once at landing. |

---

## 37. Phase-5 open design questions

### Q-P5.1 — Inheritance graph: hard-coded or theme-configurable?

**RESOLVED 2026-06-02.** Hard-coded. `KIND_INHERITANCE = { summary: "data", "section-header": "group-header" }`. Fixed semantic relationship; user extension would invite footguns; future need = manifest change. See Decisions log.

### Q-P5.2 — Layer 4 constructor override naming: `row_heights` vs `row_height_ratios`?

**RESOLVED 2026-06-02.** `row_heights`. Matches handoff and shipped pin-layer vocabulary; docstring clarifies "ratios, not absolute px." See Decisions log.

### Q-P5.3 — Settings-panel control: extend `SpacingControl` or new `RowKindHeightsControl`?

**RESOLVED 2026-06-02.** New dedicated `RowKindHeightsControl.svelte`. Per-kind heights are a distinct concern (cascade-driven); dedicated control keeps logic focused; cleaner for Stage 3 redesign. See Decisions log.

### Q-P5.4 — Drag-handle overlay layer: separate Svelte component or rendered inside `TabvizPlot.svelte`?

**RESOLVED 2026-06-02.** Separate `RowEdgeHandles.svelte` component mounted as a sibling layer over `TabvizPlot.svelte`. Matches existing overlay pattern; testable in isolation via the browser harness. See Decisions log.

### Q-P5.5 — `release_all_row_kind_heights` granularity: per-kind only, or all layers per kind?

**RESOLVED 2026-06-02.** Per-kind release clears all user-set layers 3–5 for that kind. Falls back to layers 1–2. Pin-only release exists as `release_row_kind_height_pin` for the more specific case. See Decisions log.

### Q-P5.6 — Drag-up beyond content minimum: clamp or allow shrink?

**RESOLVED 2026-06-02.** Clamp at content minimum with visual feedback (handle bounces back). Can't shrink below visible content. Matches `sizing-model.md §8`. See Decisions log.

---

## 38. Phase-5 Decisions log

> Populated as Phase-5 questions are resolved.

### 2026-06-02 — Q-P5.1 closed: inheritance graph is hard-coded

**Decision:** `KIND_INHERITANCE = { summary: "data", "section-header": "group-header" }` is a frozen const in the resolver, not a user-configurable input. **Rationale:** the inheritance encodes a semantic relationship (`summary` rows are visual extensions of `data` rows; `section-header` is a sub-form of `group-header`) that doesn't vary meaningfully across themes. User-configurability would invite footguns ("summary inherits from spacer" produces nonsense). The two-edge graph is small; if a real future need emerges (e.g. a new RowKind needs an inheritance edge), it's a manifest extension during a later sprint.

### 2026-06-02 — Q-P5.2 closed: layer-4 constructor override field is named `row_heights`

**Decision:** the per-spec constructor override field on `forest_plot()` is `row_heights = list(summary = 1.5, ...)`. Values are ratios (relative to the resolved `rowHeight`). Docstring clarifies "values are ratios, not absolute px." **Rationale:** matches the existing handoff vocabulary; matches the shipped pin-layer slice name (`rowKindHeights`); avoids renaming the already-shipped pin API. Consistency in naming across the cascade's layers (theme-level, constructor-level, pin-level) reduces user friction.

### 2026-06-02 — Q-P5.3 closed: dedicated `RowKindHeightsControl.svelte` for settings panel

**Decision:** the settings-panel control for per-kind heights is a new `srcjs/src/components/ui/RowKindHeightsControl.svelte`, not an extension of `SpacingControl.svelte`. **Rationale:** per-kind heights are a distinct concern (cascade-driven, with layered resolution and per-layer "where does this value come from" display) versus the flat spacing tokens `SpacingControl` already handles. A dedicated control keeps logic focused; the Stage 3 redesign can iterate on each control file in isolation; the badge UI showing "default / theme / pin" provenance fits naturally in a kind-specific control but would clutter the spacing one.

### 2026-06-02 — Q-P5.4 closed: drag-handle overlay is a separate `RowEdgeHandles.svelte` component

**Decision:** the row-edge drag handles render via a new `srcjs/src/components/controls/RowEdgeHandles.svelte` component mounted as a sibling overlay layer above `TabvizPlot.svelte`. **Rationale:** matches the existing overlay pattern (`TabvizOverlays.svelte` for header floats, `ColumnDragHandle.svelte` for column resize). Self-contained pointer-capture + drag-state logic; testable in isolation via the puppeteer browser harness (`tests/browser/row-edge-resize.browser.ts`). The row-render loop in `TabvizPlot.svelte` stays focused on cell content; the overlay layer owns interaction affordances.

### 2026-06-02 — Q-P5.5 closed: per-kind release clears all user-set layers 3–5

**Decision:** `release_row_kind_heights(theme, kind)` clears the theme default (layer 3), constructor override (layer 4), and pin (layer 5) for that kind in one call; the resolved height falls back through layers 2 → 1. A separate `release_row_kind_height_pin(theme, kind)` exists for the pin-only case. **Rationale:** user intuition for "release this kind's height" is "go back to default," not "go back to whatever I set most recently." The full reset is the common case; pin-only release is the precise case (named accordingly). Matches the symmetry of `release_role` (clears the user override) vs. `release_all_roles` (clears all user overrides).

### 2026-06-02 — Q-P5.6 closed: drag-down clamps at content minimum with visual feedback

**Decision:** when a user drags a row's bottom edge below the content's natural height, the drag handle clamps and provides visual feedback (a brief bounce; the row height stops shrinking at the content floor). The pin commits the clamped value, not the attempted-shrunk value. **Rationale:** matches `sizing-model.md §8` ("drag-down clamps at the per-row content minimum, with feedback, since you can't shrink below content without clipping"). Clipping is rarely intentional; clamping teaches the user "this is the floor." Aligns with the row-homogeneity invariant (uniform height keeps the grid reading as a grid).

---

# Phase 6 — migration plan + branch rhythm + visual regression

This phase covers the **mechanics** of executing Stage 1: the long-lived `feat/theme-rework` branch, the internal commit order, the consumer-migration sequence, the visual regression strategy across the sprint, and the v3 deletion checklist.

## 39. Branch model

### 39a. The lone feat branch

Stage 1 runs on `feat/theme-rework`, branched from `main` at the start of the sprint. Single landing at the end. **No incremental merges to main during the sprint** (per clean-break commitment, vision doc §4c).

The branch is synced from `main` regularly via merge or rebase (preference TBD per Q-P6.1). Sync events absorb any concurrent main-side work (bug fixes, small features outside theme territory) but do not split the substrate work into multiple landings.

### 39b. Branch lifetime

Expected duration: **multi-week** (4–8 weeks plausible based on the scope catalog in §0). The branch lives until:
1. All Phase 1–5 deliverables are implemented + tested + visually validated.
2. The drift gates (`COMPONENT_TOKENS` + `VARIANT_ATTRIBUTES`) are green.
3. Visual baselines are re-shot and reviewed.
4. R↔TS parity tests pass.
5. The Quarto docs build succeeds (including the Fallback Triptych live render).
6. The full TS + R test suites pass.
7. Visual regression diff against pre-sprint main is reviewed; intentional differences accepted; unintended differences fixed.

Then `feat/theme-rework` merges to `main` in one PR.

---

## 40. Internal commit order on the branch

The vision doc §5 names the internal arc rhythm as `M1 → M2 → M3 → M4 → row-kind cascade → color capabilities`. Phase 6 refines this into an executable sequence.

### 40a. Sequence

| Step | Scope | Why this order |
|---|---|---|
| **1. Manifest skeleton** | `srcjs/src/lib/theme/component-tokens.ts` with ~150 entries; `types/theme-roles.ts`; drift-gate test (failing initially). | Locks the consumer contract before anyone migrates consumers. The drift gate failing-initially is normal — it shrinks during step 2. |
| **2. CSS-variable wire emitter** | `theme-css.ts` rewrite emitting the four-layer `--tv-*` namespace; `theme-runtime.css` written. | Provides the wire consumers will read from. Resolver still produces a JS object internally; new CSS-var path runs in parallel inside the branch. |
| **3. Override schema + wire rewrite** | `theme-wire.ts` rewrite with `{role, ramp, grade}` overrides; `RoleBinding` type; `pinTokenByName` with error surface. | The override layer is independent of consumer migration; can land before consumers migrate. |
| **4. Resolver capability surface (Phase 4)** | Polarity flip, HC + RT modes, alpha companions, curves, off-ramp roles, status anchor coverage, new Tier-1 variant inputs. | Resolver rewrite happens once with the full capability set; touching it again post-substrate would defeat Q11 closure. |
| **5. Row-kind height cascade (Phase 5)** | Layers 1–4 resolution in `table-metrics.ts`; `RowKindHeightsControl.svelte`; `RowEdgeHandles.svelte` + browser harness; R modifiers. | New input vocabulary (`row_kinds.<kind>.heightRatio`) is added once with all other input changes (steps 3–4); affordances follow once resolution works. |
| **6. Consumer migration** | All ~30 renderer/UI files switch from `theme.foo.bar` reads to `var(--tv-foo-bar)`. Drift gate's `KNOWN_UNCONSUMED` shrinks toward zero. | Bulk mechanical work; the contract (step 1) and the wire (step 2) make this a single-file-at-a-time effort. Consumer migration only after the wire is stable. |
| **7. SVG-export pipeline rewrite** | `svg-generator.ts` (~4730 LOC) replaces inline-attribute paint with `var()` references; embeds `<style>` block from `theme-runtime.css`; pre-resolves OKLCH to hex. | The largest single-file rewrite. After consumers migrate (step 6), SVG export catches up to the new wire. |
| **8. R-side slimming** | `R/classes-theme.R` reduced to Tier-1 input classes only; `R/themes-api.R` extended with new modifiers (`set_polarity`, `set_role_binding`, etc.); R↔TS parity tests rewritten. | R-side follows TS once the TS shape is stable. R-side break is the last load-bearing change. |
| **9. Discovery + inspection helpers** | `list_component_tokens`, `inspect_token`, `contrast_report`, `diff_themes` ship in both R and JS. | These are wrappers over the now-stable resolver + manifest; no new architecture; ~3–4 days of R wrapping work. |
| **10. v3 dead-code deletion** | All `*-v3` files, V2-style shims, dead S7 classes, deprecated variables, unused exports purged. | Once consumers + SVG + R are on the new path, v3 deletion removes the parallel surfaces. |
| ~~11. 18-preset polarity audit~~ | **DEFERRED to Stage 4** (per 2026-06-02 Decisions log). Presets are quarantined during the substrate sprint. | The minimal testing set (`dev-light` + `dev-dark` per §28d) exercises the polarity mechanic; full 18-preset audit happens when Stage 4 reimagines them. |
| **11. Visual baseline shoot** | Baselines for the minimal testing set (`dev-light` and `dev-dark` across simple + complex spec shapes, all three modes) are generated. **These are FRESH baselines, not deltas against v3.** | Stage 1's visual surface is the minimal testing set; v3 baselines are not maintained. Per the 2026-06-02 Decisions log: visual change is accepted, not minimized. |
| **12. Doc updates** | `theme-rationalization-arc.md` marked superseded; `r-ts-parity-notes.md` updated; `NEWS.md` populated; new docs (`theme-cascade-stage-1-design.md` — this doc) marked LANDED. | Documentation sweep before merge. |

Each step has its own internal commits for hygiene; steps are sequential because each depends on the previous (with two exceptions noted below).

### 40b. Permitted parallelism

Most steps are sequential but two can run in parallel with adjacent steps:

- **Step 3 (overrides)** can begin in parallel with step 2 (CSS wire) — they touch different modules.
- **Step 9 (discovery helpers)** can begin in parallel with step 10 (v3 deletion) — they're additive R wrappers.

Other parallelism is risky; concurrent work on `theme-adapter.ts` (deleted in step 2) and `svg-generator.ts` (rewritten in step 7) would collide.

### 40c. Per-step PR-style internal commit message convention

Internal commits on the branch use a prefix matching the step:

```
[M1] component-tokens.ts: scaffold + 30 row-cluster entries
[M1] component-tokens.ts: complete header + cell + plot clusters
[M2] theme-css.ts: emit --tv-anchor-* + --tv-ramp-*
[M2] theme-runtime.css: row-state rules
[M3] theme-wire.ts: ThemeWire type + setRoleBinding
...
[M7] svg-generator.ts: row cluster — replace inline fills with var(--tv-row-*)
```

Internal commits don't need to be atomic in the "ready for review" sense; they're for branch hygiene only. The full sprint lands as one squashed PR (or as a merge commit with internal history preserved — Q-P6.2).

---

## 41. Visual regression strategy on the branch

**Framing per 2026-06-02 Decisions log:** the substrate move WILL produce visual differences across most widgets. **That is OK.** Visual regression tooling stays useful (it tells us what changed), but the framing shifts from "did anything change → is it intended" to "what changed → is each change principled." The bar for "is this OK?" is not "matches v3" but "is this a deliberate adaptation of the cascade's capabilities."

**Hard constraint that remains:** WYSIWYG (browser ↔ SVG parity). The two renderers must agree with each other regardless of how either differs from v3.

### 41a. Continuous validation during the sprint — what's actually checked

The `tabviz::render_visual_tests()` harness runs on the branch at every step's completion, restricted to the minimal testing set (§28d — `dev-light` + `dev-dark` themes × simple + complex spec shapes × three modes = ~12 PNGs). The PNG outputs are reviewed by the implementer (Claude or human collaborator) for:

- **Bug indicators** — content clipped, text rendered as boxes, missing rows, wildly wrong colors, etc. These are still regressions worth catching.
- **Cascade consistency** — does an alt-row token consistently differ from the base-row token across all visible rows? Did the rules variant render correctly?
- **WYSIWYG parity** — browser PNG vs. SVG export PNG for the same theme + spec should match within ΔE_2000 > 2.0 (Q-P6.3).

**What we explicitly do NOT check during the sprint:**
- Color match against pre-sprint v3 baselines.
- Layout match against pre-sprint v3 baselines.
- Aesthetic preservation of v3 presets (presets are quarantined per §28).

### 41b. Browser ↔ SVG parity validation

The Fallback Triptych (§29) renders the `dev-light` theme under all three modes (standard / RT / HC). A parity harness compares the browser DOM rendering (Puppeteer screenshot) against the SVG export rendering (V8 + rsvg → PNG) for each cell of the triptych. The two paths must agree within ΔE_2000 > 2.0 (Q-P6.3).

This harness is built during the sprint as part of the `<style>`-in-SVG embedding work (Phase 3 §18). It runs as a browser-side test (`tests/browser/wysiwyg-parity.browser.ts`). It is the **load-bearing** parity check during Stage 1 — failure here is a sprint-blocking issue; failure of a "matches v3" check is not.

### 41c. Pre-merge baseline shoot (NOT a re-shoot)

At step 11, baselines for the minimal testing set are generated **fresh** (not as deltas vs. v3 main). The minimal testing set is small (~12 PNGs) so the review is fast. Each baseline is reviewed for cascade correctness — does the substrate produce coherent output for the dev themes — not for v3-fidelity.

v3 preset baselines (`tests/visual/baselines/*.png` for the 18 production presets) are **deleted from main** when the substrate sprint lands. Stage 4 generates fresh baselines for each reimagined preset; until then, the 18-preset visual surface is intentionally absent from the test suite.

### 41d. Why this is appropriate for the substrate sprint

The substrate sprint is a coordinated revolution. The v3 visual fidelity check would be expensive (review 18 presets × {light, dark} × {browser, SVG}), low-signal (most differences are intentional once you understand the cascade move), and would create migration pressure on substrate decisions that should be made on substrate merits. Removing the check liberates the sprint to make the right architectural choices; Stage 4 reimagines visuals deliberately on top of the right substrate.

---

## 42. v3 deletion checklist

The dead-code deletion in step 10 systematically removes every v3 artifact. The checklist:

### 42a. TS-side deletions

- [ ] `srcjs/src/lib/theme/theme-adapter.ts` — deleted (replaced by manifest walking in `theme-css.ts`).
- [ ] `srcjs/src/types/theme-resolved.ts` — slimmed: removes cluster types (`WebTheme`, `RowCluster`, `HeaderCluster`, etc.); keeps `ResolvedTheme` for the new shape.
- [ ] `srcjs/src/lib/semantic-styling.ts` — refactored or deleted; current resolveSemanticBundle replaced by `resolveActiveRole` on the manifest.
- [ ] Any `theme-*-v3.ts` files — renamed to drop the `-v3` suffix (per naming Decisions log: no v4 suffix anywhere).
- [ ] All v3 dotted-path override calls in stores and UI controls — replaced with `setRoleBinding` / `pinTokenByName`.

### 42b. R-side deletions

- [ ] `R/classes-theme.R` — every S7 class except `ThemeInputs` removed. `WebTheme`, `Surfaces`, `Content`, `Dividers`, `RowCluster`, `CellCluster`, `FirstColumnCluster`, `PlotScaffold`, `AccentRoles`, `Semantics`, `SlotRole`, `TextRoles`, `MarksRecipes`, `AxisConfig`, `Layout`, etc.
- [ ] `R/utils-deserialize-resolved.R` — rewritten to consume the CSS-var map directly; no S7 reconstruction.
- [ ] `R/themes-api.R::web_theme()` — extended to accept the new variant inputs; v3 surface preserved where compatible, broken cleanly where not.
- [ ] `R/themes.R`, `R/themes-design.R`, `R/themes-lotr.R` — **quarantined per 2026-06-02 Decisions log** (preset deferral). Either: (a) remove the files entirely from the substrate-sprint branch and let Stage 4 author fresh ones from scratch, or (b) reduce each preset to a no-op stub that throws "preset under reimagining, see Stage 4" until Stage 4 lands. Either way, the v3 anchor + cluster definitions in these files are NOT translated to `ThemeInputs`. Stage 1 ships `srcjs/src/lib/theme/dev-themes.ts` with `dev-light` and `dev-dark` as the only available themes during sprint development.
- [ ] V2-style compatibility shims (per `theme-rationalization-arc.md` lines 119–121) — already cleaned during V3 cutover; verify nothing reintroduced.

### 42c. Docs + test deletions

- [ ] `docs/dev/theme-rationalization-arc.md` — banner updated: "superseded by `theme-cascade-stage-1-design.md` 2026-06-02".
- [ ] R-side parity tests under `tests/testthat/test-parity-*.R` — updated to match new shape; old parity tests for deleted classes removed.
- [ ] `srcjs/src/lib/theme/theme-resolve.test.ts` — rewritten for the new resolver pipeline.
- [ ] Outdated CLAUDE.md ontology entries — updated to reference the new file/function names if any moved.

---

## 43. Risk register

### 43a. Identified risks

| Risk | Mitigation | Severity |
|---|---|---|
| `svg-generator.ts` (~4730 LOC) rewrite breaks SVG export silently for an edge-case feature. | Step 7 has its own sub-checklist of every theme.* read site (already mapped to a manifest entry). Browser harness compares DOM and SVG outputs for the minimal testing set. | High |
| ~~18-preset polarity audit reveals more presets need re-anchoring than expected, blowing sprint estimate.~~ | **NO LONGER APPLIES.** Preset porting deferred to Stage 4 per 2026-06-02 Decisions log. Stage 1 develops against the minimal testing set (§28d) only. | Eliminated |
| R↔TS parity tests reveal silent shape drift across the rewrite. | Parity tests are rewritten alongside the rewrites (step 8). New tests assert the entire CSS-var map round-trips via V8. | Medium |
| Drift gate's `KNOWN_UNCONSUMED` list balloons during step 6 as consumers migrate piecemeal. | Gate failing on net-new entries is tolerated; gate failing on net-growth between commits triggers a stop. Step 6 has internal commits per consumer file. | Low |
| Long-lived branch falls badly behind main, sync becomes painful. | Sync from main happens at fixed cadence (weekly, plus immediately after any large main-side merge). The branch's commits are append-only on a long-lived branch; main's commits sync in via merge commits. | Medium |
| `data-row-token` paint-tool migration (Phase 3 §16b) misses an existing v3 paint-tool capability and ships a regression. | Phase 3 closure (Q-P3.7) committed to paint-tool substrate in Stage 1; the existing v3 paint-tool API is preserved at the R/JS surface, only the underlying wiring changes. R↔TS parity test covers all paint-tool tokens. | Low |
| Stage 4 preset reimagining surfaces a substrate gap (a capability needed by a preset not built into the cascade). | Defer the preset; ship Stage 4 with the presets that work; the gapped capability becomes a Stage 5+ extension. Pre-release license to defer; the minimal testing set verified substrate completeness during Stages 1–3. | Medium |

### 43b. What we don't know we don't know

Some inherent risk lives in the consumer-migration step (step 6). The inventory captured ~30 consumer files, but the regex-based manifest drift gate catches CSS-var references — not necessarily JS-side `theme.foo.bar` reads. **Recommendation:** before step 6 begins, a tsc-based scan of all `theme.` field accesses across `srcjs/src/` produces a complete consumer list. The scan is ~1 day of work; surfaces forgotten consumers before they cause migration bugs.

---

## 44. Phase-6 open design questions

### Q-P6.1 — Sync from main: merge or rebase?

**RESOLVED 2026-06-02.** Merge. Preserves auditability of sync sequence; safer for multi-week branches; no force-push needed. See Decisions log.

### Q-P6.2 — Final merge to main: squash or merge commit?

**RESOLVED 2026-06-02.** Merge commit preserving full branch history. The substrate sprint's internal arc (M1 → M7) is browseable for future archaeology. See Decisions log.

### Q-P6.3 — Visual-diff perceptual threshold

**RESOLVED 2026-06-02.** Perceptual ΔE_2000 > 2.0 threshold. Tolerates AA noise; matches "just-noticeable difference" boundary; catches meaningful color shifts the renderer-path change might introduce. See Decisions log.

### Q-P6.4 — `setSpec`/`$state.raw` discipline during the sprint

**RESOLVED 2026-06-02.** Add an eslint rule. ~30 lines of config; mechanical enforcement; future-proof against the failure mode that caused the 2026-05-25 regression. See Decisions log.

### Q-P6.5 — Pre-step-6 consumer audit: tsc scan or grep?

**RESOLVED 2026-06-02.** tsc-based scan via TS compiler API. Authoritative; catches dynamic property accesses; ~1 day of investment that pays back via reduced migration bugs. See Decisions log.

---

## 45. Phase-6 Decisions log

> Populated as Phase-6 questions are resolved.

### 2026-06-02 — Q-P6.1 closed: sync from main via merge, not rebase

**Decision:** during the long-lived `feat/theme-rework` branch, periodic syncs from `main` are done via `git merge main` (not `git rebase main`). **Rationale:** the branch is long-lived enough that rebase risks losing context — which sync absorbed which main-side commit becomes harder to audit, and `push --force` to a shared branch introduces collaboration friction. Merge commits keep the sync sequence visible in the branch history and preserve branch-commit hashes.

### 2026-06-02 — Q-P6.2 closed: final merge to main preserves branch history (merge commit, not squash)

**Decision:** when `feat/theme-rework` merges to `main`, the merge preserves the branch's full internal commit history (~50–100 commits). No squash. **Rationale:** the substrate sprint's internal arc (M1 → M2 → M3 → M4 → row-kind → resolver → consumer migration → SVG → R-side → deletion) is significant architectural sequencing that future agents will benefit from being able to browse. Main's history isn't pristine to begin with (per CLAUDE.md examples); clarity beats compactness. Trade-off accepted: main gains ~50–100 commits whose individual content is rarely consulted but whose presence aids archaeology.

### 2026-06-02 — Q-P6.3 closed: visual-diff perceptual threshold is ΔE_2000 > 2.0

**Decision:** during continuous validation on the branch, visual diffs use a perceptual threshold of ΔE_2000 > 2.0 to trigger investigation. Pixel-level identity is not required. **Rationale:** the substrate move changes the renderer path from inline-literal paint attributes to `var(--tv-...)` references; tiny float-precision differences are expected and irrelevant. The ΔE_2000 > 2.0 threshold is the standard "just-noticeable difference" boundary — it catches meaningful color shifts a human reviewer would notice while ignoring anti-aliasing noise and float-precision artifacts.

### 2026-06-02 — Q-P6.4 closed: add eslint rule for `$state.raw` mutation discipline

**Decision:** add an eslint rule that flags direct mutations to fields under `spec.theme.*` (and similar `$state.raw`-held state). The rule is configured to error in CI. **Rationale:** ~30 lines of eslint config. The CLAUDE.md `2026-05-25` regression demonstrated that manual reviewer audits don't reliably catch this failure mode — the bug was a `previewThemeField` slice method that mutated `spec.theme.spacing.field = v` directly, invisibly bypassing Svelte's `$state.raw` reactivity. Mechanical enforcement scales beyond Stage 1 and prevents future regressions of the same pattern.

### 2026-06-02 — Q-P6.5 closed: tsc-based scan for pre-step-6 consumer audit

**Decision:** before consumer migration begins (step 6 of the internal sprint sequence), a tsc-API-based scan enumerates every `theme.X.Y` access across `srcjs/src/`. The output is a complete consumer list used to validate the manifest's `consumedBy` declarations and to drive the migration checklist. **Rationale:** authoritative coverage including dynamic property accesses and computed access patterns that regex would miss. ~1 day of investment. The substrate move is the right moment to do this audit definitively; doing it later costs more than doing it before migration begins. TS compiler API is established in the project's build pipeline.

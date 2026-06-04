# V4 Theme Authoring API — Coherence Audit

Audit of `feat/v4-input-surface` (9 commits, through `e46b4f7`). Research only; no files modified. Findings are concrete + actionable, organized by the 8 audit strands in the task spec.

---

## 1. Naming consistency

### 1.1 `densityFactor` (camelCase) vs everything-else (snake_case) on the wire

`srcjs/src/types/theme-inputs.ts:132` declares the wire field as **`densityFactor`** (camelCase). Every other compound field in the same interface uses snake_case: `type_base_size:114`, `type_scale_ratio:117`, `type_weights:120`, `shell_mode:110`, `shell_texture:98`, `glow_intensity`, `gradient_shell_intensity`, etc.

- R S7 slot is `density_factor` (`classes-theme.R:142`).
- R `web_theme()` argument is `density_factor` (`themes-api.R:240`).
- R `theme_inputs_to_json()` emits the JSON key as `densityFactor` (`themes-api.R:109`) — i.e. R deliberately re-cases for TS.

**Fix:** rename the wire field to `density_factor`. One TS site to update (`theme-inputs.ts:132`), 9 read-sites in the resolver (`resolve-theme.ts:337,604,605,675,676` etc), the R emit (`themes-api.R:109`), and any preset overrides (none — presets use `densityFactor` only inline as TS, e.g. `theme-presets-inputs.ts:270` `densityFactor: 0.9`).

### 1.2 `mode` vs `polarity` on the wire (R-side hardcodes `mode = "standard"`)

`theme-inputs.ts:30` defines `ThemeMode = "standard" | "high-contrast" | "reduced-transparency"` and the `mode` field at `:71`. The resolver reads `inputs.mode` in 7+ branches (`resolve-theme.ts:185, 248, 255, 264, 270, 361, 367, 505`). But:

- R `ThemeInputs` S7 class has **no `mode` slot at all** (`classes-theme.R:95-189` lists every property; no `mode`).
- `theme_inputs_to_json()` hardcodes `mode = "standard"` (`themes-api.R:102`).
- `web_theme()` doesn't accept a `mode` argument.
- `set_mode()` (`themes-api.R:424`) is a deprecated alias for `set_polarity()` — it does NOT touch the accessibility-mode axis; it sets polarity. Comment on `:418` confirms the intent: "v4 reserves `mode` for the accessibility axis."

**Fix:** add `mode` slot to `ThemeInputs` (R), add `mode` argument to `web_theme()`, emit it on the wire instead of the hard-coded constant. Either rename `set_mode → set_accessibility_mode` and add a new (real) `set_mode` for the accessibility axis, or pick distinct names (`set_a11y_mode` / `set_contrast_mode`). The current state means an R user cannot exercise the entire HC / RT branch of the resolver.

### 1.3 Field-name patterns: nested objects vs flat strings

`theme-inputs.ts:163` `geometry` and `:187` `effects` use **nested objects** (`geometry.radius.sm`, `effects.glow_intensity`). `:139` `curves` is also nested (`curves.neutral`). On the wire, R nests these correctly (`themes-api.R:73-97`). But the R **S7 slots** are flat:

| Wire shape | R S7 slot name |
|---|---|
| `geometry.radius.sm` | `geometry_radius_sm` (`classes-theme.R:173`) |
| `geometry.border_width.hair` | `geometry_border_width_hair` (`classes-theme.R:177`) |
| `effects.glow_intensity` | `effects_glow_intensity` (`classes-theme.R:184`) |
| `curves.neutral` | `curve_neutral` (`classes-theme.R:154`) singular!|
| `type_weights.regular` | `type_weight_regular` (`classes-theme.R:165`) singular! |
| `anchors.paper.L` | `anchors_paper_L` (`classes-theme.R:101`) |
| `status.positive.L` | `status_positive_L` (`classes-theme.R:121`) |
| `fonts.body` | `font_body` (`classes-theme.R:134`) singular! |

The flat-slot convention is forced by S7's poor compose-with-nested-objects story (commented at `classes-theme.R:65-69`). The inconsistency is **whether the prefix is pluralized**:

- `anchors_*`, `status_*`, `geometry_*`, `effects_*` → match the wire key (plural for `anchors`, `status`, `effects`; singular for `geometry`).
- `curve_*` (singular) vs wire `curves` (plural).
- `font_*` (singular) vs wire `fonts` (plural).
- `type_weight_*` (singular) vs wire `type_weights` (plural).

**Fix:** Make the R slot prefix mirror the wire key 1:1. Rename `curve_neutral → curves_neutral`, `curve_brand → curves_brand`, `curve_accent → curves_accent`; `font_body → fonts_body`, `font_display → fonts_display`, `font_mono → fonts_mono`; `type_weight_* → type_weights_*`. Touches the S7 class definition (`classes-theme.R`), `theme_inputs_to_json()` (`themes-api.R`), every preset constructor (R-side, but they don't actually use the slot names — they go through `web_theme()`), and any tests that reference the slot names by string (search for `"curve_neutral"` / `"font_body"` / `"type_weight_"`).

### 1.4 Order: `status_positive_L` vs `anchors_paper_L`

Both follow `<group>_<member>_<axis>`. Consistent. Good.

### 1.5 `categorical` (vs `categorical_scheme`)

The field name `categorical` is **flat-equivalent of "categorical_scheme"** — it holds a scheme NAME, not a categorical palette body. Comment at `theme-inputs.ts:32-33` defines the type as `SchemeName = string`. Same pattern for `sequential` and `diverging`.

The semantic naming clash is mild — a user reading `categorical: "okabe_ito"` sees a scheme name. But the R `set_categorical(theme, scheme)` setter (`themes-api.R:434`) takes a `scheme` parameter, demonstrating the underlying noun. Consider renaming the three fields to `categorical_scheme`, `sequential_scheme`, `diverging_scheme` for self-documentation. Low priority.

### 1.6 `mode` overload — accessibility axis vs polarity vs shell_mode vs ThemeMode

The word **mode** appears in 4 distinct ways:

1. `inputs.mode` = accessibility (`standard | high-contrast | reduced-transparency`).
2. `set_mode()` R-alias for polarity (light/dark).
3. `shell_mode` = shell/paper layout mode (`flush | raised | float | transparent`).
4. R class-internal `ThemeMode` type doesn't exist; TS exports it.

**Fix:** `set_mode` → `set_accessibility_mode` (or drop the alias entirely, since `set_polarity` is the documented name).

---

## 2. Validation parity (R ↔ TS)

R has runtime checks via `checkmate::assert_*` + S7 `validator =`. TS has type signatures only. Per-field audit:

| Field | TS type | R validation | Gap |
|---|---|---|---|
| `anchors.paper.L` | `number` | `[0,1]` (`classes-theme.R:46`) | TS accepts any number |
| `anchors.paper.C` | `number` | `[0, 0.5]` (`classes-theme.R:49`) | TS accepts any number |
| `anchors.paper.H` | `number` | `[0, 360)` (`classes-theme.R:52`) | TS accepts any number |
| (same for ink, brand, accent, status.*) | | | |
| `polarity` | `"light" \| "dark"` | enum check (`classes-theme.R:205`, `themes-api.R:253`) | TS catches via type, OK |
| `mode` | `ThemeMode` enum | **N/A — no R slot** | R-side gap (§1.2) |
| `categorical` | `string` (any) | `assert_string` (`themes-api.R:254`) | None — neither checks against registered scheme names |
| `density` | enum | enum check (`classes-theme.R:208`) | TS literal type OK |
| `densityFactor` | `number` | `[0.5, 2]` (`classes-theme.R:201, themes-api.R:256`) | TS accepts any number; the resolver later clamps to `[0.5, 2]` (`resolve-theme.ts:676`), so silently misuses but doesn't crash |
| `shell_mode` | enum | enum check (`themes-api.R:260`) | TS literal type OK |
| `shell_texture` | enum | enum check (`themes-api.R:261`) | TS literal type OK |
| `type_base_size` | `number` | `[8, 32]` (`themes-api.R:262`) | TS accepts any number |
| `type_scale_ratio` | `number` | `[1.05, 1.6]` (`themes-api.R:263`) | TS accepts any number |
| `type_weights.*` | `number` | `[100, 900]` (`typography-api.R:73-76`) | TS accepts any number. `web_theme()` only `assert_list` — no per-key range check (`themes-api.R:264`) |
| `curves.*` | enum | **no R enum check on the per-key strings**; `assert_list` only (`themes-api.R:265`) | Neither side enforces the enum. R silently passes through; TS resolver does not validate. |
| `geometry.radius.*` / `border_width.*` | `number` | `[0, 999]` (`classes-theme.R:212-220`) — only in validator, not in `web_theme()` (only `assert_list`) | TS accepts any number |
| `effects.glow_intensity` | enum | enum check (`classes-theme.R:222-225`) | TS literal type OK; **but `web_theme()` only `assert_list(effects)` — passes through a typo'd intensity without checking until S7 validator runs**. Actually, the slot setter on `:324` will fail S7 validation. |
| `effects.glow_anchor` | enum | enum check (`classes-theme.R:226-229`) | TS literal type OK |
| `effects.gradient_shell_angle` | `number` (any) | `[0, 360]` (`classes-theme.R:233-237`) | TS accepts any number; the resolver `:578` uses it raw |
| `effects.elevation` | enum | enum check (`classes-theme.R:238-241`) | TS literal type OK |
| `row_kinds` | `Partial<Record<...>>` | **N/A — no R slot, not emitted on wire** | Strand 6 finding |

### 2.1 TS authoring authors can construct broken themes

The TS `webTheme()` function (`theme-api.ts:70`) and `defineInputs()` (`theme-presets-inputs.ts:96`) do **zero runtime validation**. A TS author writing `defineInputs({brand: "#0099CC"}, { densityFactor: 5, effects: { glow_intensity: "ultra-neon" }, type_base_size: 200 })` builds successfully, the resolver clamps `densityFactor` silently, and the unknown `glow_intensity` falls through `resolveEffectsComputed` returning `"0px"` for blur/spread.

**Fix:** Add a single `validateThemeInputs(inputs): ThemeInputs` in `srcjs/src/lib/theme/theme-validate.ts` (file already exists at `theme-validate.ts` — see if it has the validator). Call it from `defineInputs`, `webTheme`, and `resolveTheme`. Mirror the R validator's range + enum checks.

### 2.2 R validator and `web_theme()` checkmate path are partially redundant

E.g. `density_factor` is checked twice (in `web_theme()` via `checkmate` and again in the S7 validator). The S7 validator alone is the canonical check. The `web_theme()` `checkmate::assert_*` block does duplicate work — but also is the only check for `geometry`/`effects` content (only `assert_list`). The current contract: `web_theme()` does shallow checks; S7 enforces per-leaf on construction. Acceptable, but the `assert_list(geometry/effects/curves)` lines are misleading because their inner content is only checked by the S7 validator when constructed via the slot path. Consider per-content validation in `web_theme()` for friendlier error messages.

---

## 3. Default-value sources

### 3.1 Duplicated defaults at risk of R/TS drift

| Concept | TS source | R source | Drift risk |
|---|---|---|---|
| Paper L (light polarity) | `theme-presets-inputs.ts:58` `DEFAULT_PAPER_L = 0.987` | `themes.R:16` `PRESET_PAPER_L <- 0.987` AND `themes-api.R:136` `DEFAULT_PAPER_ANCHOR$L = 0.987` AND `classes-theme.R:101` slot default `0.987` | **4 copies** |
| Ink L (light polarity) | `theme-presets-inputs.ts:60` `DEFAULT_INK_L = 0.180` | `themes.R:18` `PRESET_INK_L <- 0.180` AND `themes-api.R:137` `DEFAULT_INK_ANCHOR$L = 0.180` AND `classes-theme.R:104` slot default `0.180` | **4 copies** |
| Paper C default | TS `theme-presets-inputs.ts:78` `0.005` | R `themes.R:41` `paper_C = 0.005` AND `classes-theme.R:102` slot default `0.005` | 3 copies |
| Ink C default | TS `:79` `0.01` | R `themes.R:42` `ink_C = 0.010` AND `classes-theme.R:105` slot default `0.010` | 3 copies |
| Brand anchor default | `classes-theme.R:107-109` `L=0.665, C=0.130, H=235` | None elsewhere | unique-but-magic-number |
| `DEFAULT_BRAND_HEX` | None | `themes-api.R:138` `"#0099CC"` | R-only fallback |
| `DEFAULT_STATUS_ANCHORS` | `theme-resolve.ts:36-44` | NA-defaulted on R side; defers to TS | OK (single source) |
| `DEFAULT_RADIUS` | `resolve-theme.ts:489` `{sm:2, md:6, lg:10, pill:999}` | none (deferred) | OK |
| `DEFAULT_BORDER_WIDTH` | `resolve-theme.ts:494` `{hair:0.5, thin:1, regular:1.5, thick:2.5}` | none (deferred) | OK |
| `DEFAULT_RAMP_CURVES` | `curves.ts:51` `{neutral:"ease", brand:"linear", accent:"linear"}` | none (deferred) | OK |
| `DENSITY_PRESETS` (px tables) | `resolve-theme.ts:608` AND `theme-adapter.ts:38` (v3 path) | none (deferred) | **TS-side internal duplication** |
| Default font body | `theme-adapter.ts:79` `DEFAULT_FONT_BODY = "system-ui, -apple-system, sans-serif"` | `themes-api.R:299` `"system-ui, -apple-system, sans-serif"` | 2 copies |
| Default font mono | `theme-adapter.ts:106` `"ui-monospace, monospace"` | (R passes NA, TS fills default) | OK |
| `densityFactor` clamp range `[0.5, 2]` | `resolve-theme.ts:676` AND `theme-adapter.ts:67` | `themes-api.R:256` AND `classes-theme.R:202` | 4 copies |
| Type-scale ratio range `[1.05, 1.6]` | None (just type `number`) | `themes-api.R:263` AND `typography-api.R:51` | 2 R copies, no TS |
| Type weights range `[100, 900]` | None | `typography-api.R:73-76` | 1 copy |

### 3.2 The defaults that drove the audit prompt — verified
- `DEFAULT_PAPER_ANCHOR`/`DEFAULT_INK_ANCHOR` (R) and `DEFAULT_PAPER_L`/`DEFAULT_INK_L` (TS) currently agree numerically. **Pin one as authoritative** (TS, per the package vision); R should read from a single source. Options: (a) compute defaults on R-side via a one-shot V8 call to `getDefaultAnchors()`; (b) introduce an R-side `THEME_DEFAULTS` registry (single file) that R loads from a JSON sidecar generated at TS build time.

### 3.3 DENSITY_PRESETS lives twice TS-side

`resolve-theme.ts:608` (v4 path) and `theme-adapter.ts:38` (v3 path) both define density spacing tables. They DO drift in shape: `theme-adapter.ts` uses camelCase token names (`rowHeight`, `headerHeight`), `resolve-theme.ts` uses CSS-var names (`--tv-spacing-row-height`). Both must remain in sync until v3 path is purged (per Stage 1 §10 deferred).

**Fix (short-term):** Extract a shared `DENSITY_PRESETS_PX` constant keyed by token concept, derive both projections from it.

### 3.4 BMJ vs Cochrane font duplication

Every preset that uses Inter duplicates the body stack + the `web_font("Inter", "...")` URL. 5+ copies of the same Google Fonts URL across `R/themes.R`, `R/themes-design.R`, `R/themes-lotr.R`. A small registry (`FONT_URLS$inter`) would eliminate ~15 copy-paste sites.

---

## 4. Modifier API completeness (R `set_*`)

Inventory by file:

### `R/themes-api.R`
- `set_paper`, `set_ink`, `set_brand`, `set_accent` (anchors)
- `set_polarity` + deprecated `set_mode` alias
- `set_categorical` (only the categorical scheme — no `set_sequential` / `set_diverging`)
- `set_density(density, factor)`
- `set_header_style`, `set_first_column_style` (post-resolve variants)
- `set_inputs(...)` (batch)
- `set_spacing(...)` (post-resolve override)
- `set_theme_field(path, value)` (escape hatch)

### `R/typography-api.R`
- `set_fonts(body, display, mono)`
- `set_type_scale(base, ratio)`
- `set_type_weights(regular, medium, semibold, bold)`

### `R/shell-paper-api.R`
- `set_shell_mode(mode)`
- `set_shell_texture(texture)`

### Tier-1 axes vs setters (gaps)

| Tier-1 axis | Setter? | Notes |
|---|---|---|
| anchors.paper | `set_paper` | ✓ |
| anchors.ink | `set_ink` | ✓ |
| anchors.brand | `set_brand` | ✓ |
| anchors.accent | `set_accent` | ✓ (clearable) |
| polarity | `set_polarity` | ✓ |
| **mode** (accessibility) | **MISSING** | Underlying slot doesn't exist (§1.2) |
| density / density_factor | `set_density(density, factor)` | ✓ combined |
| categorical | `set_categorical(scheme)` | ✓ |
| **sequential** | **MISSING** | Use `set_inputs(sequential = ...)` |
| **diverging** | **MISSING** | Use `set_inputs(diverging = ...)` |
| fonts | `set_fonts(body, display, mono)` | ✓ |
| shell_mode | `set_shell_mode` | ✓ |
| shell_texture | `set_shell_texture` | ✓ |
| type_base_size + type_scale_ratio | `set_type_scale(base, ratio)` | ✓ |
| type_weights | `set_type_weights(...)` | ✓ |
| **curves** (neutral/brand/accent) | **MISSING** | Only via `set_inputs(curve_neutral = ...)` (raw S7 slot) |
| **geometry** (radius + border_width) | **MISSING** | Phase D feature; no setter; only via `set_inputs(geometry_radius_sm = ...)` (raw slot) |
| **effects** (glow/gradient/elevation) | **MISSING** | Phase D feature; no setter |
| **status anchors** | **MISSING** | No setter for `status_positive/negative/warning/info`; only via `set_inputs` raw slots |
| **row_kinds** | **MISSING** | Strand 6 — no slot, no setter |

### Shape inconsistency

- `set_density(density = NULL, factor = NULL)` — combined preset + factor in one call.
- `set_type_scale(base = NULL, ratio = NULL)` — combined two scalars (mirrors pattern).
- `set_type_weights(regular, medium, semibold, bold)` — flat scalar args.
- `set_fonts(body, display, mono)` — flat scalar args.

Hypothetical `set_curves(neutral = NULL, brand = NULL, accent = NULL)` would follow the same shape. `set_geometry(radius = list(...), border_width = list(...))` would mirror `web_theme()`'s named-list style. `set_effects(glow_intensity = NULL, glow_anchor = NULL, gradient_shell_intensity = NULL, gradient_shell_angle = NULL, elevation = NULL)` flat-arg or nested-list — should match `web_theme()`.

**Fix (recommended additions):**

```r
set_mode(theme, mode)                  # renamed from current alias
set_curves(theme, neutral=NULL, brand=NULL, accent=NULL)
set_geometry(theme, radius=NULL, border_width=NULL)   # named-list style, mirroring web_theme()
set_effects(theme, glow_intensity=NULL, glow_anchor=NULL,
            gradient_shell_intensity=NULL, gradient_shell_angle=NULL,
            elevation=NULL)
set_status(theme, positive=NULL, negative=NULL, warning=NULL, info=NULL)
set_sequential(theme, scheme)
set_diverging(theme, scheme)
set_row_kinds(theme, ...)              # after adding the slot
```

Today's `set_mode` alias is a footgun (its name suggests accessibility mode; it actually sets polarity).

---

## 5. Preset organization

### 5.1 File-location vs category mismatch

`R/themes.R::package_themes()` declares 4 categories:

| Category | Presets | File location |
|---|---|---|
| journals | cochrane, lancet, jama, nejm, nature, bmj, dark | `R/themes.R` ✓ |
| design | bauhaus, swiss, tufte, newsprint, solarized, solarized_dark, tonal, tonal_dark | `R/themes-design.R` ✓ |
| lotr | dwarven, elvish, hobbit | `R/themes-lotr.R` ✓ |
| showcase | synthwave, brutalist, atelier, executive | `R/themes-design.R` ✗ — defined in design but categorized showcase |

**Specifically:** `web_theme_synthwave` (`themes-design.R:224`), `web_theme_brutalist` (`themes-design.R:261`), `web_theme_atelier` (`themes-design.R:299`), `web_theme_executive` (`themes-design.R:329`) all live in `themes-design.R` despite `package_themes()` filing them under `showcase`.

**Also:** `dark` is filed under `journals` in `package_themes():209`, but it's not a journal — it's the canonical dark mode (`themes.R:183`).

**Fix:** Create `R/themes-showcase.R`, move the 4 showcase constructors there. Move `web_theme_dark` to `R/themes-modes.R` (or place under design / showcase). The TS side has no equivalent registry split — all 22 live in one `theme-presets-inputs.ts` registry, which is fine.

### 5.2 Substrate axis coverage per preset

| Preset | COLOR | TYPE | GEOMETRY | EFFECTS | NEUTRAL TINT | TEXTURE | DENSITY |
|---|---|---|---|---|---|---|---|
| cochrane | ✓ | default | default | default | default | default | comfortable |
| lancet | ✓ | scale 1.25 | default | default | default | default | (raised) |
| jama | ✓ | base 13, scale 1.15 | default | default | achromatic | default | compact |
| nejm | ✓ | scale 1.25 | default | default | default | default | default |
| nature | ✓ | scale 1.25 | default | default | brand-tint C=0.008 | ruled | (raised) |
| bmj | ✓ | default | default | default | default | default | default |
| dark | ✓ | default | default | default | default | default | (float) |
| bauhaus | ✓ | base 15, scale 1.333, weights | default | default | default | grid | default |
| swiss | ✓ | scale 1.2, weights | default | default | achromatic | grid | compact |
| tufte | ✓ | base 13, scale 1.15 | default | default | achromatic | ruled | compact × 0.9 |
| newsprint | ✓ | scale 1.2 | default | default | warm-paper C=0.016 | grain | default |
| solarized | ✓ | default | default | default | warm-paper C=0.012 | default | default |
| solarized_dark | ✓ | default | default | default | warm-paper | default | (dark polarity) |
| tonal | ✓ | scale 1.25 | default | default | default | default | (raised) |
| tonal_dark | ✓ | scale 1.25 | default | default | default | default | (raised+dark) |
| dwarven | ✓ | base 14, scale 1.25, weights | default | default | brand-tint C=0.012 | dotted | (raised+dark) |
| elvish | ✓ | base 14, scale 1.333 | default | default | decorative-tint | ruled | default |
| hobbit | ✓ | base 14, scale 1.333 | default | default | decorative-tint C=0.020 | grain | default |
| **synthwave** | ✓ | base 13, scale 1.2 | default | **glow=neon + gradient=vivid + elevation=raised** | brand-tint | grid | (float+dark) |
| **brutalist** | ✓ | base 14, scale 1.25, weights | **radius=0 + thick borders** | **none (explicit)** | achromatic | grid | compact |
| atelier | ✓ | base 13.5, scale 1.333 | default | default | decorative-tint C=0.024 | ruled | compact × 0.92 |
| executive | ✓ | base 14, scale 1.333, weights | default | default | default | default | (raised) |

### 5.3 Coverage gaps

- **No preset exercises `radius > default` (large card softness).** Brutalist pins everything to 0; nothing showcases an aggressive `lg = 24` editorial-soft style.
- **No preset uses `effects.glow_intensity = "subtle"`** — only `none` (most), `neon` (synthwave). Subtle is the documented middle option.
- **No preset uses `gradient_shell_intensity = "subtle"`** — only `none` and `vivid`.
- **No preset uses `effects.elevation = "soft" or "float"`** — only `none`, `raised` (synthwave), `none` (brutalist).
- **No preset uses `set_row_kinds`** (because R can't — see §6).
- **No preset uses `type_weights` adjacent to brutalist's heavy `{500, 700, 800, 900}` to test the lower end** — e.g. a "feather" preset with `{300, 400, 500, 600}`. Tufte declares no `type_weights`, defaulting to `{400, 500, 600, 700}`.
- **No light-mode showcase preset uses Phase D effects** — synthwave (dark) is the only effects-forward preset.

### 5.4 Naming: `categorical` field vs `set_categorical` setter

Strand 1.5 covered this. R consistent: arg `scheme`, slot `categorical`, setter `set_categorical`, R serializes JSON key `categorical`. TS: `inputs.categorical` field, no setter (TS has no `set_*` API).

---

## 6. Wire-format symmetry

### 6.1 Walk of every wire field

R emits via `R/themes-api.R::theme_inputs_to_json()` (`:25-120`); TS reads via `ThemeInputs` interface (`srcjs/src/types/theme-inputs.ts:62-195`).

| Wire key | R emits | TS expects | Status |
|---|---|---|---|
| `anchors.{paper,ink,brand,accent}` | ✓ `:30-35` | ✓ `:46-50` | OK |
| `polarity` | ✓ `:101` (always emitted) | ✓ `:68` | OK |
| `mode` | ✓ `:102` always emits `"standard"` | ✓ `:71` | **R cannot vary it** (§1.2) |
| `categorical` | ✓ `:103` | ✓ `:74` | OK |
| `sequential` | ✓ `:104` | ✓ `:75` | OK |
| `diverging` | ✓ `:105` | ✓ `:76` | OK |
| `status.{positive,negative,warning,info}` | ✓ `:37-43` | ✓ `:55-60`, `:79` | OK |
| `fonts.{body,display,mono}` | ✓ `:45-50, :107` | ✓ `:82-86` | OK |
| `density` | ✓ `:108` | ✓ `:128` | OK |
| `densityFactor` | ✓ `:109` (omitted when 1) | ✓ `:132` | OK (camelCase mismatch §1.1) |
| `shell_mode` | ✓ `:110` | ✓ `:110` | OK |
| `shell_texture` | ✓ `:111` | ✓ `:98` | OK |
| `type_base_size` | ✓ `:112` | ✓ `:114` | OK |
| `type_scale_ratio` | ✓ `:113` | ✓ `:117` | OK |
| `type_weights.{regular,medium,semibold,bold}` | ✓ `:54-60, :114` | ✓ `:120-125` | OK |
| `curves.{neutral,brand,accent}` | ✓ `:62-67, :115` | ✓ `:139-143` | OK |
| `geometry.{radius,border_width}.*` | ✓ `:73-88, :116` | ✓ `:163-176` | OK |
| `effects.*` | ✓ `:91-97, :117` | ✓ `:187-194` | OK |
| **`row_kinds`** | **NOT EMITTED** | ✓ `:148-151` | **R-side gap** |

### 6.2 `row_kinds` is TS-only

`theme-inputs.ts:147-151` documents the `row_kinds?: Partial<Record<...heightRatio:number>>` field. There is:
- No corresponding R slot (search `classes-theme.R` — no match).
- No emit in `theme_inputs_to_json()`.
- No `web_theme()` argument.
- The TS resolver does not currently consume it (`resolve-theme.ts` has no `row_kinds` reads — only `srcjs/src/lib/layout/row-kind-heights.ts` reads height pins via the stores).

This is half-built; either the field should be plumbed through to R + the resolver, or removed from `ThemeInputs` until needed.

### 6.3 Optional fields handling

R-side correctly drops NULL/NA fields from the emitted JSON in most paths (`out[!vapply(out, is.null, logical(1))]` at `:119`). Two minor issues:

- `polarity` is **always emitted** (`:101`) even though TS treats it as optional (`:68`). Consequence: a custom theme always sends `"light"` even when wanting to inherit. Low impact.
- `mode` is **always emitted as "standard"** (`:102`). Same.

These two could be made conditional on `mode != "standard"` and `polarity != "light"` for wire compactness, OR (better) leave always-emit and embrace explicit-default semantics. Pick one and document.

### 6.4 Status-anchor null behavior

`R/themes-api.R:37-43, :106`: R serializes `status` as a sub-object containing only non-NA anchors; if all four are NA, omits the `status` key entirely. TS reads it back via optional `status?: ThemeStatusAnchors` (`:79`) with nested `positive?` etc. Wire-compatible.

### 6.5 Anchors required vs optional

R: `paper`, `ink`, `brand` are required (validator at `classes-theme.R:191-194`). TS: required (`theme-inputs.ts:46-48`). Accent is optional both sides. OK.

R's `web_theme()` has different defaults though: `paper = NULL`, `ink = NULL`, `brand = DEFAULT_BRAND_HEX` — so if the user passes nothing, R **does** synthesize defaults. TS `webTheme()` (`theme-api.ts:70`) defaults to baseTheme cochrane and inherits — different model. The asymmetry is documented but worth noting.

---

## 7. Manifest token naming

### 7.1 Token prefix groups

Grouped from `srcjs/src/lib/theme/component-tokens.ts:92-825`:

| Prefix | Count | Examples |
|---|---|---|
| `--tv-row-*` | 8 | base-bg, alt-bg, hover-bg, emphasis-bar |
| `--tv-cell-*` | 3 | bg, fg, border |
| `--tv-header-*` | 9 | light-bg, tint-bg, fill-fg |
| `--tv-plot-*` | 5 | axis-line, tick-mark-length |
| `--tv-spacing-*` | 13 | row-height, padding, axis-gap |
| `--tv-text-*` | 3 explicit + 60 from `buildTypographyManifestEntries()` | title-fg, body-fg + role-family/size/weight/lh/track/font |
| `--tv-shell-*` | 5 + texture-line/dot + text-knockout + gradient | bg, border, shadow, radius, padding |
| `--tv-paper-*` | 5 + texture-line/dot + text-knockout | bg, border, shadow, radius, padding |
| `--tv-shadow-*` | 4 | raised-near, raised-far, overlay-near, overlay-far |
| `--tv-hc-*` | 3 | caret-char, ring-width, bar-width |
| `--tv-radius-*` | 4 | sm, md, lg, pill |
| `--tv-border-width-*` | 4 | hair, thin, regular, thick |
| `--tv-glow-*` | 3 | color, blur, spread |
| `--tv-accent*` | 2 | --tv-accent, --tv-accent-fill |
| `--tv-surface*` | 2 | -bg, -subtle-bg |
| `--tv-text`, `--tv-text-muted`, `--tv-text-subtle`, `--tv-border`, `--tv-border-subtle` | 5 | generic role passthroughs |
| `--tv-brand-gradient`, `--tv-brand-glow`, `--tv-glass-blur`, `--tv-emphasis-shadow` | 4 singletons | (`-` `:493-512`, `:818`) |

### 7.2 Singletons that should cluster

- `--tv-brand-gradient` and `--tv-shell-gradient` (Phase D) are both gradient definitions. `--tv-brand-gradient` is Stage 2 §7 browser-additive (`:493`); `--tv-shell-gradient` is Phase D effects (`:806`). They overlap in concept — "two-stop linear gradient over a surface". Consider grouping under `--tv-gradient-*` (`--tv-gradient-brand`, `--tv-gradient-shell`).
- `--tv-brand-glow` (`:500`) vs `--tv-glow-color/blur/spread` (Phase D, `:777-798`). The legacy brand-glow is a static brand-derived rgba; the Phase D `glow-*` triple is an actual effects axis. Rename `--tv-brand-glow → --tv-glow-brand-color` (and document its degenerate behavior independent of `inputs.effects.glow_*`).
- `--tv-glass-blur` (`:508`) is the only `--tv-glass-*` token. Either bring it into `--tv-effects-glass-blur` family (with future glass-bg, glass-border) or accept the singleton.
- `--tv-emphasis-shadow` (`:818`) vs `--tv-shadow-raised-near/far` and the shell shadow. Same suffix problem as `--tv-brand-glow`: the name conflates "emphasis row" with "shadow stack." Consider `--tv-shadow-emphasis` for consistency with `--tv-shadow-{raised,overlay}-{near,far}`.

### 7.3 Suffix patterns vs `kind` consistency

Checked suffix/kind matrix:

| Suffix | Expected kind | Observed mismatches |
|---|---|---|
| `-bg` | paint-fill | OK across all matches |
| `-fg` | paint-color | OK across all matches |
| `-border` | paint-stroke or paint-color | Mixed: `--tv-cell-border` is `paint-stroke` (`:171`), `--tv-shell-border` and `--tv-paper-border` are `paint-color` (`:427, :462`), `--tv-border`/`--tv-border-subtle` are `paint-color` (`:697, :703`). **Inconsistency**: borders should consistently be one kind. Suggest `paint-color` for theme-token borders (since the color is the named concept; the stroke property attaches at the consumer) and reserve `paint-stroke` for SVG-attribute-bound paint roles. |
| `-rule` | paint-stroke | `--tv-header-light-rule` is `paint-stroke` (`:194`). OK. |
| `-color` | paint-color | `--tv-glow-color` (`:779`) — OK. |
| `-width` | border-width | `--tv-border-width-*` (`:744-771`) are `border-width`. `--tv-hc-ring-width` is `border-width` (`:528`). `--tv-plot-line-width` is `border-width` (`:252`). OK. |
| `-shadow` | paint-color or paint-fill | `--tv-shell-shadow`/`--tv-paper-shadow` are `paint-color` (`:435, :470`); `--tv-shadow-raised-near` etc. are `paint-color` (`:600`); `--tv-emphasis-shadow` is `paint-fill` (`:819`) ✗. **Mismatch**: the value emitted is a CSS box-shadow string (multi-stop). Probably `paint-fill` is wrong — there's no `kind: "shadow"` yet but `paint-fill` is misleading. |
| `-radius` | spacing-px | `--tv-shell-radius`/`--tv-paper-radius` (`:442, :477`) — OK. |
| `-padding` | spacing-px | `--tv-shell-padding`/`--tv-paper-padding`/`--tv-spacing-*-padding` — OK. |
| `-family` | font-family | typography `:849` — OK. |
| `-size` | font-size | typography `:856` — OK. |
| `-weight` | font-weight | typography `:863` — OK. |
| `-lh` | should be a unitless or font-size, **declared as spacing-px** (`:870`) ✗ | The resolver emits `"normal"` or a unitless number (`resolve-theme.ts:476`); declaring as `spacing-px` is wrong. Consider new kind `"line-height"` or `"font-line-height"`. |
| `-track` | should be a CSS length string (e.g. `-0.022em`), **declared as spacing-px** (`:877`) ✗ | Resolver returns `r.track` directly (`resolve-theme.ts:477`) — that's a string like `"-0.02em"`, not a px value. Declaring as `spacing-px` is wrong; consider `"letter-spacing"` or `"font-track"`. |
| `-font` (shorthand) | declared as `font-family` (`:884`) ✗ | The value is a CSS `font` shorthand `weight size/lh family`, not a family. Consider `"font-shorthand"`. |

### 7.4 `consumedBy` references that may not exist

Sampled `consumedBy` entries against the actual tree:

- `"export/svg-generator.ts"` — exists at `srcjs/src/export/svg-generator.ts` ✓
- `"svelte/TabvizPlot.svelte"` — exists at `srcjs/src/svelte/TabvizPlot.svelte` ✓
- `"components/forest/PlotHeader.svelte"` — exists ✓
- `"components/forest/EffectAxis.svelte"` — exists ✓
- `"lib/swatches.ts"` (referenced `:99` for `--tv-row-base-bg`) — exists at `srcjs/src/lib/swatches.ts` ✓
- `"lib/semantic-styling.ts"` (`:135`) — exists ✓
- `"stores/slices/axis.svelte.ts"` (`:233`) — exists ✓
- `"stores/slices/layout-zoom.svelte.ts"` (`:273`) — exists ✓
- `"stores/slices/columns.svelte.ts"` (`:307`) — exists ✓
- `"lib/layout/table-metrics.ts"` (`:274, :308`) — exists ✓
- `"lib/theme/theme-runtime.css"` (`:423`) — exists ✓

The drift gate (`component-tokens.drift.test.ts`) enforces these are real. No findings of dead references.

### 7.5 `KNOWN_UNCONSUMED` entries that should have consumers

`COMPONENT_TOKENS:947-1167`:

- The `// ── v3 LEGACY REFERENCES` block at `:1008-1166` is shrink-only and tracked. Many are dead v3 tokens that will disappear with Stage 1 step 10 (v3 purge). Not actionable here.
- The Phase D block at `:962-970` lists `--tv-radius-md`, `--tv-radius-pill`, `--tv-border-width-thin`, `--tv-border-width-regular`, `--tv-glow-blur`, `--tv-glow-spread` as unconsumed (per the comment, "consumers wire up in D4"). These are Phase D tokens declared but not yet read by the renderer. Expected; should be removed from the allowlist as `TabvizPlot.svelte` migrates.
- The bare-prefix entries `--tv-radius-` and `--tv-border-width-` (`:959-960`) are documented as "Phase D bare prefixes from template literals in GeometrySamples viz" — fine to keep.
- The typography spread (`:949`) `...buildTypographyManifestEntries().map(t => t.cssVar)` blanket-allowlists all 60 typography tokens. Multiple have already been migrated (per the dated comment `:999 "consumed 2026-06-02 by renderHeader/renderFooter"`). The spread doesn't reflect that; the comment system only covers individual tokens below. **Fix:** Replace the blanket spread with an explicit list of typography tokens NOT yet consumed, so as consumers migrate they actually disappear from the allowlist.

### 7.6 Misc

- `--tv-text-` (`:952`) appears both as a bare-prefix grandfather AND in the legacy block (`:1134`). Duplicate.
- `--tv-border` appears in the new entries (`:695`) and as a v3-legacy grandfather entry (`:1030`). Duplicate.

---

## 8. Resolver dispatch

### 8.1 Dispatch order (resolve-theme.ts:239-371)

Reading from `resolveTokenValue()`:

1. **mode transforms** (HC/RT `drop`/`swap`) — `:248-259` — short-circuits **before** anything else.
2. **HC fidelity tokens** (`--tv-hc-caret-char`, `--tv-hc-ring-width`, `--tv-hc-bar-width`) — `:263-271`.
3. **Browser-additive effects** (`--tv-brand-gradient`, `--tv-brand-glow`, `--tv-glass-blur`) — `:274-298`.
4. **Phase D geometry** — `:303-306`.
5. **Phase D effects** — `:311-314`.
6. (Gated on `token.source.tier === "computed"`) **typography → shell/paper → elevation → texture → knockout** — `:319-330`.
7. **`token.kind === "spacing-px"`** — density px lookup — `:336-338`.
8. **`token.kind === "border-width"`** — hard-coded `"1px"` — `:339-341` ✗ (see §8.4).
9. **Switch on `source.tier`** for `role` / `input` / `anchor` / `computed` / `const` — `:343-371`.

### 8.2 Short-circuit hazards

**Hazard 1:** Step 8 returns `"1px"` for any token with `kind: "border-width"` that didn't match an earlier branch. Phase D border-width tokens (`--tv-border-width-hair`, `-thin`, `-regular`, `-thick`) are handled by step 4 (`resolveGeometryComputed`). But `--tv-plot-line-width` (`:252`, kind `border-width`) and `--tv-hc-ring-width` (`:527`, kind `border-width`) DON'T match step 4. They fall through:
  - `--tv-plot-line-width` — `source.tier = "computed"`, doesn't match typography pattern → reaches step 8, returns `"1px"`. **Bug**: description says "density-driven; default 1.5px" but this returns `1px`. Actually re-reading: `--tv-plot-line-width` has `kind: "border-width"`, so step 8 catches before step 6 reaches it. Step 6 is gated on `source.tier === "computed"` AND step 7/8 are kind-based — they fire regardless. So plot-line-width returns `"1px"`, not the documented `1.5px`.
  - `--tv-hc-ring-width` is handled in step 2 (`:267`), returns `"1.5px"`. OK.

The PLOT_DIMS table (`:660-664`) was supposed to handle `--tv-plot-line-width = 1.5px`, but `tokenDensityPx` is only called from step 7 (`kind === "spacing-px"`), NOT from step 8. So PLOT_DIMS is unreachable for the `border-width`-kind plot tokens. **Bug.**

**Hazard 2:** Step 6 (`source.tier === "computed"` gate) means non-computed-tier tokens cannot reach typography/shell-paper/elevation/texture/knockout resolvers. The Phase D geometry+effects resolvers at steps 4-5 are NOT gated on source.tier, so they fire for any matching cssVar — which is correct because geometry tokens have `source.tier === "input"` (`component-tokens.ts:715, 722, ...`), and effects tokens have `source.tier === "computed"`. The asymmetry is intentional but undocumented.

**Hazard 3:** Step 6's dispatch order matters when two resolvers could potentially match a cssVar. None overlap today, but if a future texture token started with `--tv-shell-` it would be caught by `resolveShellPaperComputed` first. Order: typography → shell/paper → elevation → texture → knockout. The shell/paper resolver matches `--tv-shell-*` and `--tv-paper-*` via prefix; the elevation resolver matches `--tv-shadow-*`; texture matches `--tv-shell-texture-*` / `--tv-paper-texture-*` — which **also** start with the shell/paper prefix. Currently `shellPaperKeyForCssVar` rejects texture-suffix paths (let's assume), but if it ever loosens, texture tokens would be intercepted by step 1 of the cluster. **Brittle ordering.**

### 8.3 Could it become a manifest-driven dispatch table?

Yes. Today each token's resolver path is implicit (deduced from `cssVar` prefix or `kind`). The manifest already has `source.tier` + `kind`. Proposal:

- Add `resolverGroup?: "typography" | "shell-paper" | "elevation" | "texture" | "knockout" | "geometry" | "effects" | "additive" | "hc-fidelity"` to `ComponentToken`.
- `resolveTokenValue` becomes: dispatch on `resolverGroup` via a `Map<string, ResolverFn>`. Fall through to the `source.tier` switch for unannotated tokens (the standard role/input/anchor cases).
- The drift gate enforces every Phase D / Stage 2 token declares a `resolverGroup`.

Benefits:
1. Eliminates the prefix-matching brittleness in §8.2 hazard 3.
2. Makes the resolver order explicit (sort tokens by group at module load).
3. Enables resolver-group-targeted unit tests (today they rely on cssVar names matching the patterns inside the resolver).

### 8.4 Mode behavior (`token.modes`) — hoisted vs scattered

Hoisted: step 1 (`:248-259`) handles `token.modes.hc` and `token.modes.rt` uniformly — this is the cleanest piece.

Scattered remnants:

- `applyHcGradePush` (`:167-173`) is called inside `resolveRoleValue` (`:187-189`) and applies HC mode's border-grade push at **role resolution** time. So HC affects role values BEFORE the cssVar dispatcher runs.
- HC fidelity tokens at step 2 (`:263-271`) re-read `inputs.mode` directly — even though they have `token.modes.hc` field potential. They're hard-coded to `"const"`-source tokens and the resolver hands them out inline rather than declaring them as `modes: { hc: { swap: ... } }`.
- Phase D `resolveGeometryComputed` (`:503-526`) bumps HC border-width by +1px inline (`hcBump`). This conflates the geometry resolver with mode behavior; could instead be a `modes: { hc: ... }` declaration.
- Phase D `resolveEffectsComputed` doesn't reference mode at all (`:540-600`); mode-based drops/swaps for effects tokens come from the dispatcher (step 1) via `token.modes.hc: "drop"` declarations on `--tv-glow-*` / `--tv-shell-gradient` / `--tv-emphasis-shadow`. Inconsistent with geometry's inline approach.

**Fix:** Migrate `applyHcGradePush` to per-token `modes` declarations (each border role like `--tv-cell-border` declares `modes: { hc: { swap: "border-strong" } }`); move HC fidelity values out of inline if-chains and into `token.modes` + `source: { tier: "const" }` with mode-keyed values; declare HC border-width bumps per-token instead of via `hcBump`.

### 8.5 Duplicate HC fidelity logic

`resolveTokenValue:263-271` AND `:360-368` both handle the three HC-fidelity tokens (`--tv-hc-caret-char`, `--tv-hc-ring-width`, `--tv-hc-bar-width`). The second block is dead code reachable only via `source.tier === "const"` fallthrough. Both return identical values. **Fix:** delete the second block (`:359-368`).

### 8.6 The "`<input:...>`"/`"<computed>"`/`"<anchor-missing>"`/`"<const>"` placeholders

`resolveTokenValue:348-371` returns string placeholders when a token's source can't be resolved (e.g. an `input`-tier token with no matching handler, or a `const` without a `transparent`-noted source). These would leak into emitted CSS as `var(--tv-foo: <input:effects>)` — broken CSS that would silently render nothing.

Scan the manifest for tokens that would land here:

- `--tv-glow-blur` (`:786`): `source: { tier: "input", input: "effects" }`, kind `spacing-px`. Step 7 (`kind === "spacing-px"`) intercepts → `tokenDensityPx` lookup → token isn't in DENSITY_PRESETS table → returns `"0px"`. So it does get a value, but `"0px"` not the documented "0 / 8px / 18px". Actually re-checking: `resolveEffectsComputed` matches `--tv-glow-blur` at step 5 (`:561-566`) and returns the documented value FIRST. OK.
- `--tv-radius-sm` (`:715`): `source: { tier: "input", input: "geometry" }`. Step 4 (`resolveGeometryComputed`) intercepts. OK.

All Phase D `tier: "input"` tokens with `input: "effects"` or `input: "geometry"` are intercepted upstream. No placeholders should leak today. But the safety net is thin — a new `tier: "input"` token with no matching upstream resolver would silently emit `"<input:foo>"` into CSS. **Fix:** make `resolveTokenValue`'s placeholder branches throw in dev mode (e.g. when `process.env.NODE_ENV !== "production"`).

---

## Appendix — additional findings outside the 8 strands

### A1. `coerce_anchor`'s validation range for `C` (R)

`R/utils-oklch.R:60` uses `lower=0, upper=0.5` for chroma. The S7 validator (`classes-theme.R:49`) also uses `[0, 0.5]`. The `oklch()` factory (`utils-oklch.R:31`) — same range. Consistent across R.

TS — no validator on `OklchTriple` (just `interface { L; C; H }`). A TS author can construct `{ L: 2, C: -1, H: 999 }` and the resolver will pipe it through `oklchToHex` which will clip-or-misrender.

### A2. Wire version is at 1.2 but `ThemeStructure.schemaVersion = 4` (`theme-inputs.ts:426`)

`schemaVersion: 4` is the theme-substrate version (per Stage 1 §22 vocabulary migration). The wire spec version is `1.2.0`. These are different scoping concepts but neighbors in code; worth a comment explaining `schemaVersion: 4` ≠ wire-version `1.2`.

### A3. `set_polarity` validates light/dark; `set_mode` deprecated-alias does NOT re-validate

`themes-api.R:407-415` validates polarity. `set_mode` (`:424`) trusts the alias path and rebroadcasts to `set_polarity` which validates. OK in practice but if a user calls `set_mode(theme, "high-contrast")` they get the polarity validator's error message — confusing because the parameter name suggests accessibility mode.

### A4. WebTheme schemaVersion check (`theme-api.ts:122`)

`isResolvedTheme` checks `schemaVersion === 2` — but the v4 `ThemeStructure.schemaVersion = 4`. So `isResolvedTheme` is checking against an old version. Either a `WebTheme` (legacy resolved-theme shape) is schemaVersion 2 and `ThemeStructure` is a separate v4 thing — confusing dual-version coexistence. Document or align.

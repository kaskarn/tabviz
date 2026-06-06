# tabviz 1.0 — the spec-first plan

**Decided 2026-06-06** after three rounds of multi-agent review (2× adversarial,
1× ideation; reports synthesized in session c9d63d6d). Four locked decisions:

1. **1.0 identity = engine-as-product / spec-first.** The story: *"the
   declarative table engine any language (or LLM) can drive."* npm
   `@tabviz/core` published for real; the machine contract (schema-as-tool-spec)
   becomes a first-class artifact; MCP server; the theme cascade exposed as a
   token compiler. R stays the richest wrapper but stops being the only
   shipping artifact. (The statistical-results-engine story remains the best
   *demo* of the engine — `tabviz(df)` / domain packs serve the identity as
   showcases, not as the headline.)
2. **Effects boundary declared.** Browser-only effects (glass/glow/aurora
   blobs) are frozen at current polish. The two effects that survive librsvg —
   gradient (`<linearGradient>`) and grain (`<feTurbulence>`) — get real SVG
   export parity. `save_plot()` warns when active effects are dropped from a
   static export. The preview must not lie about the deliverable.
3. **Preset cull: 27 → ~8 archetypes + `theme_blend()`.** The roster is ~6–8
   archetypes wearing 27 costumes (R3 theme report); the distinctness gate
   fights convergence instead of preventing it. Interpolation
   (`theme_blend(a, b, t)`: OKLab anchor lerp + scalar lerp + enum snap)
   becomes the capability that replaces costume-count. Culled presets'
   *anchors* are preserved in a gallery doc as blend recipes.
4. **Virtualization is out of 1.0.** Default-paginate above a row threshold;
   document the ceiling ("tabviz targets 10s–1000s of rows"); file the
   windowed-flatten design (the `flatten()` seam + height-estimation /
   measure-reconciliation notes) so the retrofit cost is bounded. Revisit only
   if identity changes.

## Phases

### Phase 0 — truth at the boundaries (bet-agnostic, do first)
- **Font embedding fix** (publication R3 #3 — THE bug): route the
  `embed_web_fonts()` woff2 cache into a session fontconfig dir before the
  rsvg call so NEJM PDFs embed Lora, not Georgia. Interim: warn when a
  declared web font is absent at PDF/PNG export. [M]
- **Export effects warning** + gradient/grain SVG parity (decision 2). [M]
- **Legend** (viz R3 B1): multi-effect key rendering `effect.label` ×
  shape/color; DOM + SVG. The flagship's missing piece. [M]
- **EPS + TIFF + real DPI contract**: `rsvg_eps` branch; TIFF via magick with
  DPI tag; `save_plot(width_mm=, dpi=)` physical sizing. [S]
- **Neutral paint mode** (interaction R3 #1): `paintTool` nullable, neutral
  default, painter explicitly armed from the toolbar. [S–M]
- **`check:size` as CI gate**; studio code-split is the follow-up. [S]

### Phase 1 — the machine contract (the foundation of the identity)
- **Generate JSON Schema from `SCHEMA_REGISTRY` + `theme-inputs.ts` + wire
  types** → `spec/v1.3.schema.json`, with a CI freshness gate (regenerate +
  diff). The 170 options' `label/hint/min/max/segments/accepts/mutuallyExclusive`
  metadata IS the tool spec — emit it. [M]
- **Runtime option validator** enforcing that metadata on any incoming spec
  (the editor-only contract becomes a wire gate). [M]
- **Structured error envelope** `{code, path, got, expected, didYouMean?}`
  across spec/theme/column validation; `theme-validate.ts` is the model. [M]
- **Round-trip documentation**: NA/null single rule; conditions + NSE formulas
  documented as authoring-time sugar that does not survive the wire. [S]

### Phase 2 — npm + MCP (distribution)
- npm publish readiness: version alignment (0.5.0 → 1.0.0-rc tracking the
  engine, not R), TS-authoring visual examples under `srcjs/tests/visual/`,
  one public Observable/CodeSandbox demo. [M]
- `@tabviz/mcp`: `render_table(spec)` (V8 path), `validate_spec`,
  `get_schema(type?)`, `list_themes`, `suggest_theme(brand_hex)`. [M]
- `computeLayoutMetrics` into the public export surface. [S]

### Phase 3 — the theme system as product
- **Preset cull** to ~8 archetypes (curation pass needed: candidates —
  cochrane, nature, tufte or swiss, dark, terminal or synthwave, ledger,
  aurora, brutalist) + **`theme_blend()`** interpolation engine + studio blend
  slider. Breaking change; gallery rewrite; culled presets preserved as blend
  recipes. [L]
- **`lightDarkPair` finish**: one artifact carries both polarities (cascade
  runs twice; status anchors unreflected); deletes the 3 `_dark` twins. [S–M]
- **Token compiler**: `{anchors} → DTCG / CSS vars / Tailwind` emitters; forces
  the pin/derive provenance type (`pinned | derived | guaranteed-override`)
  that the R3 theme report demands. [L]

### Phase 4 — the demo layer (the old Pole A, now in service of the engine)
- `tabviz(df)` auto-columns (design ready in the R2 versatility report). [S–M]
- `registerMark` + DOM↔SVG per-shape path parity (substrate keystone; demanded
  by R2 extensibility + R3 viz). [L]
- Meta-analysis domain pack / `tabviz(model)` ingestion — the flagship demo of
  "an LLM or a language drives the engine." [M each]
- Op-log → shareable/auditable sessions (interaction R3's bet; ~70% built). [M]

## Standing backlog absorbed from R2 (unchanged)
drift-gate consumedBy/name-presence enforcement · header keyboard sort + table
ARIA · banding ΔL floor · light-mode chroma at solids · studio history labels ·
resolveShellPaper hoist · hexToRgba dedup · authoring guides
(adding-a-column-type.md etc.) · footnote markers (cell-anchored).

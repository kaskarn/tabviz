# tabviz wire-format versioning policy

**Status:** Stable contract from Phase 0a-PR1 forward. Authoritative source: `docs/dev/frontend-split-spec.md` §3.4. This file is the consumer-facing version.
**Audience:** Maintainers planning a wire-format change. Anyone running both R-side `tabviz` and the eventual `@tabviz/core` JS package who needs to reason about cross-version compatibility.

---

## Where the version lives

Every `WebSpec` and `SplitForestPayload` that R serializes carries an explicit `version` field at the top level:

```ts
{
  version: "1.0",
  data: { ... },
  columns: [ ... ],
  // ...
}
```

The string is parsed JS-side by `parseSpecVersion` in `srcjs/src/spec/index.ts`. Both htmlwidget bindings validate on every `renderValue`; the SplitForestPayload validator runs the same check.

**Sources of truth:**
- R side: `WIRE_FORMAT_VERSION` in `R/wire-version.R` (single constant)
- JS side: `CURRENT_VERSION` in `srcjs/src/spec/index.ts`
- A doc-test in `tests/testthat/test-wire-version.R` reads both files and asserts they agree.

---

## Pre-release stance (today)

We're in pre-release until `@tabviz/core@1.0.0` ships externally (Phase 3 of the program). During this window:

- The wire format may evolve **freely** between releases, including breaking changes.
- The version field is emitted and validated — that infrastructure is load-bearing — but the **policy** around bumps is informal.
- We emit `"1.0"` for simplicity (the schema file is `srcjs/src/spec/v1.0.json`). This is what we expect 1.0 to settle to, not a stability declaration.

**Stability is declared at Phase 3 publish, not by the version string.** A consumer seeing `"1.0"` during pre-release should treat it as provisional. Once `@tabviz/core@1.0.0` ships on npm, the publish event is the unambiguous signal that the version string represents a stable contract.

We considered alternatives:
- Emit `"1.0-pre"` until Phase 3 → bookkeeping noise; the publish event is already the right signal.
- Carry a `stable: false` flag → same.

---

## Steady-state policy (post-publish)

### Major bumps — breaking

Major bumps (`1` → `2`) signal a breaking wire-format change. They require a **migration handler**: JS-side `validateSpecVersion` either upcasts the older major into the current shape, or rejects it with a clear error.

When you ship a major bump:
1. Update `WIRE_FORMAT_VERSION` and `CURRENT_VERSION` together (the sync test enforces).
2. Update `SUPPORTED_MAJORS` in `srcjs/src/spec/index.ts` (drop or retain old majors as appropriate).
3. Add the migration handler if you're keeping the older major callable.
4. Publish a new JSON Schema at `srcjs/src/spec/vN.0.json`.
5. Update `docs/dev/r-js-sync-points.md` to document any new sync points the bump introduces.

### Minor bumps — strictly additive

Minor bumps (`1.0` → `1.1`) ship new fields that older readers **must ignore**. This is enforced by:
- The published JSON Schema at `srcjs/src/spec/v1.0.json` declares `additionalProperties: true` on every wire object. Older validators see new fields, accept them, ignore them.
- The JS ingest code uses property access (`x.foo ?? default`), not exhaustive destructuring, so unknown fields don't trip parsing.

When you ship a minor bump:
1. Update `WIRE_FORMAT_VERSION` and `CURRENT_VERSION`.
2. Publish a new schema at `vN.M.json` extending the previous schema with the new fields.
3. The previous schema stays published so older consumers still validate.

### Patch bumps — documentation / internal only

No wire-format change. Use patch bumps for documentation fixes, internal refactors, or bug fixes that don't change emitted JSON.

---

## Asymmetric validation

Validation is **symmetric in code** — the same ingest layer runs on both the R-bundled htmlwidget path and the future external web-app consumer path. What differs is **where we invest in polish**:

- **htmlwidget path (lockstep):** R bundles its JS; the version is identical by construction. The validation runs but rarely matters in practice. A simple equality check suffices.
- **External consumer path:** Versions can drift. This is where rich error messages, migration handlers, and version-skew telemetry earn their keep.

Both paths share the same `validateSpecVersion` function. The asymmetry is in the *attention*: future migration handlers and helpful error messages concentrate on the external path.

---

## R-side validation also has a job

Even though R+JS are lockstep in the htmlwidget case, `R/utils-serialize.R` benefits from validating its own output against the published JSON Schema before sending — it catches builder-side bugs at their source rather than at the widget render. Worth wiring up via `jsonvalidate` once the schema is stable (Phase 0d-G1).

---

## Compatibility matrix

The R package pins a specific JS version range and the htmlwidget loader can check at init. The mechanism (today) is the wire-version sync test: if R emits a version the bundled JS doesn't recognize, the widget errors loudly on `renderValue`. Once the package ships externally:

| R package version | JS package range it bundles | Notes |
|---|---|---|
| (pre-publish) | local source | lockstep by construction |
| (future) | `^X.Y.0` | exact JS version recorded in `R/zzz.R`; widget loader compares at init |

The matrix becomes meaningful once external consumers can install `@tabviz/core` independently. Until then, the local-source bundle is the only thing in the picture.

---

## What versioning does NOT cover

- **Method-call contract** (proxy methods, instance method names) — different concern; see `srcjs/src/spec/proxy-args.ts` for the typed shapes. Renaming a proxy method would be a major bump.
- **Event-emitter contract** — the `SHINY_EVENT_FIELDS` list is part of the wire format; adding new fields is minor-additive, removing is major. See `docs/dev/event-contract.md`.
- **R-side public function signatures** — those are R-package versioning (semver on the `tabviz` R package itself), independent of the wire format.

---

## Bump procedure

1. Update `WIRE_FORMAT_VERSION` in `R/wire-version.R`.
2. Update `CURRENT_VERSION` in `srcjs/src/spec/index.ts` to match.
3. For major bumps: update `SUPPORTED_MAJORS` JS-side; add migration handler in `validateSpecVersion`; publish `srcjs/src/spec/vN.0.json`.
4. For minor bumps: publish `srcjs/src/spec/vN.M.json` with the new fields added.
5. Run `devtools::test()` (the wire-version sync test asserts R == JS).
6. Run the full visual test battery (`tabviz::render_visual_tests()`) to confirm no rendering regression.
7. Update `docs/dev/event-contract.md` and `docs/dev/r-js-sync-points.md` if the bump introduces new emitters or sync points.

The bump is intentionally cheap mechanically — the discipline lives in the policy above, not the procedure.

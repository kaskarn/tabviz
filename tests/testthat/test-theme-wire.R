# Theme wire envelope + role overrides + border presets
# (settings-overhaul P0 gates DT-9 / DT-10 / boundary-is-real).
#
# The portable theme artifact is `{$schema, name, inputs, roleOverrides}`.
# These tests pin the R half of the round-trip: set_role/clear_role,
# pin survival across other setters, serialize/deserialize carriage,
# theme_from_wire re-hydration, and the border_preset Tier-1 expansion.

test_that("set_role pins a Tier-2 role and the cssVars reflect it", {
  t0 <- web_theme_nejm()
  t1 <- suppressWarnings(set_role(t0, "text-muted", "brand", 8))
  v0 <- theme_css_vars(t0)
  v1 <- suppressWarnings(theme_css_vars(t1))
  expect_false(identical(v0[["--tv-text-muted"]], v1[["--tv-text-muted"]]))
  expect_identical(t1@role_overrides[["text-muted"]],
                   list(ramp = "brand", grade = 8L))
})

test_that("role pins survive other set_*() re-resolves (DT pin round-trip)", {
  t <- suppressWarnings(set_role(web_theme_nejm(), "text-muted", "brand", 8))
  t <- suppressWarnings(set_brand(t, "#7a1f3d"))
  t <- suppressWarnings(set_density(t, density = "spacious"))
  t <- suppressWarnings(set_header_style(t, "bold"))
  expect_length(t@role_overrides, 1L)
  expect_identical(t@role_overrides[["text-muted"]]$grade, 8L)
})

test_that("clear_role releases the pin", {
  t <- suppressWarnings(set_role(web_theme_nejm(), "text-muted", "brand", 8))
  t <- clear_role(t, "text-muted")
  expect_length(t@role_overrides, 0L)
})

test_that("serialize_theme carries roleOverrides on the wire (DT-9)", {
  t <- suppressWarnings(set_role(web_theme_nejm(), "text-muted", "brand", 8))
  blob <- suppressWarnings(tabviz:::serialize_theme(t))
  expect_false(is.null(blob$roleOverrides))
  expect_equal(as.numeric(blob$roleOverrides[["text-muted"]]$grade), 8)
  # ... and deserialize restores the slot.
  back <- tabviz:::deserialize_resolved_theme(blob)
  expect_equal(as.numeric(back@role_overrides[["text-muted"]]$grade), 8)
})

test_that("theme_from_wire re-hydrates the studio envelope (DT-9/DT-10)", {
  t1 <- suppressWarnings(set_role(web_theme_nejm(), "text-muted", "brand", 8))
  env <- list(
    "$schema" = "tabviz-theme/v4",
    name = "cochrane",
    inputs = tabviz:::theme_inputs_to_json(t1@inputs),
    roleOverrides = t1@role_overrides
  )
  rt <- suppressWarnings(theme_from_wire(jsonlite::toJSON(env, auto_unbox = TRUE)))
  expect_identical(
    suppressWarnings(theme_css_vars(rt))[["--tv-text-muted"]],
    suppressWarnings(theme_css_vars(t1))[["--tv-text-muted"]]
  )
  expect_identical(rt@name, "cochrane")
})

test_that("theme_inputs_from_wire is a fixpoint of theme_inputs_to_json", {
  for (nm in c("nejm", "synthwave", "ledger", "aurora", "terminal")) {
    th <- get(paste0("web_theme_", nm))()
    w <- tabviz:::theme_inputs_to_json(th@inputs)
    back <- tabviz:::theme_inputs_from_wire(w)
    w2 <- tabviz:::theme_inputs_to_json(back)
    expect_true(isTRUE(all.equal(w, w2)), label = paste("fixpoint:", nm))
  }
})

test_that("set_border_preset expands into five distinct clusters", {
  presets <- c("none", "hairline", "ruled", "frame", "boxed")
  sigs <- vapply(presets, function(p) {
    b <- set_border_preset(web_theme_nejm(), p)@borders
    paste(b@layout, b@major@thickness, b@minor@thickness, b@table@thickness)
  }, "")
  expect_length(unique(sigs), 5L)
  # Re-applying a theme's OWN declared preset must be a no-op. nejm ships
  # "frame" (the journal frame), so its resolved default IS the frame cluster
  # — applying "frame" again must not shift it.
  expect_identical(web_theme_nejm()@inputs@border_preset, "frame")
  d <- web_theme_nejm()@borders
  f <- set_border_preset(web_theme_nejm(), "frame")@borders
  expect_identical(d@layout, f@layout)
  expect_equal(d@major@thickness, f@major@thickness)
  expect_equal(d@table@thickness, f@table@thickness)
})

test_that("border_preset survives the inputs wire", {
  t <- set_border_preset(web_theme_nejm(), "boxed")
  w <- tabviz:::theme_inputs_to_json(t@inputs)
  expect_identical(w$border_preset, "boxed")
  back <- tabviz:::theme_inputs_from_wire(w)
  expect_identical(back@border_preset, "boxed")
})

test_that("set_role validates ramp and grade", {
  expect_error(set_role(web_theme_nejm(), "text-muted", "rainbow", 3))
  expect_error(set_role(web_theme_nejm(), "text-muted", "brand", 0))
  expect_error(set_role(web_theme_nejm(), "text-muted", "brand", 12))
})

test_that("role pins reach tabviz_theme_css (the widget paint path)", {
  # P0 review #1: theme_css_vars honored pins while tabviz_theme_css
  # (getThemeCSS -> _emitV4CssVarsBody) dropped them — two R entry
  # points disagreed and the live widget diverged from SVG export.
  t0 <- web_theme_nejm()
  t1 <- suppressWarnings(set_role(t0, "text-muted", "brand", 8))
  css0 <- tabviz_theme_css(t0)
  css1 <- suppressWarnings(tabviz_theme_css(t1))
  expect_false(identical(css0, css1))
  pinned_val <- suppressWarnings(theme_css_vars(t1))[["--tv-text-muted"]]
  expect_match(css1, pinned_val, fixed = TRUE)
})

test_that("set_theme_field on inputs preserves role pins", {
  t <- suppressWarnings(set_role(web_theme_nejm(), "text-muted", "brand", 8))
  t2 <- suppressWarnings(set_theme_field(t, c("inputs", "density"), "spacious"))
  expect_length(t2@role_overrides, 1L)
})

test_that("read_theme routes wire-envelope files through theme_from_wire", {
  t1 <- suppressWarnings(set_role(web_theme_nejm(), "text-muted", "brand", 8))
  env <- list(
    "$schema" = "tabviz-theme/v4",
    name = "envtest",
    inputs = tabviz:::theme_inputs_to_json(t1@inputs),
    roleOverrides = t1@role_overrides
  )
  f <- tempfile(fileext = ".json")
  jsonlite::write_json(env, f, auto_unbox = TRUE)
  rt <- suppressWarnings(read_theme(f))
  expect_s3_class(rt, "tabviz::WebTheme")
  expect_length(rt@role_overrides, 1L)
})

test_that("set_pin overrides a token through the full chain (P3)", {
  t0 <- web_theme_nejm()
  t1 <- suppressWarnings(set_pin(t0, "text-footnote-size", "0.7rem"))  # last-resort lint (Wave 1)
  expect_identical(t1@pins[["--tv-text-footnote-size"]], "0.7rem")
  v <- theme_css_vars(t1)
  expect_identical(v[["--tv-text-footnote-size"]], "0.7rem")
  # paint path too (the P0.1 lesson)
  css <- tabviz_theme_css(t1)
  expect_match(css, "--tv-text-footnote-size: 0.7rem", fixed = TRUE)
  # survives other setters
  t2 <- suppressWarnings(set_brand(t1, "#7a1f3d"))
  expect_identical(t2@pins[["--tv-text-footnote-size"]], "0.7rem")
  # clears
  t3 <- clear_pin(t2, "text-footnote-size")
  expect_length(t3@pins, 0L)
  # unknown token rejected
  expect_error(set_pin(t0, "not-a-real-token", "1px"), "manifest")
})

test_that("pins ride the wire envelope round-trip (P3)", {
  t1 <- suppressWarnings(set_pin(web_theme_nejm(), "text-footnote-size", "0.7rem"))
  env <- list(
    "$schema" = "tabviz-theme/v4",
    name = "cochrane",
    inputs = tabviz:::theme_inputs_to_json(t1@inputs),
    roleOverrides = t1@role_overrides,
    pins = t1@pins
  )
  # suppressWarnings: pin import now emits a "last resort" lint (Wave 1) —
  # asserted directly in its own gate below.
  rt <- suppressWarnings(theme_from_wire(jsonlite::toJSON(env, auto_unbox = TRUE)))
  expect_identical(rt@pins[["--tv-text-footnote-size"]], "0.7rem")
  expect_identical(theme_css_vars(rt)[["--tv-text-footnote-size"]], "0.7rem")
})

test_that("set_pin rejects hostile values (round-2 robustness P0)", {
  th <- web_theme_nejm()
  expect_error(
    set_pin(th, "--tv-surface-bg", '#fff"/><script>alert(1)</script>'),
    "angle brackets|double quotes|Invalid"
  )
  expect_error(set_pin(th, "--tv-surface-bg", "red; }"), "semicolons|braces|Invalid")
  # Valid single-quote font list survives.
  ok <- suppressWarnings(set_pin(th, "--tv-text-body-family", "'Inter', sans-serif"))
  expect_identical(ok@pins[["--tv-text-body-family"]], "'Inter', sans-serif")
})

test_that("theme_from_wire rejects a hostile pin value in an imported envelope", {
  env <- list(
    "$schema" = "tabviz-theme/v4", name = "evil",
    inputs = tabviz:::theme_inputs_to_json(web_theme_nejm()@inputs),
    pins = list("--tv-surface-bg" = '#fff"/><script>x</script>')
  )
  expect_error(
    theme_from_wire(jsonlite::toJSON(env, auto_unbox = TRUE)),
    "Invalid pin value"
  )
})

test_that("set_role rejects an unknown bindable role (flow F3 gate)", {
  expect_error(set_role(web_theme_nejm(), "not-a-role", "brand", 8), "bindable")
  # A valid role still works.
  ok <- set_role(web_theme_nejm(), "text-muted", "brand", 8)
  expect_identical(ok@role_overrides[["text-muted"]]$ramp, "brand")
})

test_that("write_theme rejects path-traversal names (round-2 robustness P1)", {
  th <- web_theme_nejm()
  expect_error(write_theme(th, "../evil"), "bare theme name")
  expect_error(write_theme(th, "a/b"), "bare theme name")
})

test_that("write_theme/read_theme round-trip is lossless (round-2 user-review blocker)", {
  th <- web_theme(name = "rt", brand = "#7aa2f7", accent = "#bb9af7") |>
    set_polarity("dark") |>
    (\(t) suppressWarnings(set_pin(t, "--tv-accent", "#ff4400")))() |>
    set_role("text-muted", "brand", 8)
  # Registry round-trip.
  withr::local_options(tabviz.theme_dir = withr::local_tempdir())
  write_theme(th, "rt")
  back <- suppressWarnings(read_theme("rt"))  # pin import lints (Wave 1)
  expect_equal(back@inputs@anchors_paper_L, th@inputs@anchors_paper_L, tolerance = 1e-6)
  expect_identical(back@pins[["--tv-accent"]], "#ff4400")
  expect_identical(back@role_overrides[["text-muted"]]$ramp, "brand")
  # Render fidelity: resolved cssVars match the original (the bug returned
  # a DIFFERENT theme — dark paper came back white).
  expect_identical(theme_css_vars(back)[["--tv-surface-bg"]],
                   theme_css_vars(th)[["--tv-surface-bg"]])
})

test_that("write_theme emits the wire envelope, not a resolved blob (flow F2)", {
  th <- web_theme_nejm()
  f <- withr::local_tempfile(fileext = ".json")
  write_theme(th, file = f)
  on_disk <- jsonlite::fromJSON(f, simplifyVector = FALSE)
  expect_identical(on_disk[["$schema"]], "tabviz-theme/v4")
  expect_false(is.null(on_disk[["inputs"]]))
  expect_null(on_disk[["cssVars"]])     # NOT the resolved blob
})

test_that("write_theme requires exactly one destination", {
  th <- web_theme_nejm()
  expect_error(write_theme(th), "destination")
  expect_error(write_theme(th, name = "x", file = "y.json"), "only one")
})

test_that("read_theme restores inputs from a legacy resolved blob (back-compat)", {
  # Simulate a file written by the OLD write_theme (resolved blob with
  # authoringInputs but no $schema/inputs envelope keys).
  th <- web_theme(name = "legacy", brand = "#7aa2f7") |> set_polarity("dark")
  f <- withr::local_tempfile(fileext = ".json")
  jsonlite::write_json(tabviz:::serialize_theme(th), f,
                       auto_unbox = TRUE, pretty = TRUE, null = "null")
  back <- read_theme(f)
  expect_equal(back@inputs@anchors_paper_L, th@inputs@anchors_paper_L, tolerance = 1e-6)
})

test_that("studio_save_as persists the wire envelope verbatim (flow F2)", {
  withr::local_options(tabviz.theme_dir = withr::local_tempdir())
  t1 <- suppressWarnings(set_pin(web_theme_nejm(), "text-footnote-size", "0.7rem"))
  wire <- list(
    "$schema" = "tabviz-theme/v4", name = "verbatim-test",
    inputs = tabviz:::theme_inputs_to_json(t1@inputs),
    roleOverrides = t1@role_overrides, pins = t1@pins
  )
  payload <- jsonlite::toJSON(list(name = "verbatim-test", wire = wire), auto_unbox = TRUE)
  path <- suppressWarnings(tabviz:::.studio_save_as_payload(payload))  # pin import lints (Wave 1)
  expect_true(!is.null(path) && file.exists(path))
  on_disk <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  expect_identical(on_disk[["$schema"]], "tabviz-theme/v4")
  expect_true(!is.null(on_disk[["inputs"]]))
  expect_null(on_disk[["cssVars"]])
  expect_identical(on_disk[["pins"]][["--tv-text-footnote-size"]], "0.7rem")
  expect_s7_class(suppressWarnings(read_theme(path)), tabviz::WebTheme)
})

test_that("pins-are-last-resort lints fire (theme-rework Wave 1)", {
  # theme_from_wire warns when an imported envelope pins tokens directly
  # (cascade-bypassing). The un-throttled import lint, gated here.
  env <- list(
    "$schema" = "tabviz-theme/v4", name = "pinned",
    inputs = tabviz:::theme_inputs_to_json(web_theme_nejm()@inputs),
    pins = list("--tv-text-footnote-size" = "0.7rem")
  )
  expect_warning(
    theme_from_wire(jsonlite::toJSON(env, auto_unbox = TRUE)),
    "pin.*token.*directly|bypass the cascade"
  )
  # An envelope with NO pins imports silently.
  clean <- list(
    "$schema" = "tabviz-theme/v4", name = "clean",
    inputs = tabviz:::theme_inputs_to_json(web_theme_nejm()@inputs)
  )
  expect_no_warning(theme_from_wire(jsonlite::toJSON(clean, auto_unbox = TRUE)))
})

test_that("read_theme accepts an inline wire JSON string (Wave 1 handoff)", {
  # The viewer's "Edit in studio" handoff copies the portable wire to the
  # clipboard; a pasted string IS a valid theme source.
  th <- set_role(web_theme_nejm(), "text-muted", "brand", 8)
  json <- as.character(jsonlite::toJSON(theme_to_wire(th), auto_unbox = TRUE, digits = NA))
  back <- read_theme(json)
  expect_s7_class(back, tabviz::WebTheme)
  expect_identical(back@role_overrides[["text-muted"]]$ramp, "brand")
  expect_identical(back@role_overrides[["text-muted"]]$grade, 8L)
})

test_that("set_type_role rebinds a type role + round-trips the wire (Wave 3)", {
  th <- web_theme_nejm()
  before <- theme_css_vars(th)[["--tv-text-footnote-size"]]
  t2 <- set_type_role(th, "footnote", size = "title", weight = "bold")
  after <- theme_css_vars(t2)[["--tv-text-footnote-size"]]
  expect_false(identical(before, after))                     # rebind took effect
  expect_identical(t2@inputs@type_roles[["footnote"]]$size, "title")
  # The override lives in inputs.type_roles on the wire (not a top-level key).
  wire <- theme_to_wire(t2)
  expect_identical(wire$inputs$type_roles$footnote$size, "title")
  # Round-trip restores the rebound size exactly.
  back <- theme_from_wire(jsonlite::toJSON(wire, auto_unbox = TRUE, digits = NA))
  expect_identical(theme_css_vars(back)[["--tv-text-footnote-size"]], after)
})

test_that("set_column_default records house-style defaults + round-trips the wire", {
  th <- web_theme_nejm()
  expect_length(th@inputs@column_defaults, 0L)            # none by default

  t2 <- set_column_default(th, "pvalue", stars = TRUE, significantStyle = "pill")
  expect_true(t2@inputs@column_defaults$pvalue$stars)
  expect_identical(t2@inputs@column_defaults$pvalue$significantStyle, "pill")

  # Lives under inputs.column_defaults on the wire (not a top-level key).
  wire <- theme_to_wire(t2)
  expect_true(wire$inputs$column_defaults$pvalue$stars)
  expect_identical(wire$inputs$column_defaults$pvalue$significantStyle, "pill")

  # Round-trips through serialize + re-hydration exactly.
  back <- theme_from_wire(jsonlite::toJSON(wire, auto_unbox = TRUE, digits = NA))
  expect_true(back@inputs@column_defaults$pvalue$stars)
  expect_identical(back@inputs@column_defaults$pvalue$significantStyle, "pill")

  # A second call MERGES into the same type; passing nothing clears it.
  t3 <- set_column_default(t2, "pvalue", starsColor = "negative")
  expect_true(t3@inputs@column_defaults$pvalue$stars)        # earlier opt kept
  expect_identical(t3@inputs@column_defaults$pvalue$starsColor, "negative")
  t4 <- set_column_default(t3, "pvalue")
  expect_null(t4@inputs@column_defaults$pvalue)
})

test_that("web_theme(column_defaults=) seeds the slot + the wire-import drops junk", {
  th <- web_theme(column_defaults = list(pvalue = list(stars = TRUE)))
  expect_true(th@inputs@column_defaults$pvalue$stars)

  # Untrusted wire-import keeps only scalar leaves under named types. The
  # empty-name entry is built via setNames (a literal "" = is a parse error).
  cd_junk <- c(
    list(pvalue = list(stars = TRUE, bad = list(1, 2))),       # non-scalar leaf dropped
    list(bar = list(color = 'red" onmouseover="x', ok = "#0a0")), # XSS value dropped
    setNames(list(list(x = 1)), "")                           # empty type key dropped
  )
  wire <- list(
    name = "junk", schemaVersion = 4,
    inputs = list(
      anchors = theme_to_wire(web_theme_nejm())$inputs$anchors,
      column_defaults = cd_junk
    )
  )
  back <- theme_from_wire(jsonlite::toJSON(wire, auto_unbox = TRUE, digits = NA))
  expect_true(back@inputs@column_defaults$pvalue$stars)
  expect_null(back@inputs@column_defaults$pvalue$bad)
  expect_false("" %in% names(back@inputs@column_defaults))
  # XSS grammar gate: a hostile color string is dropped, a clean one kept.
  expect_null(back@inputs@column_defaults$bar$color)
  expect_identical(back@inputs@column_defaults$bar$ok, "#0a0")
})

test_that("R .TYPE_ROLE_NAMES mirror matches the TS roster (Wave 3 drift gate)", {
  ts_type_roles <- sort(list_roles()$role[list_roles()$domain == "type"])
  expect_identical(ts_type_roles, sort(tabviz:::.TYPE_ROLE_NAMES))
})

test_that("set_role redirects non-color (scale) roles to their setters (Wave 3)", {
  th <- web_theme_nejm()
  expect_error(set_role(th, "footnote", "brand", 8), "TYPE role")
  expect_error(set_role(th, "corners", "neutral", 5), "GEOMETRY role")
  expect_error(set_role(th, "density", "neutral", 5), "spacing role")
})

test_that("set_corners / set_rules expand geometry slots from the TS tables (Wave 3)", {
  th <- web_theme_nejm()
  round <- set_corners(th, "round")
  expect_identical(round@inputs@geometry_radius_md, 12)   # CORNER_SLOTS.round.md
  sharp <- set_corners(th, "sharp")
  expect_identical(sharp@inputs@geometry_radius_sm, 0)
  strong <- set_rules(th, "strong")
  expect_identical(strong@inputs@geometry_border_width_thick, 3.5)
  expect_error(set_corners(th, "bevelled"), "sharp|soft|round")
  # Slots come from ONE source (scale-roles.ts) via ts_call — drift-proof.
  tabs <- tabviz:::.geometry_slot_tables()
  expect_identical(as.numeric(tabs$corners$round$md), 12)
  expect_identical(as.numeric(tabs$rules$strong$thick), 3.5)
})

test_that("studio_save_as rejects path-traversal names (round-2 robustness P1)", {
  withr::local_options(tabviz.theme_dir = withr::local_tempdir())
  wire <- list("$schema" = "tabviz-theme/v4", name = "x",
               inputs = tabviz:::theme_inputs_to_json(web_theme_nejm()@inputs))
  payload <- jsonlite::toJSON(list(name = "../evil", wire = wire), auto_unbox = TRUE)
  expect_warning(p <- tabviz:::.studio_save_as_payload(payload), "invalid theme name")
  expect_null(p)
})

test_that("interaction_defaults ride the inputs wire + survive untrusted import", {
  # Interactivity-UX arc P1: a theme can carry opinionated interaction
  # defaults (sparse flag map). Unknown flags and non-logical values are
  # dropped at the untrusted wire ingress.
  th <- web_theme(interaction_defaults = list(enable_axis_zoom = TRUE,
                                              enable_edit = FALSE))
  json <- tabviz:::theme_inputs_to_json(th@inputs)
  expect_true(json$interaction_defaults$enable_axis_zoom)
  expect_false(json$interaction_defaults$enable_edit)

  # Round-trip through the wire envelope + untrusted import.
  wire <- theme_to_wire(th)
  th2 <- theme_from_wire(wire)
  expect_true(th2@inputs@interaction_defaults$enable_axis_zoom)

  # Hostile wire: unknown flags / garbage values are dropped.
  wire$inputs$interaction_defaults <- list(
    enable_axis_zoom = TRUE, evil_flag = TRUE, enable_edit = "yes"
  )
  th3 <- theme_from_wire(wire)
  expect_identical(names(th3@inputs@interaction_defaults), "enable_axis_zoom")

  # Malformed list errors at S7 construction (R author surface).
  expect_error(web_theme(interaction_defaults = list(enable_edit = NA)),
               "TRUE/FALSE")
})

test_that("global interaction tier serializes from the option (wire 1.4)", {
  withr::local_options(tabviz.interaction_defaults = list(
    enable_edit = TRUE, bad = "x"
  ))
  df <- data.frame(study = "A", hr = 1)
  wire <- serialize_spec(tabviz(df, label = "study", .spec_only = TRUE))
  expect_true(wire$interactionDefaults$enable_edit)
  expect_false("bad" %in% names(wire$interactionDefaults))

  withr::local_options(tabviz.interaction_defaults = NULL)
  wire2 <- serialize_spec(tabviz(df, label = "study", .spec_only = TRUE))
  expect_null(wire2$interactionDefaults)
})

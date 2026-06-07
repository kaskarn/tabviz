# Theme wire envelope + role overrides + border presets
# (settings-overhaul P0 gates DT-9 / DT-10 / boundary-is-real).
#
# The portable theme artifact is `{$schema, name, inputs, roleOverrides}`.
# These tests pin the R half of the round-trip: set_role/clear_role,
# pin survival across other setters, serialize/deserialize carriage,
# theme_from_wire re-hydration, and the border_preset Tier-1 expansion.

test_that("set_role pins a Tier-2 role and the cssVars reflect it", {
  t0 <- web_theme_cochrane()
  t1 <- suppressWarnings(set_role(t0, "text-muted", "brand", 8))
  v0 <- theme_css_vars(t0)
  v1 <- suppressWarnings(theme_css_vars(t1))
  expect_false(identical(v0[["--tv-text-muted"]], v1[["--tv-text-muted"]]))
  expect_identical(t1@role_overrides[["text-muted"]],
                   list(ramp = "brand", grade = 8L))
})

test_that("role pins survive other set_*() re-resolves (DT pin round-trip)", {
  t <- suppressWarnings(set_role(web_theme_cochrane(), "text-muted", "brand", 8))
  t <- suppressWarnings(set_brand(t, "#7a1f3d"))
  t <- suppressWarnings(set_density(t, density = "spacious"))
  t <- suppressWarnings(set_header_style(t, "bold"))
  expect_length(t@role_overrides, 1L)
  expect_identical(t@role_overrides[["text-muted"]]$grade, 8L)
})

test_that("clear_role releases the pin", {
  t <- suppressWarnings(set_role(web_theme_cochrane(), "text-muted", "brand", 8))
  t <- clear_role(t, "text-muted")
  expect_length(t@role_overrides, 0L)
})

test_that("serialize_theme carries roleOverrides on the wire (DT-9)", {
  t <- suppressWarnings(set_role(web_theme_cochrane(), "text-muted", "brand", 8))
  blob <- suppressWarnings(tabviz:::serialize_theme(t))
  expect_false(is.null(blob$roleOverrides))
  expect_equal(as.numeric(blob$roleOverrides[["text-muted"]]$grade), 8)
  # ... and deserialize restores the slot.
  back <- tabviz:::deserialize_resolved_theme(blob)
  expect_equal(as.numeric(back@role_overrides[["text-muted"]]$grade), 8)
})

test_that("theme_from_wire re-hydrates the studio envelope (DT-9/DT-10)", {
  t1 <- suppressWarnings(set_role(web_theme_cochrane(), "text-muted", "brand", 8))
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
  for (nm in c("cochrane", "nejm", "synthwave", "dark", "ledger")) {
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
    b <- set_border_preset(web_theme_cochrane(), p)@borders
    paste(b@layout, b@major@thickness, b@minor@thickness, b@table@thickness)
  }, "")
  expect_length(unique(sigs), 5L)
  # hairline is the named default — unset themes must not shift.
  d <- web_theme_cochrane()@borders
  h <- set_border_preset(web_theme_cochrane(), "hairline")@borders
  expect_identical(d@layout, h@layout)
  expect_equal(d@major@thickness, h@major@thickness)
  expect_equal(d@table@thickness, h@table@thickness)
})

test_that("border_preset survives the inputs wire", {
  t <- set_border_preset(web_theme_cochrane(), "boxed")
  w <- tabviz:::theme_inputs_to_json(t@inputs)
  expect_identical(w$border_preset, "boxed")
  back <- tabviz:::theme_inputs_from_wire(w)
  expect_identical(back@border_preset, "boxed")
})

test_that("set_role validates ramp and grade", {
  expect_error(set_role(web_theme_cochrane(), "text-muted", "rainbow", 3))
  expect_error(set_role(web_theme_cochrane(), "text-muted", "brand", 0))
  expect_error(set_role(web_theme_cochrane(), "text-muted", "brand", 12))
})

test_that("role pins reach tabviz_theme_css (the widget paint path)", {
  # P0 review #1: theme_css_vars honored pins while tabviz_theme_css
  # (getThemeCSS -> _emitV4CssVarsBody) dropped them — two R entry
  # points disagreed and the live widget diverged from SVG export.
  t0 <- web_theme_cochrane()
  t1 <- suppressWarnings(set_role(t0, "text-muted", "brand", 8))
  css0 <- tabviz_theme_css(t0)
  css1 <- suppressWarnings(tabviz_theme_css(t1))
  expect_false(identical(css0, css1))
  pinned_val <- suppressWarnings(theme_css_vars(t1))[["--tv-text-muted"]]
  expect_match(css1, pinned_val, fixed = TRUE)
})

test_that("set_theme_field on inputs preserves role pins", {
  t <- suppressWarnings(set_role(web_theme_cochrane(), "text-muted", "brand", 8))
  t2 <- suppressWarnings(set_theme_field(t, c("inputs", "density"), "spacious"))
  expect_length(t2@role_overrides, 1L)
})

test_that("read_theme routes wire-envelope files through theme_from_wire", {
  t1 <- suppressWarnings(set_role(web_theme_cochrane(), "text-muted", "brand", 8))
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

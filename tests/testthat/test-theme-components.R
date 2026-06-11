# Component-model Stage 1 (W6) — R surface + wire round-trip.
#
# TS-side wiring (resolver lockstep, ingress validation, cache keys) is
# gated by srcjs/src/lib/theme/component-bindings.test.ts; these tests
# cover the R verb, the artifact round-trip, and R↔TS validation parity
# (one validation source: TS sanitizeComponentBindings via V8).

test_that("list_components() surfaces the curated roster", {
  roster <- list_components()
  expect_s3_class(roster, "data.frame")
  expect_named(roster, c("component", "region", "state", "channel", "css_var"))
  expect_true(all(c("title", "row", "header-cell", "axis-label", "cell")
                  %in% roster$component))
  # The design-doc example address exists: title base col.
  title_col <- roster[roster$component == "title" & roster$state == "base" &
                        roster$channel == "col", ]
  expect_identical(title_col$css_var, "--tv-text-title-fg")
  # Row models its interaction/paint states. (`selected` is honesty-
  # filtered out until --tv-row-selected-bg gains a real consumer.)
  expect_true(all(c("base", "alt", "hover", "emphasis")
                  %in% roster$state[roster$component == "row"]))
  expect_false("selected" %in% roster$state[roster$component == "row"])
})

test_that("set_component re-routes a color channel and re-resolves", {
  th <- web_theme_nejm()
  routed <- set_component(th, "title", col = "text-subtle")
  expect_identical(routed@components$title$base$col, "text-subtle")
  v0 <- theme_css_vars(th)
  v1 <- theme_css_vars(routed)
  expect_false(identical(v1[["--tv-text-title-fg"]], v0[["--tv-text-title-fg"]]))
  # Re-route is cascade-coherent: the value equals the routed role's value.
  expect_identical(v1[["--tv-text-title-fg"]], v1[["--tv-text-subtle"]])
})

test_that("set_component type channels equal the type_roles rebind", {
  th <- web_theme_nejm()
  via_component <- set_component(th, "title", family = "mono")
  via_type_role <- set_type_role(th, "title", family = "mono")
  vc <- theme_css_vars(via_component)
  vt <- theme_css_vars(via_type_role)
  expect_identical(vc[["--tv-text-title-family"]], vt[["--tv-text-title-family"]])
})

test_that("set_component validates against the TS roster (one source)", {
  th <- web_theme_nejm()
  expect_error(set_component(th, "no-such", col = "text"), "not a known component")
  expect_error(set_component(th, "title", bg = "text"), "not a channel")
  expect_error(set_component(th, "title", col = "not-a-role"), "not a valid col")
  expect_error(set_component(th, "title", state = "hover", col = "text"),
               "not a state")
  expect_error(set_component(th, "title"), "at least one")
})

test_that("clear_component releases re-routes (whole + per-state)", {
  th <- web_theme_nejm() |>
    set_component("row", bg = "fill") |>
    set_component("row", state = "alt", bg = "fill-hover")
  one <- clear_component(th, "row", state = "alt")
  expect_null(one@components$row$alt)
  expect_identical(one@components$row$base$bg, "fill")
  none <- clear_component(th, "row")
  expect_null(none@components$row)
  v <- theme_css_vars(none)
  expect_identical(v[["--tv-row-base-bg"]], theme_css_vars(web_theme_nejm())[["--tv-row-base-bg"]])
})

test_that("components survive other set_*() modifiers (re_resolve threading)", {
  th <- web_theme_nejm() |>
    set_component("footnote", col = "text") |>
    set_density("compact")
  expect_identical(th@components$footnote$base$col, "text")
  v <- theme_css_vars(th)
  expect_identical(v[["--tv-text-footnote-fg"]], v[["--tv-text"]])
})

test_that("components ride the wire envelope and round-trip", {
  th <- web_theme_nejm() |>
    set_component("title", col = "accent-text", family = "display") |>
    set_component("row", state = "emphasis", bar = "accent-solid")
  wire <- theme_to_wire(th)
  expect_identical(wire$components$title$base$col, "accent-text")
  expect_identical(wire$components$row$emphasis$bar, "accent-solid")
  # JSON round-trip through the importer (the untrusted path).
  json <- jsonlite::toJSON(wire, auto_unbox = TRUE, null = "null")
  back <- theme_from_wire(json)
  expect_identical(back@components$title$base$col, "accent-text")
  expect_identical(back@components$row$emphasis$bar, "accent-solid")
  # And the resolve reflects it after the round-trip.
  v <- theme_css_vars(back)
  expect_identical(v[["--tv-row-emphasis-bar"]], v[["--tv-accent"]])
})

test_that("a pin-less, component-less wire emits no components member", {
  wire <- theme_to_wire(web_theme_nejm())
  expect_false("components" %in% names(wire))
})

test_that("theme_from_wire rejects invalid components blocks (strict ingress)", {
  wire <- theme_to_wire(web_theme_nejm())
  wire$components <- list("no-such" = list(base = list(col = "text")))
  json <- jsonlite::toJSON(wire, auto_unbox = TRUE, null = "null")
  expect_error(theme_from_wire(json), "not a known component")
  wire$components <- list(title = list(base = list(col = "<script>")))
  json <- jsonlite::toJSON(wire, auto_unbox = TRUE, null = "null")
  expect_error(theme_from_wire(json), "not a valid col")
})

test_that("components reach the serialized spec theme blob (widget wire)", {
  th <- set_component(web_theme_nejm(), "title", col = "accent-text")
  blob <- serialize_theme(th)
  expect_identical(blob$components$title$base$col, "accent-text")
})

test_that("R↔TS roster parity: every R verb target validates TS-side", {
  # The R roster IS the TS roster (fetched via V8), so parity here means:
  # every (component, state, channel) row in list_components() is accepted
  # by the TS validator with a legal value for its channel type.
  roster <- list_components()
  color_channels <- c("col", "bg", "bar", "rule")
  bindings <- list()
  for (i in seq_len(nrow(roster))) {
    comp <- roster$component[i]; st <- roster$state[i]; ch <- roster$channel[i]
    val <- if (ch %in% color_channels) "text" else
      switch(ch, family = "mono", size = "body", weight = "medium")
    rec <- bindings[[comp]] %||% list()
    strec <- rec[[st]] %||% list()
    strec[[ch]] <- val
    rec[[st]] <- strec
    bindings[[comp]] <- rec
  }
  issues <- ts_call("validateComponentBindings", bindings)
  expect_length(issues, 0)
})

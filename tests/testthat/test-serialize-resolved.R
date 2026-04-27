test_that("serialize_theme produces a v2-tagged shape", {
  out <- serialize_theme(WebTheme())
  expect_equal(out$schemaVersion, 2L)
  expect_equal(out$name, "default")
  expect_named(out$variants, c("density", "headerStyle", "firstColumnStyle"))
})

test_that("serialize_theme emits all chrome roles", {
  out <- serialize_theme(WebTheme())
  expect_named(out$surface, c("base", "muted", "raised"))
  expect_named(out$content, c("primary", "secondary", "muted", "inverse"))
  expect_named(out$divider, c("subtle", "strong", "strongOnDark"))
  expect_named(out$accent,  c("default", "muted", "tintSubtle", "tintMedium"))
  expect_named(out$status,  c("positive", "negative", "warning", "info"))
  for (v in unlist(out$surface)) expect_match(v, "^#")
  for (v in unlist(out$accent))  expect_match(v, "^#")
})

test_that("series serializes as JSON-ready array of slot bundles", {
  inputs <- ThemeInputs(series_anchors = c("#1F3A5F", "#B08938", "#6B8E7F"))
  out <- serialize_theme(WebTheme(inputs = inputs))
  expect_length(out$series, 3L)
  for (sb in out$series) {
    expect_named(sb, c("fill", "stroke", "fillMuted", "strokeMuted",
                       "fillEmphasis", "strokeEmphasis", "textFg", "shape"))
    expect_match(sb$fill,   "^#")
    expect_match(sb$stroke, "^#")
  }
})

test_that("series[1] is the pooled-effect anchor (no separate summary slot)", {
  out <- serialize_theme(WebTheme())
  expect_gt(length(out$series), 0L)
  expect_match(out$series[[1]]$fill, "^#")
  expect_false("summary" %in% names(out))
})

test_that("text roles all serialize with 6 fields", {
  out <- serialize_theme(WebTheme())
  expect_named(out$text, c("title", "subtitle", "body", "cell",
                           "label", "tick", "footnote", "caption"))
  for (role in out$text) {
    expect_named(role, c("family", "size", "weight", "figures", "fg", "italic"))
  }
  # caption italic resolves to TRUE.
  expect_true(out$text$caption$italic)
  expect_false(out$text$body$italic)
})

test_that("spacing serializes the density-derived fields", {
  out <- serialize_theme(WebTheme())
  expect_setequal(
    names(out$spacing),
    c("rowHeight", "headerHeight", "padding", "containerPadding", "axisGap",
      "columnGroupPadding", "rowGroupPadding", "cellPaddingX", "cellPaddingY",
      "groupPadding", "footerGap", "titleSubtitleGap", "headerGap",
      "bottomMargin", "indentPerLevel")
  )
  for (v in out$spacing) expect_type(v, "double")
})

test_that("header cluster carries both variants + text", {
  out <- serialize_theme(WebTheme())
  expect_named(out$header, c("light", "bold", "text"))
  expect_named(out$header$light, c("bg", "fg", "rule"))
  expect_named(out$header$bold,  c("bg", "fg", "rule"))
  expect_match(out$header$light$bg, "^#")
  expect_match(out$header$bold$bg,  "^#")
})

test_that("first_column cluster carries both variants", {
  out <- serialize_theme(WebTheme())
  expect_named(out$firstColumn, c("plain", "bold"))
  expect_named(out$firstColumn$bold, c("bg", "fg", "rule", "weight"))
  expect_equal(out$firstColumn$bold$weight, 600)
})

test_that("row cluster has all states + semantic bundles + banding", {
  out <- serialize_theme(WebTheme())
  expect_named(out$row, c("base", "alt", "hover", "selected",
                          "emphasis", "muted", "accent",
                          "bold", "fill",
                          "banding", "selectedEdgeWidth", "borderWidth"))
  expect_named(out$row$base, c("bg", "fg"))
  expect_named(out$row$emphasis,
               c("bg", "fg", "border", "markerFill", "fontWeight", "fontStyle"))
  # Banding emits the parsed shape.
  expect_named(out$row$banding, c("mode", "level"))
})

test_that("plot scaffolding serializes label TextRoles", {
  out <- serialize_theme(WebTheme())
  expect_named(out$plot, c("bg", "axisLine", "tickMark", "gridline",
                           "reference", "axisLabel", "tickLabel",
                           "tickMarkLength", "lineWidth", "pointSize"))
  expect_named(out$plot$axisLabel,
               c("family", "size", "weight", "figures", "fg", "italic"))
})

test_that("marks recipes emit forest/summary/bar/box/violin/lollipop", {
  out <- serialize_theme(WebTheme())
  expect_named(out$marks, c("forest", "summary", "bar", "box", "violin", "lollipop"))
  expect_named(out$marks$forest, c("body", "outline", "line"))
  expect_equal(out$marks$forest$body, "fill")
})

test_that("NA fields emit as JSON null (omitted from R list)", {
  out <- serialize_theme(WebTheme())
  # plot.bg defaults transparent (NA) -> null
  expect_null(out$plot$bg)
  # firstColumn.plain.bg is unset by resolution -> null
  expect_null(out$firstColumn$plain$bg)
})

test_that("each preset roundtrips cleanly through serialize_theme", {
  for (preset_fn in list(
    web_theme_cochrane, web_theme_lancet, web_theme_jama, web_theme_dark
  )) {
    out <- serialize_theme(preset_fn())
    expect_equal(out$schemaVersion, 2L)
    # JSON-encode then decode and make sure we don't crash on the round trip.
    json <- jsonlite::toJSON(out, auto_unbox = TRUE, null = "null")
    rt <- jsonlite::fromJSON(json, simplifyVector = FALSE)
    expect_equal(rt$schemaVersion, 2L)
    expect_match(rt$surface$base, "^#")
  }
})

test_that("serialize_theme rejects non-theme inputs", {
  expect_error(serialize_theme(list()), "WebTheme")
  expect_error(serialize_theme("default"), "WebTheme")
})

test_that("variant flag flows through to serialized variants", {
  out <- serialize_theme(WebTheme(
    variants = ThemeVariants(header_style = "bold", first_column_style = "bold")
  ))
  expect_equal(out$variants$headerStyle, "bold")
  expect_equal(out$variants$firstColumnStyle, "bold")
})

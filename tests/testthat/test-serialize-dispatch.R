# Verifies that serialize_spec() routes WebTheme1 vs WebTheme2 correctly
# and that the v2->v1 shim produces a renderable v1-shape.

test_that("serialize_spec dispatches on theme class", {
  df <- data.frame(study = "A", est = 0.5, lo = 0.2, hi = 0.8)

  spec_v1 <- tabviz(df, label = "study", .spec_only = TRUE,
                   theme = web_theme_default())
  spec_v2 <- tabviz(df, label = "study", .spec_only = TRUE,
                   theme = web_theme_default_v2())

  out_v1 <- serialize_spec(spec_v1)
  out_v2 <- serialize_spec(spec_v2)

  # Both produce v1-shape structure (top-level keys identical).
  expect_setequal(names(out_v1$theme), names(out_v2$theme))
  expect_true("colors" %in% names(out_v2$theme))
  expect_true("typography" %in% names(out_v2$theme))
  expect_true("spacing" %in% names(out_v2$theme))
})

test_that("v2 dispatch picks active header variant for headerBg", {
  df <- data.frame(study = "A", est = 0.5, lo = 0.2, hi = 0.8)

  inputs <- ThemeInputs(brand_deep = "#000000", neutral = c("#FFF","#FFF","#EEE","#999","#222"))
  spec_light <- tabviz(df, label = "study", .spec_only = TRUE,
                       theme = WebTheme2(inputs = inputs,
                                        variants = ThemeVariants(header_style = "light")))
  spec_bold  <- tabviz(df, label = "study", .spec_only = TRUE,
                       theme = WebTheme2(inputs = inputs,
                                        variants = ThemeVariants(header_style = "bold")))

  out_light <- serialize_spec(spec_light)
  out_bold  <- serialize_spec(spec_bold)

  expect_false(identical(out_light$theme$colors$headerBg, out_bold$theme$colors$headerBg))
  expect_equal(toupper(out_bold$theme$colors$headerBg), "#000000")
})

test_that("v2 effect colors flow through to v1 shapes.effectColors", {
  df <- data.frame(study = "A", est = 0.5, lo = 0.2, hi = 0.8)
  spec <- tabviz(df, label = "study", .spec_only = TRUE,
                theme = WebTheme2(inputs = ThemeInputs(
                  series_anchors = c("#1F3A5F", "#B08938", "#6B8E7F")
                )))
  out <- serialize_spec(spec)
  expect_length(out$theme$shapes$effectColors, 3L)
  expect_equal(toupper(as.character(out$theme$shapes$effectColors[1])), "#1F3A5F")
})

test_that("v2 banding flag flows through", {
  df <- data.frame(study = "A", est = 0.5, lo = 0.2, hi = 0.8)
  t <- WebTheme2()
  t@row@banding <- "row"
  spec <- tabviz(df, label = "study", .spec_only = TRUE, theme = t)
  out <- serialize_spec(spec)
  expect_equal(out$theme$layout$banding$mode, "row")
})

test_that("each v2 preset produces a non-empty v1-shape spec", {
  df <- data.frame(study = "A", est = 0.5, lo = 0.2, hi = 0.8)
  for (preset in package_themes_v2()) {
    spec <- tabviz(df, label = "study", .spec_only = TRUE, theme = preset)
    out <- serialize_spec(spec)
    expect_match(out$theme$colors$background, "^#")
    expect_match(out$theme$colors$foreground, "^#")
    expect_match(out$theme$colors$rowBg, "^#")
    expect_match(out$theme$colors$summaryFill, "^#")
    expect_gt(out$theme$spacing$rowHeight, 0)
    expect_length(out$theme$shapes$effectColors, 5L)
  }
})

test_that("v2 row semantics flow through to semantics serialized", {
  df <- data.frame(study = "A", est = 0.5, lo = 0.2, hi = 0.8)
  spec <- tabviz(df, label = "study", .spec_only = TRUE,
                theme = web_theme_default_v2())
  out <- serialize_spec(spec)
  expect_equal(out$theme$semantics$emphasis$fontWeight, 600)
  expect_match(out$theme$semantics$emphasis$markerFill, "^#")
  expect_match(out$theme$semantics$accent$markerFill, "^#")
})

# Tests for ThemeInputsV3 (PR A scope) — class constructor + validator
# + JSON serialization. Consumer wiring (resolver call via V8) lands in
# PR F; this test only exercises the class shape.

test_that("ThemeInputsV3 constructs with defaults", {
  inp <- ThemeInputsV3()
  expect_true(inherits(inp, "tabviz::ThemeInputsV3"))
  expect_equal(inp@brand, "#0099CC")
  expect_true(is.na(inp@accent))
  expect_true(is.na(inp@decorative))
  expect_equal(inp@mode, "light")
  expect_equal(inp@neutral_tint, "untinted")
  expect_equal(inp@categorical, "okabe_ito")
})

test_that("ThemeInputsV3 accepts explicit values", {
  inp <- ThemeInputsV3(
    brand = "#003DA5",
    accent = "#A6792A",
    decorative = "#A6792A",
    mode = "light",
    neutral_tint = "brand",
    categorical = "tableau10",
    density = "compact"
  )
  expect_equal(inp@brand, "#003DA5")
  expect_equal(inp@decorative, "#A6792A")
  expect_equal(inp@neutral_tint, "brand")
  expect_equal(inp@categorical, "tableau10")
  expect_equal(inp@density, "compact")
})

test_that("ThemeInputsV3 validator rejects bad hex", {
  expect_error(ThemeInputsV3(brand = "blue"), "brand must be a hex")
  expect_error(ThemeInputsV3(accent = "notahex"), "accent must be a hex")
  expect_error(ThemeInputsV3(decorative = "rgb(0,0,0)"), "decorative must be a hex")
})

test_that("ThemeInputsV3 validator accepts NA for optional fields", {
  inp <- ThemeInputsV3(brand = "#000000", accent = NA_character_)
  expect_true(is.na(inp@accent))
})

test_that("ThemeInputsV3 validator rejects bad neutral_tint", {
  expect_error(ThemeInputsV3(neutral_tint = "rainbow"),
               "neutral_tint must be")
})

test_that("ThemeInputsV3 validator accepts hex neutral_tint", {
  inp <- ThemeInputsV3(neutral_tint = "#888888")
  expect_equal(inp@neutral_tint, "#888888")
})

test_that("ThemeInputsV3 validator rejects bad mode and density", {
  expect_error(ThemeInputsV3(mode = "auto"), "mode must be")
  expect_error(ThemeInputsV3(density = "tight"), "density must be")
})

test_that("theme_inputs_v3_to_json emits the expected shape", {
  inp <- ThemeInputsV3(
    brand = "#003DA5",
    decorative = "#A6792A",
    mode = "light",
    categorical = "tableau10"
  )
  j <- tabviz:::theme_inputs_v3_to_json(inp)
  expect_equal(j$brand, "#003DA5")
  expect_equal(j$decorative, "#A6792A")
  expect_equal(j$mode, "light")
  expect_equal(j$categorical, "tableau10")
  # NA accent → not present in JSON
  expect_false("accent" %in% names(j))
})

test_that("theme_inputs_v3_to_json wraps hex neutral_tint as tagged object", {
  inp <- ThemeInputsV3(neutral_tint = "#FF0000")
  j <- tabviz:::theme_inputs_v3_to_json(inp)
  expect_type(j$neutral_tint, "list")
  expect_equal(j$neutral_tint$hex, "#FF0000")
})

test_that("theme_inputs_v3_to_json keeps enum neutral_tint as string", {
  inp <- ThemeInputsV3(neutral_tint = "brand")
  j <- tabviz:::theme_inputs_v3_to_json(inp)
  expect_equal(j$neutral_tint, "brand")
})

test_that("theme_inputs_v3_to_json omits empty status block", {
  # All status fields default to non-NA, so status block has 4 entries
  inp <- ThemeInputsV3()
  j <- tabviz:::theme_inputs_v3_to_json(inp)
  expect_equal(length(j$status), 4L)
})

# Column-schema introspection — the queryable column contract (R wrappers
# over the TS SCHEMA_REGISTRY via V8).

test_that("list_column_types() returns the concrete column roster", {
  ct <- list_column_types()
  expect_s3_class(ct, "data.frame")
  expect_setequal(
    names(ct),
    c("type", "label", "options", "themeable", "inherits")
  )
  expect_true(all(c("pvalue", "numeric", "bar", "viz_forest") %in% ct$type))
  # Abstract structural schemas are never column types.
  expect_false(any(c("base", "sortable", "viz") %in% ct$type))
  # Sorted + every type has at least one themeable option (<= total).
  expect_identical(ct$type, sort(ct$type))
  expect_true(all(ct$themeable >= 1L))
  expect_true(all(ct$themeable <= ct$options))
})

test_that("column_schema() describes a type's option contract", {
  cs <- column_schema("pvalue")
  expect_s3_class(cs, "data.frame")
  expect_setequal(
    names(cs),
    c("option", "kind", "themeable", "control", "default", "choices",
      "hint", "inherited_from")
  )
  by <- function(opt) cs[cs$option == opt, ]

  # Presentation options were reclassified to styling (theme-defaultable).
  expect_identical(by("stars")$kind, "styling")
  expect_true(by("stars")$themeable)
  # Precision stays core — a theme can't change what the number means.
  expect_identical(by("digits")$kind, "core")
  expect_false(by("digits")$themeable)
  # Inherited layout option carries its source schema.
  expect_identical(by("width")$inherited_from, "base")
  # Enum choices are surfaced as a comma string (no padding).
  expect_match(by("starsColor")$choices, "accent")
  expect_false(grepl("  ", by("starsColor")$choices)) # trimmed
})

test_that("column_schema() themeable subset == set_column_default's reach", {
  # Every option column_schema() marks themeable is exactly one a theme's
  # column_defaults may set; core options are excluded. This keeps the
  # discovery surface honest against the merge's kind-gate.
  cs <- column_schema("pvalue")
  expect_true("stars" %in% cs$option[cs$themeable])
  expect_true("significantStyle" %in% cs$option[cs$themeable])
  expect_false("digits" %in% cs$option[cs$themeable])
  expect_false("thresholds" %in% cs$option[cs$themeable])
})

test_that("column_schema() rejects unknown + abstract types", {
  expect_error(column_schema("not_a_real_type"))
  expect_error(column_schema("base"), "abstract")
})

# Verify the wire-format version constant stays in sync between R and JS.
#
# This is the round-trip sync check for the spec §2.5 G6 audit point. The
# R serializer emits `WIRE_FORMAT_VERSION` on every payload; the JS ingest
# layer expects `CURRENT_VERSION` to match. If they drift, every widget
# render throws — better to catch it at `devtools::test()` time.

test_that("WIRE_FORMAT_VERSION matches CURRENT_VERSION in srcjs/src/spec/index.ts", {
  ts_path <- testthat::test_path("..", "..", "srcjs", "src", "spec", "index.ts")
  skip_if_not(file.exists(ts_path), "Could not locate srcjs/src/spec/index.ts")

  ts_source <- readLines(ts_path)
  ts_match <- regmatches(
    ts_source,
    regexec('CURRENT_VERSION\\s*=\\s*"([^"]+)"', ts_source)
  )
  ts_version <- NA_character_
  for (m in ts_match) {
    if (length(m) >= 2L) {
      ts_version <- m[[2L]]
      break
    }
  }
  expect_false(
    is.na(ts_version),
    info = "Could not find CURRENT_VERSION literal in srcjs/src/spec/index.ts"
  )

  expect_identical(
    WIRE_FORMAT_VERSION,
    ts_version,
    info = paste0(
      "R-side WIRE_FORMAT_VERSION = '", WIRE_FORMAT_VERSION,
      "' but JS-side CURRENT_VERSION = '", ts_version, "'. ",
      "These must match — update both, per docs/dev/frontend-split-spec.md §3.4."
    )
  )
})

test_that("serialize_spec emits version on every payload", {
  df <- data.frame(
    study = c("A", "B", "C"),
    mpg   = c(21, 22, 23)
  )
  spec <- tabviz(df, label = "study", .spec_only = TRUE)
  payload <- serialize_spec(spec)
  expect_identical(payload$version, WIRE_FORMAT_VERSION)
})

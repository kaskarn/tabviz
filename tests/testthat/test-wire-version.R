# Verify the wire-format version constant stays in sync between R and JS.
#
# This is the round-trip sync check for the spec §2.5 G6 audit point. The
# R serializer emits `WIRE_FORMAT_VERSION` on every payload; the JS ingest
# layer expects `CURRENT_VERSION` to match. If they drift, every widget
# render throws — better to catch it at `devtools::test()` time.

# This gate also runs in R-CMD-check's in-tree step under `library(tabviz)`,
# where the package INTERNALS below are not on the search path (they ARE under
# devtools::test()'s load_all). Bind them via `tabviz:::` so both harnesses
# resolve them — the same convention as test-systemfonts-injection.R.
WIRE_FORMAT_VERSION <- tabviz:::WIRE_FORMAT_VERSION
serialize_spec      <- tabviz:::serialize_spec
TABVIZ_STATE_FIELDS <- tabviz:::TABVIZ_STATE_FIELDS

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

# ──────────────────────────────────────────────────────────────────────
# Sync check: TABVIZ_STATE_FIELDS (R) ↔ SHINY_EVENT_FIELDS (JS)
# ──────────────────────────────────────────────────────────────────────
# When the widget's typed event emitter (Phase 0a-S3) ships a new field,
# both lists must update. The two lists' contents must be identical (as
# sets); the test below extracts the JS list with a regex and compares.

test_that("TABVIZ_STATE_FIELDS matches SHINY_EVENT_FIELDS in srcjs/src/spec/events.ts", {
  ts_path <- testthat::test_path("..", "..", "srcjs", "src", "spec", "events.ts")
  skip_if_not(file.exists(ts_path), "Could not locate srcjs/src/spec/events.ts")

  ts_source <- paste(readLines(ts_path), collapse = "\n")

  # Match: export const SHINY_EVENT_FIELDS = [...content...] as const;
  ts_match <- regmatches(
    ts_source,
    regexec(
      "export\\s+const\\s+SHINY_EVENT_FIELDS\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const",
      ts_source,
      perl = TRUE
    )
  )
  expect_true(
    length(ts_match) >= 1 && length(ts_match[[1]]) >= 2,
    info = "Could not find SHINY_EVENT_FIELDS array literal in srcjs/src/spec/events.ts"
  )

  raw <- ts_match[[1]][2]
  # Extract every quoted string from the array body, ignoring comments.
  ts_fields <- regmatches(raw, gregexpr('"([^"]+)"', raw, perl = TRUE))[[1]]
  ts_fields <- gsub('^"|"$', "", ts_fields)

  expect_setequal(ts_fields, TABVIZ_STATE_FIELDS)
})

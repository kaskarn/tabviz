# R↔TS parity test for conditions (schema-sprint Phase 5c).
#
# The R side materializes a condition's boolean vector at web_spec()
# time; the TS side consumes it via `banks.conditions[name].values[i]`
# during style resolution. This file verifies the wire-shape contract
# between them is byte-stable through JSON serialization — the same
# round-trip path R uses to ship the spec to the browser / V8.

library(testthat)

# Equivalent boolean vector for the same data + rule, computed locally
# without going through R's evaluator — this is the "expected" oracle
# both sides must match.
expected_sig <- function(data) {
  as.logical(data$p < 0.05)
}

test_that("R-evaluated condition vector matches the oracle (formula rule)", {
  d <- data.frame(study = paste0("S", 1:6), p = c(0.001, 0.04, 0.06, 0.5, 0.0001, 0.07))
  spec <- tabviz(
    data = d,
    label = "study",
    conditions = list(condition("sig", ~ p < 0.05)),
    .spec_only = TRUE
  )
  # The R-side materialized vector aligns with original row order.
  expect_equal(spec@conditions[[1]]$values, expected_sig(d))
})

test_that("JSON round-trip preserves boolean vector shape verbatim", {
  d <- data.frame(study = c("A", "B"), p = c(0.01, 0.5))
  spec <- tabviz(
    data = d,
    label = "study",
    conditions = list(condition("sig", ~ p < 0.05)),
    .spec_only = TRUE
  )
  wire <- tabviz:::serialize_spec(spec)
  json <- jsonlite::toJSON(wire, auto_unbox = TRUE, null = "null", na = "null")
  parsed <- jsonlite::fromJSON(json, simplifyVector = TRUE, simplifyDataFrame = FALSE)
  # Wire shape TS consumes
  expect_equal(parsed$banks$conditions[[1]]$id, "sig")
  expect_equal(parsed$banks$conditions[[1]]$kind, "boolean")
  expect_equal(parsed$banks$conditions[[1]]$values, c(TRUE, FALSE))
})

test_that("cond() in styleMapping survives JSON round-trip with tagged-union shape", {
  d <- data.frame(study = c("A", "B"), p = c(0.01, 0.5))
  spec <- tabviz(
    data = d,
    label = "study",
    conditions = list(condition("sig", ~ p < 0.05)),
    columns = list(col_text("study", bold = cond("sig"))),
    .spec_only = TRUE
  )
  wire <- tabviz:::serialize_spec(spec)
  json <- jsonlite::toJSON(wire, auto_unbox = TRUE, null = "null", na = "null")
  parsed <- jsonlite::fromJSON(json, simplifyVector = TRUE, simplifyDataFrame = FALSE)
  bold <- parsed$columns[[1]]$styleMapping$bold
  expect_equal(bold$kind, "condition")
  expect_equal(bold$name, "sig")
})

test_that("Condition vector keys against original row order (Phase 1 keystone proof)", {
  # The condition vector is indexed by ORIGINAL row order. Sort on
  # the R side reorders display rows but doesn't touch the underlying
  # canonical data, so condition[i] still refers to data.rows[i].
  # This mirrors the TS-side guarantee from the index-based view
  # model (Phase 1).
  d <- data.frame(study = c("A", "B", "C"), p = c(0.5, 0.01, 0.04))
  spec <- tabviz(
    data = d,
    label = "study",
    conditions = list(condition("sig", ~ p < 0.05)),
    .spec_only = TRUE
  )
  # The materialized vector maps 1:1 with d's original row order.
  expect_equal(spec@conditions[[1]]$values, c(FALSE, TRUE, TRUE))
  # The wire ships rows in the same order, so condition[i] aligns
  # with rows[i] regardless of any client-side sort.
  wire <- tabviz:::serialize_spec(spec)
  expect_equal(length(wire$data$rows), 3L)
  # Labels (study names) come from the label column in the same order.
  row_labels <- vapply(wire$data$rows, function(r) r$label, character(1))
  expect_equal(row_labels, c("A", "B", "C"))
})

test_that("inspect_resolved returns value + cascade + derivation for header.bold.bg", {
  t <- web_theme_cochrane()
  out <- inspect_resolved(t, "header.bold.bg")
  expect_equal(out$path, "header.bold.bg")
  expect_match(out$value, "^#")
  # header.bold.bg = inputs$primary_deep, which auto-darkens from
  # inputs$primary when not pinned.
  expect_equal(out$value, t@inputs@primary_deep)
  expect_true("inputs$primary_deep" %in% out$cascade)
  expect_true("inputs$primary" %in% out$cascade)
  expect_match(out$derivation, "primary_deep")
})

test_that("inspect_resolved on chrome leaf reads from secondary_deep", {
  t <- web_theme_cochrane()
  out <- inspect_resolved(t, "divider.strong")
  expect_match(out$value, "^#")
  expect_true("inputs$secondary_deep" %in% out$cascade)
})

test_that("inspect_resolved on accent leaf reads inputs$accent", {
  t <- web_theme_cochrane()
  out <- inspect_resolved(t, "accent.default")
  expect_equal(out$value, t@accent@default)
  expect_equal(out$value, t@inputs@accent)
  expect_true("inputs$accent" %in% out$cascade)
})

test_that("inspect_resolved works on a 2-color theme: column_group.bold reads secondary", {
  t <- web_theme_dwarven()
  out <- inspect_resolved(t, "column_group.bold.bg")
  expect_equal(out$value, t@inputs@secondary_deep)
  # Dwarven pins secondary distinct from primary, so cascade reflects that.
  expect_true("inputs$secondary_deep" %in% out$cascade)
})

test_that("inspect_resolved errors on unknown path", {
  t <- web_theme_cochrane()
  expect_error(inspect_resolved(t, "no.such.leaf"), "Unknown leaf path")
})

test_that("inspect_resolved errors on non-WebTheme input", {
  expect_error(inspect_resolved("not a theme", "header.bold.bg"), "WebTheme")
})

test_that("inspect_resolved covers all three header_style variants", {
  t <- web_theme_cochrane()
  expect_equal(inspect_resolved(t, "header.light.bg")$value, t@header@light@bg)
  expect_equal(inspect_resolved(t, "header.tint.bg")$value,  t@header@tint@bg)
  expect_equal(inspect_resolved(t, "header.bold.bg")$value,  t@header@bold@bg)
})

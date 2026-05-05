# Reproduces the sandbox-blocked download flow without needing an IDE.
#
# Run from the repo root:
#   Rscript tests/manual/sandbox-download.R
# then open tests/manual/sandbox-download.html in any browser.
#
# The harness iframes a tabviz widget with `sandbox="allow-scripts
# allow-same-origin"` (no `allow-downloads`). Clicking the button in the
# inner widget should fall through to the ExportFallbackModal — same
# behavior we expect inside VSCode's R Viewer.

library(tabviz)

out_dir <- "tests/manual"
widget_html <- file.path(out_dir, "sandbox-widget.html")

example <- tabviz(
  data.frame(
    study = c("Study A", "Study B", "Study C"),
    estimate = c(1.2, 0.8, 1.5),
    lower = c(0.9, 0.5, 1.1),
    upper = c(1.6, 1.2, 2.0)
  ),
  label = "study",
  columns = list(
    viz_forest(point = "estimate", lower = "lower", upper = "upper")
  )
)

htmlwidgets::saveWidget(example, widget_html, selfcontained = TRUE)

harness <- '<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>tabviz sandbox-download harness</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
    p { max-width: 60ch; line-height: 1.5; }
    iframe { width: 100%; height: 600px; border: 1px solid #e2e8f0; border-radius: 8px; }
    code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Sandbox-blocked download repro</h1>
  <p>The widget below is iframed with
    <code>sandbox="allow-scripts allow-same-origin"</code> (no
    <code>allow-downloads</code>). Click the download button in the widget
    toolbar; the SVG/PNG <em>should</em> open in the
    <code>ExportFallbackModal</code> with copy-to-clipboard.</p>
  <iframe src="sandbox-widget.html" sandbox="allow-scripts allow-same-origin"></iframe>
</body>
</html>
'
writeLines(harness, file.path(out_dir, "sandbox-download.html"))

cli::cli_inform(c(
  "v" = "Wrote {.path {file.path(out_dir, \"sandbox-download.html\")}}",
  "i" = "Open it in a browser to repro the modal flow."
))

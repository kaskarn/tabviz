# Perf probe for the export.qmd CI slowness (see perf-probe.yaml).
# Times each stage of the save_plot pipeline separately so the ~100s/chunk
# stall on ubuntu runners can be attributed.

suppressMessages(library(tabviz))

tic <- function() assign(".t0", Sys.time(), envir = .GlobalEnv)
toc <- function(lbl) {
  cat(sprintf("PROBE %-42s %8.2fs\n", lbl,
              as.numeric(Sys.time() - .t0, units = "secs")))
}

cat("PROBE V8 engine:", V8::engine_info()$version, "\n")
cat("PROBE cores:", parallel::detectCores(), "\n")

# ── V8 init (bundle source) ─────────────────────────────────────────
tic(); invisible(tabviz:::tabviz_v8()); toc("V8 init + bundle source")

# ── ts_call micro ───────────────────────────────────────────────────
theme_wire <- tabviz:::serialize_theme(web_theme())
tic(); for (i in 1:10) invisible(tabviz:::ts_call("getThemeCSS", theme_wire))
toc("10x ts_call getThemeCSS")

# ── spec build ──────────────────────────────────────────────────────
data(glp1_trials)
df <- subset(glp1_trials, row_type == "data")
tic()
p <- tabviz(df, label = "study",
  columns = list(
    viz_forest(point = "hr", lower = "lower", upper = "upper",
               scale = "log", null_value = 1, width = 180),
    col_interval("hr", "lower", "upper", header = "HR (95% CI)")))
toc("tabviz() spec build")

# ── systemfonts injection (isolated) ────────────────────────────────
spec <- tabviz:::extract_webspec(p)
tic()
s2 <- tryCatch(tabviz:::.inject_systemfonts_widths(spec),
  error = function(e) {
    cat("PROBE inject errored:", conditionMessage(e), "\n"); NULL })
toc(".inject_systemfonts_widths")

# ── serialize + raw V8 SVG generation (isolated) ────────────────────
tic()
spec_json <- jsonlite::toJSON(tabviz:::serialize_spec(spec),
  auto_unbox = TRUE, null = "null", na = "null")
toc("serialize + toJSON")
tic()
invisible(tabviz:::generate_svg_v8(spec_json, list(), return_metadata = TRUE))
toc("generate_svg_v8 (raw)")

# ── full save_plot: SVG cold + warm ─────────────────────────────────
tic(); save_plot(p, tempfile(fileext = ".svg"), width = 700)
toc("save_plot SVG (cold)")
tic(); save_plot(p, tempfile(fileext = ".svg"), width = 700)
toc("save_plot SVG (warm)")

# ── jama theme (web fonts on the SVG embed path) ────────────────────
p_jama <- tabviz(df, label = "study",
  columns = list(col_interval("hr", "lower", "upper", header = "CI")),
  theme = web_theme_jama())
tic(); save_plot(p_jama, tempfile(fileext = ".svg"), width = 500)
toc("save_plot SVG jama (font fetch cold)")

# ── PDF path (rsvg + fontconfig) ────────────────────────────────────
if (requireNamespace("rsvg", quietly = TRUE)) {
  tic(); save_plot(p, tempfile(fileext = ".pdf"), width = 700)
  toc("save_plot PDF (rsvg cold)")
}

cat("PROBE done\n")

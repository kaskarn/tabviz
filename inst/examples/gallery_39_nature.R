# Gallery Example 39: Nature
# Nature journal — deep red brand primary, charcoal secondary, sky-blue
# accent, PT Serif body with system-sans display. Modern editorial
# register; distinct from JAMA/Lancet/NEJM by leading with a chromatic
# red rather than navy/black.

library(tabviz)

nature_data <- data.frame(
  finding      = c("Single-cell RNA-seq",
                   "Gut microbiome",
                   "Quantum sensor",
                   "Catalyst",
                   "Atmospheric CO₂",
                   "Synaptic plasticity"),
  field        = c("Biology", "Biology", "Physics",
                   "Chemistry", "Climate", "Neuroscience"),
  citations    = c(1248, 892, 524, 318, 2105, 681),
  altmetric    = c(389, 612, 84, 47, 1240, 156),
  open_access  = c(TRUE, TRUE, FALSE, TRUE, TRUE, FALSE)
)

tabviz(
  nature_data,
  label = "finding",
  label_header = "Headline finding",
  theme = web_theme_nejm(),
  columns = list(
    col_text("field", header = "Field"),
    col_numeric("citations", header = "Citations", decimals = 0, thousands_sep = ","),
    col_numeric("altmetric", header = "Altmetric", decimals = 0, thousands_sep = ","),
    col_icon("open_access", header = "OA")
  ),
  title = "High-impact publications of the quarter",
  caption = "Theme: Nature. Brand-red identity with sky-blue accent."
)

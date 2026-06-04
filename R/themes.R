# Journal preset constructors + the canonical dark mode + the package
# preset registry. Stage 4 reimagining (2026-06-04): each preset
# showcases distinctive substrate features (shell mode, surface texture,
# type scale, curves, web fonts) per the v4 cascade.

#' Cochrane theme - cyan brand, orange accent.
#'
#' Vanilla baseline. Ease curve on neutrals for smooth gradation.
#' @return A [WebTheme].
#' @export
web_theme_cochrane <- function() {
  web_theme(
    brand = "#0099CC",
    accent = "#C8553D",
    categorical = "okabe_ito",
    font_body = "'Inter', -apple-system, system-ui, 'Segoe UI', sans-serif",
    web_fonts = list(
      web_font("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap")
    ),
    curves = list(neutral = "ease"),
    name = "cochrane"
  )
}

#' Lancet theme - navy + gold editorial gravitas.
#'
#' Raised shell evokes the cover feel; serif typography with elevated
#' scale ratio gives long-form journal rhythm.
#' @return A [WebTheme].
#' @export
web_theme_lancet <- function() {
  web_theme(
    brand = "#00407A",
    decorative = "#A6792A",
    accent = "#A6792A",
    categorical = "okabe_ito",
    shell_mode = "raised",
    type_scale_ratio = 1.25,
    font_body = "Georgia, 'Times New Roman', serif",
    font_display = "Georgia, 'Times New Roman', serif",
    curves = list(neutral = "smooth"),
    name = "lancet"
  )
}

#' JAMA theme - black ink, mono palette, compact density.
#'
#' Tight type scale (1.15) + smaller base size (13) for the dense
#' scientific-table look.
#' @return A [WebTheme].
#' @export
web_theme_jama <- function() {
  web_theme(
    brand = "#000000",
    accent = "#000000",
    categorical = "brand_mono",
    density = "compact",
    type_base_size = 13,
    type_scale_ratio = 1.15,
    font_body = "Arial, Helvetica, sans-serif",
    name = "jama"
  )
}

#' NEJM theme - crimson brand + slate accent, classic medical serif.
#' @return A [WebTheme].
#' @export
web_theme_nejm <- function() {
  web_theme(
    brand = "#BD2F2F",
    accent = "#1B5377",
    categorical = "okabe_ito",
    type_scale_ratio = 1.25,
    font_body = "Georgia, 'Times New Roman', serif",
    font_display = "Georgia, 'Times New Roman', serif",
    curves = list(brand = "smooth", neutral = "ease"),
    name = "nejm"
  )
}

#' Nature theme - teal brand + amber accent, raised shell + ruled texture.
#'
#' Subtle brand-tinted neutrals (0.03 strength) give the page a soft
#' teal cast - the glossy-spread metaphor.
#' @return A [WebTheme].
#' @export
web_theme_nature <- function() {
  web_theme(
    brand = "#005A6C",
    accent = "#E8A427",
    categorical = "okabe_ito",
    shell_mode = "raised",
    shell_texture = "ruled",
    neutral_tint = "brand",
    neutral_tint_strength = 0.03,
    type_scale_ratio = 1.25,
    curves = list(brand = "smooth"),
    name = "nature"
  )
}

#' BMJ theme - clean clinical blue + red accent.
#' @return A [WebTheme].
#' @export
web_theme_bmj <- function() {
  web_theme(
    brand = "#2A6EBB",
    accent = "#E33B3B",
    categorical = "okabe_ito",
    font_body = "'Inter', -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap")
    ),
    curves = list(neutral = "ease"),
    name = "bmj"
  )
}

#' Dark theme - blue brand, pink accent, float shell.
#'
#' Removes chrome so the paper appears to drift on its own elevation
#' shadow. Log curve deepens darks; ease on brand+accent keeps callouts
#' vivid.
#' @return A [WebTheme].
#' @export
web_theme_dark <- function() {
  web_theme(
    brand = "#89B4FA",
    accent = "#F38BA8",
    mode = "dark",
    neutral_tint = "brand",
    neutral_tint_strength = 0.06,
    categorical = "okabe_ito",
    shell_mode = "float",
    curves = list(neutral = "log", brand = "ease", accent = "ease"),
    name = "dark"
  )
}


#' Available theme presets, organized by category.
#'
#' @return A nested list: category -> list of resolved [WebTheme] objects.
#' @export
package_themes <- function() {
  list(
    journals = list(
      cochrane  = web_theme_cochrane(),
      lancet    = web_theme_lancet(),
      jama      = web_theme_jama(),
      nejm      = web_theme_nejm(),
      nature    = web_theme_nature(),
      bmj       = web_theme_bmj(),
      dark      = web_theme_dark()
    ),
    design = list(
      bauhaus         = web_theme_bauhaus(),
      swiss           = web_theme_swiss(),
      tufte           = web_theme_tufte(),
      newsprint       = web_theme_newsprint(),
      solarized       = web_theme_solarized(),
      solarized_dark  = web_theme_solarized_dark(),
      tonal           = web_theme_tonal(),
      tonal_dark      = web_theme_tonal_dark()
    ),
    lotr = list(
      dwarven = web_theme_dwarven(),
      elvish  = web_theme_elvish(),
      hobbit  = web_theme_hobbit()
    ),
    showcase = list(
      synthwave = web_theme_synthwave(),
      atelier   = web_theme_atelier(),
      executive = web_theme_executive()
    )
  )
}

#' Flat name-to-theme map across all preset categories.
#'
#' @return A named list of [WebTheme] objects.
#' @export
theme_registry <- function() {
  cats <- package_themes()
  flat <- list()
  for (cat in cats) {
    for (nm in names(cat)) flat[[nm]] <- cat[[nm]]
  }
  flat
}

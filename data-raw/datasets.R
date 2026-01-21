# Generate package datasets for webforest
# Run this script to regenerate the .rda files in data/

# ============================================================================
# GLP-1 Agonist Cardiovascular Trials
# ============================================================================
# Realistic meta-analysis data for GLP-1 agonist cardiovascular outcomes trials
# Based on published trial data (stylized for educational purposes)

glp1_trials <- data.frame(
  study = c(
    "SUSTAIN-6", "PIONEER 6", "LEADER", "REWIND", "EXSCEL",
    "AMPLITUDE-O", "ELIXA", "Harmony Outcomes", "FREEDOM-CVO",
    "SOUL", "SURPASS-CVOT", "Sema 2.4mg CV",
    # Subgroups for LEADER
    "LEADER - Age < 60", "LEADER - Age >= 60",
    "LEADER - Prior CV", "LEADER - No Prior CV",
    "LEADER - eGFR < 60", "LEADER - eGFR >= 60",
    # Subgroups for SUSTAIN-6
    "SUSTAIN-6 - Prior CV", "SUSTAIN-6 - No Prior CV",
    "SUSTAIN-6 - Age < 65", "SUSTAIN-6 - Age >= 65",
    # Overall summary
    "Overall (Fixed)", "Overall (Random)"
  ),
  drug = c(
    "Semaglutide 1mg", "Oral Semaglutide", "Liraglutide", "Dulaglutide", "Exenatide QW",
    "Efpeglenatide", "Lixisenatide", "Albiglutide", "Exenatide Pump",
    "Oral Semaglutide", "Tirzepatide", "Semaglutide 2.4mg",
    rep("Liraglutide", 6),
    rep("Semaglutide 1mg", 4),
    NA_character_, NA_character_
  ),
  year = c(
    2016, 2019, 2016, 2019, 2017,
    2021, 2015, 2018, 2016,
    2024, 2024, 2023,
    rep(2016, 6),
    rep(2016, 4),
    NA_integer_, NA_integer_
  ),
  n = c(
    3297, 3183, 9340, 9901, 14752,
    4076, 6068, 9463, 4156,
    9650, 15000, 17604,
    2854, 6486, 6394, 2946, 2158, 7182,
    1627, 1670, 1598, 1699,
    NA_integer_, NA_integer_
  ),
  events = c(
    108, 137, 608, 594, 839,
    189, 406, 338, 97,
    510, 550, 620,
    178, 430, 452, 156, 198, 410,
    72, 36, 52, 56,
    NA_integer_, NA_integer_
  ),
  hr = c(
    0.74, 0.79, 0.87, 0.88, 0.91,
    0.73, 1.02, 0.78, 0.98,
    0.86, 0.85, 0.80,
    0.91, 0.85, 0.83, 0.99, 0.78, 0.90,
    0.69, 0.85, 0.71, 0.77,
    0.86, 0.85
  ),
  lower = c(
    0.58, 0.57, 0.78, 0.79, 0.83,
    0.58, 0.89, 0.68, 0.65,
    0.76, 0.75, 0.72,
    0.72, 0.74, 0.74, 0.77, 0.62, 0.79,
    0.48, 0.52, 0.46, 0.51,
    0.81, 0.79
  ),
  upper = c(
    0.95, 1.11, 0.97, 0.99, 1.00,
    0.92, 1.17, 0.90, 1.48,
    0.98, 0.96, 0.90,
    1.14, 0.97, 0.94, 1.28, 0.98, 1.01,
    0.99, 1.38, 1.10, 1.16,
    0.91, 0.92
  ),
  pvalue = c(
    0.016, 0.17, 0.01, 0.026, 0.06,
    0.007, 0.81, 0.0006, 0.92,
    0.03, 0.02, 0.001,
    0.42, 0.02, 0.003, 0.95, 0.04, 0.08,
    0.04, 0.48, 0.13, 0.22,
    0.0001, 0.0001
  ),
  endpoint = c(
    rep("MACE", 12),
    rep("MACE", 10),
    rep("MACE", 2)
  ),
  row_type = c(
    rep("data", 12),
    rep("data", 10),
    rep("summary", 2)
  ),
  row_bold = c(
    rep(FALSE, 22),
    rep(TRUE, 2)
  ),
  group = c(
    rep("Main Trials", 12),
    rep("LEADER Subgroups", 6),
    rep("SUSTAIN-6 Subgroups", 4),
    rep("Summary", 2)
  ),
  stringsAsFactors = FALSE
)

# ============================================================================
# Airline Carrier Delay Performance
# ============================================================================
# Realistic airline performance data (inspired by DOT statistics)

set.seed(42)
carriers <- c(
  "Delta", "United", "American", "Southwest", "JetBlue",
  "Alaska", "Spirit", "Frontier", "Hawaiian", "Allegiant"
)

airline_delays <- do.call(rbind, lapply(carriers, function(carrier) {
  # Different baseline performance by carrier
  base_delay <- switch(carrier,
    "Delta" = -2.5, "Alaska" = -3.0, "Hawaiian" = -1.5,
    "United" = 1.5, "American" = 2.0, "Southwest" = 0.5,
    "JetBlue" = 3.0, "Spirit" = 5.0, "Frontier" = 4.5, "Allegiant" = 6.0
  )

  # Carrier type classification
  carrier_type <- switch(carrier,
    "Delta" = "Legacy", "United" = "Legacy", "American" = "Legacy",
    "Alaska" = "Legacy", "Hawaiian" = "Legacy",
    "Southwest" = "Low-Cost", "JetBlue" = "Low-Cost",
    "Spirit" = "Ultra Low-Cost", "Frontier" = "Ultra Low-Cost", "Allegiant" = "Ultra Low-Cost"
  )

  months <- c("Jan", "Feb", "Mar", "Apr")

  data.frame(
    carrier = carrier,
    carrier_type = carrier_type,
    month = months,
    delay_vs_avg = round(base_delay + rnorm(4, 0, 2), 1),
    on_time_pct = round(pmin(0.98, pmax(0.65, 0.82 - base_delay/100 + rnorm(4, 0, 0.03))), 3),
    satisfaction = round(pmin(5, pmax(2, 3.8 - base_delay/5 + rnorm(4, 0, 0.3))), 1),
    flights = round(runif(4, 5000, 50000)),
    stringsAsFactors = FALSE
  )
}))

# Add confidence intervals for delay
airline_delays$delay_lower <- airline_delays$delay_vs_avg - runif(nrow(airline_delays), 1.5, 3)
airline_delays$delay_upper <- airline_delays$delay_vs_avg + runif(nrow(airline_delays), 1.5, 3)

# Add sparkline data (monthly trend over past year)
set.seed(123)
airline_delays$trend <- lapply(1:nrow(airline_delays), function(i) {
  base <- airline_delays$delay_vs_avg[i]
  round(base + cumsum(rnorm(12, 0, 1)), 1)
})

airline_delays <- airline_delays[order(airline_delays$carrier, airline_delays$month), ]
rownames(airline_delays) <- NULL

# ============================================================================
# NBA Player Efficiency Ratings
# ============================================================================
# Fun dataset with basketball player statistics

nba_efficiency <- data.frame(
  player = c(
    "Nikola Jokic", "Luka Doncic", "Giannis Antetokounmpo", "Joel Embiid", "Shai Gilgeous-Alexander",
    "Jayson Tatum", "Anthony Edwards", "Donovan Mitchell", "De'Aaron Fox", "Tyrese Haliburton",
    "LeBron James", "Kevin Durant", "Stephen Curry", "Devin Booker", "Ja Morant",
    "Damian Lillard", "Trae Young", "Darius Garland", "Anthony Davis", "Karl-Anthony Towns",
    "Pascal Siakam", "Scottie Barnes", "Franz Wagner", "Cade Cunningham", "Jalen Brunson",
    "Kawhi Leonard", "Paul George", "Jimmy Butler", "Bam Adebayo", "Jaren Jackson Jr."
  ),
  team = c(
    "DEN", "DAL", "MIL", "PHI", "OKC",
    "BOS", "MIN", "CLE", "SAC", "IND",
    "LAL", "PHX", "GSW", "PHX", "MEM",
    "MIL", "ATL", "CLE", "LAL", "MIN",
    "IND", "TOR", "ORL", "DET", "NYK",
    "LAC", "LAC", "MIA", "MIA", "MEM"
  ),
  conference = c(
    rep("West", 5), rep("East", 5),
    rep("West", 5), rep("East", 5),
    rep("East", 5), rep("West", 5)
  ),
  position = c(
    "C", "G", "F", "C", "G",
    "F", "G", "G", "G", "G",
    "F", "F", "G", "G", "G",
    "G", "G", "G", "F", "C",
    "F", "F", "F", "G", "G",
    "F", "F", "F", "C", "C"
  ),
  games = c(
    79, 70, 73, 39, 75,
    74, 79, 55, 74, 69,
    71, 75, 74, 68, 9,
    73, 76, 57, 76, 62,
    77, 60, 72, 62, 77,
    68, 74, 60, 71, 66
  ),
  ppg = c(
    26.4, 33.9, 30.4, 34.7, 30.1,
    26.9, 25.9, 26.6, 26.6, 20.1,
    25.7, 27.1, 26.4, 27.1, 25.1,
    24.3, 25.7, 18.0, 24.7, 22.9,
    21.3, 19.5, 19.7, 22.7, 28.7,
    23.7, 22.6, 20.8, 19.3, 22.5
  ),
  per = c(
    31.5, 27.8, 29.5, 31.2, 25.4,
    23.1, 22.3, 24.2, 22.5, 19.8,
    25.8, 24.3, 22.1, 21.3, 24.5,
    21.7, 19.2, 17.5, 27.5, 24.6,
    20.5, 17.3, 18.9, 19.2, 22.4,
    26.1, 19.5, 22.8, 20.1, 21.3
  ),
  # PER confidence intervals (approximated)
  per_lower = NA_real_,
  per_upper = NA_real_,
  all_star = c(
    TRUE, TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, FALSE,
    TRUE, TRUE, FALSE, TRUE, TRUE,
    FALSE, FALSE, FALSE, FALSE, TRUE,
    TRUE, TRUE, TRUE, TRUE, FALSE
  ),
  award = c(
    "MVP", "All-NBA 1st", "All-NBA 1st", "All-NBA 2nd", "All-NBA 1st",
    "All-NBA 1st", "All-NBA 2nd", "All-NBA 2nd", "All-NBA 3rd", "All-NBA 3rd",
    "All-NBA 3rd", "", "", "", "",
    "", "", "", "All-NBA 2nd", "",
    "", "", "", "", "All-NBA 3rd",
    "", "", "", "", ""
  ),
  stringsAsFactors = FALSE
)

# Add PER confidence intervals
set.seed(456)
nba_efficiency$per_lower <- round(nba_efficiency$per - runif(30, 1.5, 3), 1)
nba_efficiency$per_upper <- round(nba_efficiency$per + runif(30, 1.5, 3), 1)

# ============================================================================
# Climate Temperature Anomalies
# ============================================================================
# Minimal dataset showing regional temperature anomalies

climate_temps <- data.frame(
  region = c(
    "Global", "Northern Hemisphere", "Southern Hemisphere",
    "Arctic", "Antarctic",
    "North America", "Europe", "Asia", "Africa", "South America", "Oceania",
    "Tropics", "Mid-Latitudes (N)", "Mid-Latitudes (S)",
    "Land", "Ocean",
    "Pre-Industrial", "1950-1980", "1980-2000", "2000-2023"
  ),
  period = c(
    rep("2023", 11),
    rep("2023", 3),
    rep("2023", 2),
    rep("Baseline", 4)
  ),
  anomaly = c(
    1.45, 1.62, 1.28,
    2.85, 0.45,
    1.78, 2.10, 1.65, 1.35, 1.20, 1.55,
    1.15, 1.85, 1.42,
    1.95, 1.12,
    0.00, 0.25, 0.55, 1.10
  ),
  lower = c(
    1.38, 1.52, 1.18,
    2.55, 0.30,
    1.58, 1.88, 1.45, 1.18, 1.02, 1.35,
    1.05, 1.68, 1.28,
    1.82, 1.02,
    -0.10, 0.18, 0.48, 1.02
  ),
  upper = c(
    1.52, 1.72, 1.38,
    3.15, 0.60,
    1.98, 2.32, 1.85, 1.52, 1.38, 1.75,
    1.25, 2.02, 1.56,
    2.08, 1.22,
    0.10, 0.32, 0.62, 1.18
  ),
  certainty = c(
    "High", "High", "High",
    "Medium", "Medium",
    "High", "High", "High", "Medium", "Medium", "Medium",
    "High", "High", "High",
    "High", "High",
    "High", "High", "High", "High"
  ),
  category = c(
    "Global", "Hemisphere", "Hemisphere",
    "Polar", "Polar",
    rep("Continental", 6),
    rep("Latitude Band", 3),
    rep("Surface Type", 2),
    rep("Time Period", 4)
  ),
  stringsAsFactors = FALSE
)

# ============================================================================
# Effect Sizes Stress Test Dataset
# ============================================================================
# Dataset with widely varying confidence intervals to stress test:
# - Axis range calculation and CI clipping
# - split_by / plot_by logic with multiple grouping variables
# - Edge cases: very wide CIs, very narrow CIs, extreme values

set.seed(2024)

# Design: Multi-site drug trial with varying precision across sites
effect_sizes <- data.frame(

  study = c(
    # High precision studies (large N, narrow CI)
    "Major Medical Center A", "University Hospital B", "National Institute C",
    "Regional Center D", "Metro Hospital E",
    # Medium precision studies
    "Community Hospital F", "Clinic Network G", "Research Center H",
    "Teaching Hospital I", "Medical Group J",
    # Low precision studies (small N, wide CI)
    "Rural Clinic K", "Small Practice L", "Pilot Site M",
    # Very wide CI studies (will trigger clipping)
    "Single-arm Study N", "Case Series O", "Exploratory P",
    # Edge cases
    "Outlier Site Q", "Extreme Effect R", "Null Effect S", "Borderline T"
  ),

  # Grouping variables for split_by testing
  region = c(
    "North America", "North America", "Europe", "Europe", "Asia Pacific",
    "North America", "Europe", "Asia Pacific", "North America", "Europe",
    "Asia Pacific", "North America", "Europe",
    "North America", "Europe", "Asia Pacific",
    "North America", "Europe", "Asia Pacific", "North America"
  ),

  outcome = c(
    rep("Primary", 10),
    rep("Secondary", 6),
    rep("Exploratory", 4)
  ),

  treatment = c(
    rep("Drug A", 7),
    rep("Drug B", 7),
    rep("Combination", 6)
  ),

  phase = c(
    rep("Phase 3", 8),
    rep("Phase 2", 7),
    rep("Phase 1", 5)
  ),

  n = c(
    # High precision
    2500, 1800, 3200, 1500, 2100,
    # Medium precision
    450, 380, 520, 290, 410,
    # Low precision
    85, 62, 48,
    # Very low precision
    25, 18, 12,
    # Edge cases
    150, 95, 800, 320
  ),

  stringsAsFactors = FALSE
)

# Generate effect sizes (hazard ratios on log scale)
# Base effects vary by treatment
base_hr <- c(
  # High precision - clustered around 0.75-0.85
  0.72, 0.78, 0.81, 0.76, 0.84,
  # Medium precision - more variable
  0.68, 0.92, 0.71, 1.05, 0.88,
  # Low precision - even more variable
  0.55, 1.25, 0.62,
  # Very wide - extreme values that WILL be clipped
  0.40, 1.80, 0.50,
  # Edge cases
  0.25, 2.50, 1.00, 0.99  # outlier, extreme, null, borderline
)

effect_sizes$hr <- base_hr

# Generate SEs inversely proportional to sqrt(n), with some noise
effect_sizes$se <- 0.5 / sqrt(effect_sizes$n) * runif(nrow(effect_sizes), 0.8, 1.4)

# For the very wide CI studies, use HUGE SEs to guarantee clipping
# These will have CIs spanning multiple orders of magnitude
effect_sizes$se[14] <- 1.8   # Single-arm Study N - very wide
effect_sizes$se[15] <- 1.5   # Case Series O - wide
effect_sizes$se[16] <- 2.0   # Exploratory P - extremely wide

# For edge cases
effect_sizes$se[17] <- 1.2   # Outlier - will be clipped on lower end
effect_sizes$se[18] <- 0.8   # Extreme effect - will be clipped on upper end
effect_sizes$se[19] <- 0.02  # Null effect - very precise
effect_sizes$se[20] <- 0.03  # Borderline - very precise

# Calculate CIs (log scale)
effect_sizes$lower <- round(effect_sizes$hr * exp(-1.96 * effect_sizes$se), 3)
effect_sizes$upper <- round(effect_sizes$hr * exp(1.96 * effect_sizes$se), 3)
effect_sizes$hr <- round(effect_sizes$hr, 3)

# Add derived columns useful for display
effect_sizes$significant <- effect_sizes$upper < 1 | effect_sizes$lower > 1
effect_sizes$direction <- ifelse(effect_sizes$hr < 1, "Favors Treatment", "Favors Control")

# Reorder columns
effect_sizes <- effect_sizes[, c(
  "study", "region", "outcome", "treatment", "phase",
  "n", "hr", "lower", "upper", "se", "significant", "direction"
)]

# ============================================================================
# Save datasets
# ============================================================================

usethis::use_data(glp1_trials, overwrite = TRUE)
usethis::use_data(airline_delays, overwrite = TRUE)
usethis::use_data(nba_efficiency, overwrite = TRUE)
usethis::use_data(climate_temps, overwrite = TRUE)
usethis::use_data(effect_sizes, overwrite = TRUE)

message("Datasets saved to data/")

// Shared 5-step font-weight ladder for the settings-panel pickers.
//
// One ladder, one label dialect (studio C unification — TextControl used
// numerals while TokensControl used "Light/Reg/Med/Semi/Bold" for the
// same five values).
//
// Numerical labels (3-7 = hundreds of the CSS weight) instead of names —
// compactness matters because the pill sits next to a label column;
// verbose names crammed five into a row read as a wall of letters. The
// numerals also typeset like specimen weights in a journal's typography
// table, which fits the editorial voice.
//
// We skip 100/200/800/900 — they look identical to 300/700 in most body
// fonts, so they'd just clutter the picker. Authors who need an extreme
// can still set the wire via R / theme code.
export const WEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 300, label: "3" },
  { value: 400, label: "4" },
  { value: 500, label: "5" },
  { value: 600, label: "6" },
  { value: 700, label: "7" },
];

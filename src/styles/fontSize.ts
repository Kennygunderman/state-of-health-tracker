export default {
  H1: 24,
  H2: 18,
  H3: 16,
  PARAGRAPH: 14,

  SCREEN_TITLE: 30,
  STAT_HERO: 44,
  STAT_LG: 28,
  GREETING: 22,
  STAT: 20,
  CARD_TITLE: 17,
  BODY: 15,
  LABEL: 13,
  CAPTION: 12,
  OVERLINE: 11,
  TAB_LABEL: 10
}

// META is the 13px multiline value; LABEL is the 13px box the design resolves for single-line labels
// and captions — inside stacked rows, time pills and footnotes alike — where META's 18.85 would
// stretch the line: Figma leaves that style's line height automatic and resolves it to exactly 16.
export const LineHeight = {
  SCREEN_TITLE: 34.5,
  STAT_LG: 32.2,
  GREETING: 25.3,
  BODY: 21.75,
  // Recipe instruction bodies are 15/21 in Figma, a deliberate 1.4 ratio distinct from BODY's 1.45.
  STEP_BODY: 21,
  ROW_VALUE: 19.5,
  META: 18.85,
  OPTION_SUBCOPY: 17.55,
  LABEL: 16,
  OVERLINE: 13.31
}

// Pixels, not Figma's em values: React Native measures letterSpacing in pixels (em times font size).
export const LetterSpacing = {
  TITLE: -0.4,
  HERO: -1.0,
  OVERLINE: 0.6,
  EYEBROW: 1,
  NONE: 0
}

export const FontWeight = {
  EXTRA_LIGHT: '200',
  REGULAR: '400',
  SEMIBOLD: '600',
  BOLD: '700'
} as const

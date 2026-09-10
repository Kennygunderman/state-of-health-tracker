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

// The 13px single-line meta style deliberately has no entry: 18.85 would stretch fixed-height rows.
export const LineHeight = {
  SCREEN_TITLE: 34.5,
  STAT_LG: 32.2,
  GREETING: 25.3,
  BODY: 21.75,
  META: 18.85,
  OVERLINE: 13.31
}

// Pixels, not Figma's em values: React Native measures letterSpacing in pixels (em times font size).
export const LetterSpacing = {
  TITLE: -0.4,
  HERO: -1.0,
  OVERLINE: 0.6,
  NONE: 0
}

export const FontWeight = {
  REGULAR: '400',
  SEMIBOLD: '600',
  BOLD: '700'
} as const

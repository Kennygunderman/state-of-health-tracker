// Type metrics only — deliberately no family. Every Figma text style names Helvetica Neue, and nothing under
// `src/` sets a `fontFamily`, so the app renders the platform default (San Francisco on iOS, Roboto on
// Android). That is the approved resolution of the divergence rather than an oversight: Agent Action Plan
// 0.1.4 and 0.6.3 adopt option A — keep the platform default family and match size, weight, line height and
// letter spacing exactly — so the glyph shapes differ from the comp while every metric below does not.
// Option B (bundling a licensed Helvetica Neue and adding a `FontFamily` token here) remains available if
// the decision is reversed; `docs/meal-planning.md` section 5 records both, and the screenshot comparisons
// state the deviation.
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

// Every entry is a pixel box, and every box here is pinned deliberately. Figma authors a line height on some
// text styles and leaves it automatic on others, and its automatic leading resolves to a WHOLE pixel at each
// size in this file — 10 to 12, 11 to 13, 13 to 16, 15 to 18, 16 to 19, 17 to 21, 20 to 24, 28 to 34 — read
// from the nodes' own declared dimensions and from the painted wrappers that hug them. React Native's default
// is instead the font's own multiplier, 1.21 for iOS Helvetica Neue, which reproduces none of those boxes
// (11 to 13.31, 13 to 15.73, 28 to 33.88). Under the option A decision above the family is the platform's but
// every metric is the comp's, so an automatic box is pinned at the value Figma resolves rather than left
// unset for a platform to invent.
//
// Agent Action Plan 0.2.2 and 0.6.3 direct the opposite for these styles — that the automatic ones "set no
// lineHeight", and that OVERLINE is 13.31 — but both of those are the 1.21 platform multiplier rather than
// anything drawn: 13.31 appears on no node, in no channel, anywhere in the file. Figma is the visual source
// of truth (0.1.2), so this map follows the file and that part of the token table is an erratum.
//
// The names therefore pair each Figma-authored box with the automatic box of the same size: META (13
// multiline, authored 18.85) beside LABEL (13 single line, automatic 16 — stacked rows, time pills and
// footnotes, where META's 18.85 would stretch the line); ROW_VALUE (15 stacked, authored 19.5) beside
// BODY_COMPACT (15 single line, automatic 18); STAT_LG (28 titles, authored 32.2) beside STAT_LG_FIGURE
// (28 big-number figures, automatic 34).
export const LineHeight = {
  SCREEN_TITLE: 34.5,
  // A 28px title authors 32.2 (node 36:146); the big-number figure beside it authors nothing and resolves to
  // 34 (node 36:199, which declares its own height as 34). One size, two boxes, so two tokens.
  STAT_LG_FIGURE: 34,
  STAT_LG: 32.2,
  GREETING: 25.3,
  BODY: 21.75,
  // Recipe instruction bodies are 15/21 in Figma, a deliberate 1.4 ratio distinct from BODY's 1.45.
  STEP_BODY: 21,
  ROW_VALUE: 19.5,
  META: 18.85,
  // The automatic 15px box: a summary value in an inline row (node 34:335 and its five siblings) and the
  // diary entry-row name, whose semibold and regular spans share this one box (node 38:264).
  BODY_COMPACT: 18,
  OPTION_SUBCOPY: 17.55,
  LABEL: 16,
  // 13 exactly. The grocery list's five overlines share one style with no authored line height, and each of
  // the wrappers drawing them closes on 13 with nothing left over: 37:50 is 33 over a 20 inset, and 37:86,
  // 37:114 and 37:134 are 29 over a 16 inset.
  OVERLINE: 13,
  // The automatic 10px box, which is what hugs the LOGGED badge to 16 over its 2px insets (label 49:358
  // inside badge 49:357).
  TAB_LABEL: 12
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

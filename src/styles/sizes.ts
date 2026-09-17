// Entries are named for their purpose, never their value — equal numbers on
// different purposes are intentional and must not be collapsed.
export const Sizes = {
  PILL_SM: 32,
  CHIP: 32,
  CONTROL_SM: 36,
  CONTROL: 44,
  CONTROL_LG: 48,
  CTA: 52,
  // Figma 49:674 authors the recipe action bar's narrow action at a fixed 110 (`designedWidth: "110px"`)
  // while its wide sibling 49:671 declares no width at all, so the pair is a remainder split and never a
  // proportion: the 235 the comp resolves to holds only at a 393 frame.
  ACTION_SECONDARY_W: 110,
  ADD_CONTROL: 28,

  TILE_SM: 40,
  TILE: 56,
  HERO_TILE: 76,
  HERO_TILE_SM: 70,
  HERO_BAND_H: 180,
  RING: 104,
  EMPTY_TILE: 104,

  BADGE_DISC_LG: 64,
  BADGE_DISC: 56,
  BADGE_DISC_SM: 48,
  STEP_BADGE: 22,
  BADGE_PADDING_V: 2,

  SPINNER: 18,
  SPINNER_LG: 76,

  SKELETON_BAR: 14,
  SKELETON_BAR_SM: 11,

  SEGMENT_TRACK_INSET: 2,
  SEGMENT_COMPACT_INSET_V: 5,
  SEGMENT_H: 32,
  SEGMENT_COMPACT_H: 25,
  SEGMENT_ENVELOPE_INSET_V: 4,
  SEGMENT_COMPACT_ENVELOPE_INSET_V: 7.5,
  BANNER_ICON_INSET_T: 1,
  BANNER_TEXT_INSET_T: 2,
  BANNER_BODY_INSET_T: 2,
  ROW_VALUE_INSET_T: 2,
  ROW_VALUE_INSET_B: 0.5,
  OPTION_SUBCOPY_GAP: 2,
  DAY_CHIP_NUMBER_INSET_T: 2,
  // Figma declares a text block's wrapper height as the CEILING of its
  // padding + pinned fractional line height, so the block closes on a whole
  // pixel while the text keeps its fractional metrics: 34:208 is 353x51 over
  // 16 + 34.5 = 50.5, and 34:211 is 353x30 over 8 + 21.75 = 29.75. These are
  // the remainders that reconcile the two. They are bottom padding rather than
  // a fixed height so the block still grows with the user's text size.
  TITLE_BLOCK_INSET_B: 0.5,
  SUBCOPY_BLOCK_INSET_B: 0.25,
  // The trailing-chevron slot a row's layout advances by (Figma 36:71 / 36:538), not the glyph canvas.
  CHEVRON_SLOT: 8,
  PROGRESS_SEGMENT_W: 33,
  PROGRESS_SEGMENT_H: 4,
  PROGRESS_BAR_H: 6,
  TOUCH_TARGET: 44,

  STEPPER_BAR_W: 14,
  STEPPER_BAR_H: 2,
  STEPPER_VALUE_MIN_W: 56,

  CONTENT_MAX_WIDTH: 600,
  EMPTY_BLOCK_BOTTOM: 40,
  EMPTY_BLOCK_BOTTOM_LG: 60,
  FOOTER_MIN_BOTTOM: 22,

  ICON_CHEVRON: 14,
  ICON_XS: 15,
  ICON_SM: 17,
  ICON: 18,
  ICON_MD: 20,
  ICON_LG: 22,
  ICON_XL: 24,
  ICON_BADGE: 26,
  ICON_HERO: 28,
  ICON_ALERT: 30,
  ICON_EMPTY: 46
}

export const Stroke = {
  THIN: 1,
  DEFAULT: 1.5,
  BOLD: 2,

  WARNING_TRIANGLE: 1.53,
  BADGE_REFRESH: 1.8,
  BADGE_ZOOM: 1.95,
  BADGE_ALERT: 2.375,
  EMPTY_CART: 2.49,
  EMPTY_CALENDAR: 2.68,
  HERO_ART: 3.48,
  SPINNER_TRACK: 5.3,

  MEAL_GLYPH: 1.6,
  MEAL_GLYPH_TILE: 1.35,
  CART_HEADER: 1.275,
  SEARCH_MAGNIFIER: 1.61,
  HERO_ART_CLOCHE: 3.208,
  SPINNER_TRACK_SM: 2.34
}

export const Opacity = {
  SCRIM: 0.62,
  CONTENT_DIM: 0.18,
  STATUS_DIM: 0.4,

  LOGGED_TILE: 0.6,
  PRESSED: 0.6,
  PRESSED_SEGMENT: 0.7,
  PRESSED_CTA: 0.5,
  HERO_ART: 0.5,
  DISABLED: 0.5,
  CHIP_GLYPH: 0.8
}

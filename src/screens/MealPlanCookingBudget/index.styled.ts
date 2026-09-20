import {Insets, StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

/* BLITZY [A11Y]: the whole checkbox row is the pressable and 47:646 draws it 34px tall — a 12px rung over the
   22px box, with zero slack — so the 44px minimum AAP 0.7.2 asks for is reached by hit slop rather than by a
   minimum height, which would render the row 10px taller than drawn. Figma outranks the 44px default here
   (AAP 0.6.5). The edge is arithmetic on the row's own composition, not a chosen inset: Spacing.SMALL is its
   rung and Sizes.ICON_LG is CheckboxSquare's edge, so bottom + rung + box is exactly Sizes.TOUCH_TARGET. All
   of it is pushed downward because the rung sits inside the pressable: the row's top edge is flush against
   the 48px budget field above it, and the row — being the later sibling — would win that overlap and shrink
   the field's own target. Downward it lands inside the footnote's 8px rung, which takes no touches. */
export const NO_BUDGET_ROW_HIT_SLOP: Insets = {
  top: 0,
  bottom: Sizes.TOUCH_TARGET - Spacing.SMALL - Sizes.ICON_LG
}

export default StyleSheet.create({
  // Deliberately not @components/Screen: its side margins would compound with
  // ContentColumn's gutter and shrink the content column.
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  // flexGrow keeps a short form pinned to the footer; the horizontal gutter
  // belongs to ContentColumn, which wraps this body.
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.LARGE
  },
  headline: {
    paddingTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },

  // Both sections follow the frame's own model: no section declares a gap, and every rung is the top padding
  // of the block beneath it, so an inline error can appear between two blocks without doubling either gap.
  cookingSection: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER
  },
  cookingChips: {
    paddingTop: Spacing.X_SMALL
  },
  // Figma 47:632 declares 24px here, while the cooking section above deliberately opens at 20px (47:616) —
  // the two section rungs differ by design and must not be normalised to one value.
  budgetSection: {
    alignSelf: 'stretch',
    paddingTop: Spacing.LARGE
  },
  // space-between carries 'Optional' to the right edge of the row (47:632); the column gap is the floor that
  // keeps the two labels apart once enlarged text has consumed the space between them.
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL
  },
  controlLabel: {
    flexShrink: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textSecondary
  },
  optionalLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  budgetField: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },

  // 47:646 draws a 22px checkbox in a row that hugs it, so the row measures the drawn 34px including this
  // rung and declares no height of its own. Its 44px touch target is NO_BUDGET_ROW_HIT_SLOP above.
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    paddingTop: Spacing.SMALL
  },
  preferenceLabel: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  // LABEL, not META: 47:655 leaves this footnote's line height automatic, which Figma resolves to 16 and its
  // wrapper measures as 24 (8 + 16). META's 18.85 belongs to the 13px styles the frame sets explicitly —
  // 'Optional' above is one — and using it here would push everything below the helper down by ~3px.
  helperText: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },

  summaryCardWrapper: {
    paddingTop: Spacing.LARGE
  },
  summaryCard: {
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  }
})

import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

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

  cookingSection: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.X_SMALL
  },
  // Figma 47:632 declares 24px here, while the cooking section above deliberately opens at 20px (47:616) —
  // the two section rungs differ by design and must not be normalised to one value.
  budgetSection: {
    alignSelf: 'stretch',
    paddingTop: Spacing.LARGE,
    rowGap: Spacing.X_SMALL
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  controlLabel: {
    flexShrink: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  optionalLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  budgetField: {
    alignSelf: 'stretch'
  },

  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    paddingTop: Spacing.X_SMALL
  },
  preferenceLabel: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  helperText: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },

  summaryCardWrapper: {
    paddingTop: Spacing.GUTTER
  },
  summaryCard: {
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  }
})

import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  listContent: {
    paddingBottom: Spacing.LARGE
  },
  eyebrow: {
    fontSize: FontSize.CAPTION,
    fontWeight: FontWeight.BOLD,
    letterSpacing: LetterSpacing.EYEBROW,
    color: Theme.colors.accentGreen,
    marginHorizontal: Spacing.MEDIUM
  },
  title: {
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: 'bold',
    marginTop: Spacing.XX_SMALL,
    marginHorizontal: Spacing.MEDIUM
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.MEDIUM,
    marginTop: Spacing.GUTTER,
    marginBottom: Spacing.SMALL
  },
  sectionHeaderText: {
    fontSize: FontSize.H3,
    fontWeight: 'bold'
  },
  emptyText: {
    fontWeight: FontWeight.EXTRA_LIGHT,
    paddingHorizontal: Spacing.MEDIUM,
    paddingVertical: Spacing.MEDIUM,
    textAlign: 'center',
    alignSelf: 'center'
  },
  catalogEmptyText: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.MEDIUM,
    paddingVertical: Spacing.MEDIUM,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    textAlign: 'center',
    color: Theme.colors.textMuted
  },
  retryContainer: {
    alignItems: 'center',
    marginTop: Spacing.X_LARGE,
    padding: Spacing.MEDIUM
  },
  retryText: {
    fontSize: FontSize.PARAGRAPH,
    fontWeight: FontWeight.SEMIBOLD,
    textAlign: 'center',
    color: Theme.colors.textSecondary
  },
  catalogSkeletonRow: {
    gap: Spacing.XX_SMALL,
    marginHorizontal: Spacing.MEDIUM,
    marginBottom: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL,
    borderRadius: BorderRadius.ITEM,
    backgroundColor: Theme.colors.card
  },
  catalogSkeletonBar: {
    borderRadius: BorderRadius.CHECKBOX,
    backgroundColor: Theme.colors.inset
  }
})

import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// The height is measured at runtime — what the viewport has left below the segmented control — so the style
// is a factory, the form `PrimaryButton/index.styled.ts` uses for its measured width.
export const emptyRegion = (minHeight: number): ViewStyle => ({
  minHeight,
  justifyContent: 'center'
})

export default StyleSheet.create({
  body: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: Sizes.CONTENT_MAX_WIDTH
  },
  dayStripContainer: {
    marginTop: Spacing.MEDIUM
  },
  totalsCardContainer: {
    marginTop: Spacing.MEDIUM
  },
  bannerContainer: {
    marginTop: Spacing.MEDIUM
  },
  mealCardContainer: {
    marginTop: Spacing.SMALL
  },
  mealCardContainerFirst: {
    marginTop: Spacing.MEDIUM
  },
  planSettingsRowContainer: {
    marginTop: Spacing.MEDIUM
  },
  lastDayCardContainer: {
    marginTop: Spacing.MEDIUM
  },
  captionContainer: {
    marginTop: Spacing.X_SMALL
  },
  macrosHeader: {
    alignSelf: 'flex-start',
    marginTop: Spacing.MEDIUM
  },
  screenTitle: {
    marginTop: Spacing.XX_SMALL,
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  // The negative bottom margin is the other half of the envelope below: the body block that follows opens with
  // its own Spacing.MEDIUM top margin, and this gives that much back, so the envelope's reachable tail costs
  // the layout the 4 px by which Sizes.TOUCH_TARGET exceeds the 8 + 16 + 16 the switch used to occupy — and no
  // more. The two cancel exactly, so the following content starts at the envelope's edge and never over it.
  planSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: -Spacing.MEDIUM
  },
  // A real envelope rather than hitSlop: the row is only as tall as its label, and RN never extends slop past
  // a parent's bounds. The label keeps the exact inset the row's former marginTop gave it — hence top-aligned
  // with that same padding rather than centred, which would drop it 6 px — and the envelope's remaining height
  // is reachable transparent space below it.
  planSwitchButton: {
    minHeight: Sizes.TOUCH_TARGET,
    justifyContent: 'flex-start',
    paddingTop: Spacing.X_SMALL
  },
  planSwitchLink: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    marginTop: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    borderRadius: BorderRadius.TIP,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.dangerBorder,
    backgroundColor: Theme.colors.dangerTint
  },
  errorTitle: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  retryPill: {
    height: Sizes.PILL_SM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.accentGreen
  },
  retryLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.onInverse
  },
  unavailableCard: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  unavailableText: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },
  staleCaption: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },
  skeletonStretch: {
    alignSelf: 'stretch'
  },
  skeletonHeaderRow: {
    rowGap: Spacing.XX_SMALL,
    marginTop: Spacing.MEDIUM
  },
  skeletonDayStrip: {
    flexDirection: 'row',
    columnGap: Spacing.TIGHT,
    marginTop: Spacing.MEDIUM
  },
  skeletonCard: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.GUTTER,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.X_SMALL
  }
})

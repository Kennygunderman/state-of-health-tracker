import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    borderRadius: BorderRadius.TIP
  },
  iconWrapper: {
    paddingTop: Sizes.BANNER_ICON_INSET_T
  },
  iconWrapperCentered: {
    paddingTop: 0
  },
  textWrapper: {
    flex: 1,
    paddingTop: Sizes.BANNER_TEXT_INSET_T
  },
  textWrapperFlush: {
    paddingTop: 0
  },
  containerNeutral: {
    backgroundColor: Theme.colors.card
  },
  containerSuccess: {
    backgroundColor: Theme.colors.greenTint
  },
  containerError: {
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.dangerBorder,
    backgroundColor: Theme.colors.dangerTint
  },
  containerTopAligned: {
    alignItems: 'flex-start'
  },
  containerCentered: {
    alignItems: 'center'
  },
  containerDisc: {
    minHeight: Sizes.CONTROL
  },
  checkDisc: {
    width: Sizes.ICON_MD,
    height: Sizes.ICON_MD,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.accentGreen
  },
  neutralBody: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textSecondary
  },
  successBody: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.greenOnTint
  },
  tickBody: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.greenOnTint
  },
  discBody: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.greenOnTint
  },
  errorTitle: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  errorBody: {
    paddingTop: Spacing.MICRO,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textSecondary
  },
  linkAction: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: Spacing.X_SMALL,
    rowGap: Spacing.X_SMALL,
    paddingTop: Spacing.SMALL
  },
  primaryAction: {
    flexShrink: 1,
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.accentGreen
  },
  primaryActionLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.white
  },
  secondaryAction: {
    flexShrink: 1,
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.TILE,
    backgroundColor: Theme.colors.inset
  },
  secondaryActionLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  }
})

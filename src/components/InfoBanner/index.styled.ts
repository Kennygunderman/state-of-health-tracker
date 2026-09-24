import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Opacity, Sizes, Stroke} from '@styles/sizes'
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
  // The envelopes below leave transparent inset under the last pill, so the shell gives up that half of its
  // own bottom padding and the drawn gap under the action row stays the Spacing.SMALL 0.2.3 authors.
  containerActionRow: {
    paddingBottom: Spacing.TIGHT
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
  errorBodyWrapper: {
    paddingTop: Sizes.BANNER_BODY_INSET_T
  },
  errorBody: {
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
    paddingTop: Spacing.TIGHT
  },
  // `hitSlop` never extends past the parent view's bounds, so a slopped pill flush against this row's edge
  // was clipped to a 38 pt target. The pressable is this envelope instead — Sizes.TOUCH_TARGET tall with the
  // pill centred inside it — and the row above gives up the half of the difference it introduces at the top.
  actionEnvelope: {
    flexShrink: 1,
    justifyContent: 'center',
    minHeight: Sizes.TOUCH_TARGET
  },
  primaryAction: {
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.accentGreen
  },
  /* BLITZY [A11Y]: the action label implements Figma `38:396` + `38:397` exactly — white on the accent pill
     above at 600/13px — measuring 2.45:1 against the 4.5:1 AA default, the widest shortfall in this
     palette (13px/600 is not WCAG large text). Figma specifies the pair and outranks that default, so it is
     matched rather than adjusted. White is already maximum contrast, so only the pill can move
     (`background` on `accentGreen` measures 7.67:1). See the accessible-colour register in
     `@styles/theme`. */
  primaryActionLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.white
  },
  secondaryAction: {
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.TILE,
    backgroundColor: Theme.colors.inset
  },
  secondaryActionLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  actionPending: {
    opacity: Opacity.DISABLED
  }
})

import {DimensionValue, StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import Shadow from '@styles/shadow'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import {ctaMinHeight} from './index.util'

export const buttonTouchable = (width: DimensionValue): ViewStyle => ({
  width
})

export default StyleSheet.create({
  inner: {
    ...Shadow.CTA_GLOW,
    backgroundColor: Theme.colors.accentGreen,
    borderRadius: BorderRadius.INPUT,
    minHeight: ctaMinHeight(Sizes.CTA, Sizes.TOUCH_TARGET),
    paddingVertical: Spacing.MEDIUM,
    paddingHorizontal: Spacing.SMALL,
    alignItems: 'center',
    justifyContent: 'center'
  },
  innerDisabled: {
    opacity: Opacity.DISABLED
  },
  /* BLITZY [A11Y]: the label implements Figma `46:120` + `46:121` exactly — white on the accent fill at
     600/16px — which measures 2.45:1, below the 4.5:1 AA default (16px/600 is not WCAG large text). Figma
     specifies the pair, and the project directive's accessibility rule is explicit for that case: match
     Figma exactly, emit this flag for designer review, and record the deferral — never darken or lighten a
     colour to reach the minimum. So the pair is matched and flagged, not adjusted. White is already
     maximum contrast, so only the accent can move: `background` on `accentGreen` measures 7.67:1 and
     `greenTint` on `accentGreen` 5.52:1. The accent is read by 53 shipped surfaces outside this feature,
     so that change belongs in the accessible-colour register in `@styles/theme`, not here. */
  label: {
    fontWeight: FontWeight.SEMIBOLD,
    fontSize: FontSize.H3,
    color: Theme.colors.white,
    marginLeft: Spacing.XX_SMALL,
    marginRight: Spacing.XX_SMALL
  }
})

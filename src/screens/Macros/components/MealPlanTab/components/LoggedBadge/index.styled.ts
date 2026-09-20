import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizes.BADGE_PADDING_V,
    paddingHorizontal: Spacing.X_SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.greenTint
  },
  /* Node 49:358 declares no line height, and the automatic 10px box Figma resolves is 12 — which is exactly
     what hugs the painted badge 49:357 to its rendered 16 over the 2px insets above. No textTransform: the
     node carries no text case and its capitals are in the literal string. */
  label: {
    fontSize: FontSize.TAB_LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.TAB_LABEL,
    letterSpacing: LetterSpacing.OVERLINE,
    color: Theme.colors.greenOnTint
  }
})

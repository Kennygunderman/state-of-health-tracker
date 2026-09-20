import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL,
    backgroundColor: Theme.colors.card
  },
  nameContainer: {
    flex: 1
  },
  /* Node 38:264 declares no line height at node level or in either of its runs, so Figma resolves the
     automatic 15px box of 18. The serving text below is a nested span of this same Text, which is why the
     box belongs here and not on it: both runs share this one line box, as they do in the comp. */
  name: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.BODY_COMPACT
  },
  servingText: {
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },
  provenanceCaption: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },
  caloriesContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: Spacing.XX_SMALL
  },
  calories: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.BOLD
  },
  caloriesLabel: {
    fontSize: FontSize.LABEL,
    color: Theme.colors.textMuted
  }
})

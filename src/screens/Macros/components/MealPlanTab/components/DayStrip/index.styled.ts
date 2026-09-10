import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  strip: {
    flexDirection: 'row',
    columnGap: Spacing.TIGHT,
    alignSelf: 'stretch'
  },
  chip: {
    flex: 1,
    minHeight: Sizes.CONTROL_LG,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.TILE,
    backgroundColor: Theme.colors.card
  },
  chipSelected: {
    backgroundColor: Theme.colors.greenTint
  },
  weekday: {
    fontSize: FontSize.TAB_LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  },
  weekdaySelected: {
    color: Theme.colors.greenOnTint
  },
  dayNumber: {
    paddingTop: Spacing.TEXT_GAP,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.textSecondary
  },
  dayNumberSelected: {
    color: Theme.colors.text
  }
})

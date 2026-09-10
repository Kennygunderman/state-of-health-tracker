import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    gap: Spacing.SMALL,
    borderRadius: BorderRadius.ITEM,
    borderWidth: Stroke.THIN,
    backgroundColor: Theme.colors.card,
    borderColor: Theme.colors.hairline
  },
  cardSelected: {
    backgroundColor: Theme.colors.greenTint,
    borderColor: Theme.colors.accentGreen
  },
  indicator: {
    width: Sizes.ICON_LG,
    height: Sizes.ICON_LG,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    borderWidth: Stroke.DEFAULT,
    borderColor: Theme.colors.textDisabled
  },
  indicatorSelected: {
    backgroundColor: Theme.colors.accentGreen,
    borderColor: Theme.colors.accentGreen
  },
  textColumn: {
    flex: 1,
    gap: Spacing.TEXT_GAP
  },
  label: {
    fontSize: FontSize.H3,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  labelSelected: {
    fontWeight: FontWeight.BOLD
  },
  subcopy: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.OPTION_SUBCOPY,
    color: Theme.colors.textMuted
  },
  subcopySelected: {
    color: Theme.colors.textSecondary
  }
})

import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const CHIP_HIT_SLOP = Spacing.TIGHT

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.X_SMALL,
    rowGap: Spacing.X_SMALL
  },
  // borderColor matches the chip's own fill so selecting recolours the edge without resizing the chip.
  chip: {
    flexGrow: 1,
    flexBasis: 'auto',
    alignItems: 'center',
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    borderWidth: Stroke.THIN,
    backgroundColor: Theme.colors.tile,
    borderColor: Theme.colors.tile
  },
  chipSelected: {
    backgroundColor: Theme.colors.greenTint,
    borderColor: Theme.colors.accentGreen
  },
  chipLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  chipLabelSelected: {
    color: Theme.colors.accentGreen
  }
})

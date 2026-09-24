import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Opacity, Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const CHIP_HIT_SLOP = Spacing.TIGHT

export default StyleSheet.create({
  // React Native clips a child's hitSlop to its parent's bounds, so the chips' slop only becomes a real touch target
  // once the container reserves room for it. The padding gives each chip's slop somewhere to land inside this frame;
  // the equal negative margin gives the band back the 32px it occupied in the layout, so the screen's rhythm — the
  // 12px gap above (the screen's chipsSection paddingTop) and the 16px below — is unchanged and the padded touch
  // band, 6px into each of them, can overlap neither the field above nor the card below.
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.X_SMALL,
    rowGap: Spacing.X_SMALL,
    paddingVertical: CHIP_HIT_SLOP,
    marginVertical: -CHIP_HIT_SLOP
  },
  // Node 38:62's row draws a 32px band, held as a minimum rather than a fixed height so scaled text grows the chip
  // instead of clipping. 4px of padding around the label's 16px line box plus the two 1px strokes hugs to 26, under
  // that minimum, so the chip still rests at exactly 32 and only large text takes it higher; Figma's literal 8px
  // vertical padding would hug to 34 and break the band for every rung of the row.
  // borderColor matches the chip's own fill so selecting recolours the edge without resizing the chip.
  chip: {
    flexGrow: 1,
    flexBasis: 'auto',
    minHeight: Sizes.CHIP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.XX_SMALL,
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
  // The same dimming the disabled step buttons and date arrows use, applied to the whole chip so its glyph
  // follows: a chip carries no value of its own beyond the fraction it would set.
  chipDisabled: {
    opacity: Opacity.DISABLED
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

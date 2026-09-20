import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// The label's own line box, which OptionCard leaves to the platform font: its label is `FontSize.H3` with no
// `lineHeight` of its own, so React Native measures the box from the font's metrics (~19.1 at 16px on both
// platforms' system faces) and no authored token names it. `ROW_VALUE` is the design system's nearest
// authored line box, so the placeholder's height stays token-derived rather than measured; the 0.4px it adds
// to a card is invisible beside the ~18px a mis-shaped block moves the content below it.
export const LABEL_LINE_BOX = LineHeight.ROW_VALUE

// The sub-copy line box OptionCard pins explicitly, so a placeholder line reserves exactly what a real one
// takes.
export const SUBCOPY_LINE_BOX = LineHeight.OPTION_SUBCOPY

// The indicator OptionCard draws at the head of every row, which is also what sets a card's height where its
// label has no sub-copy beneath it: 22 over a 19.5 line box.
export const INDICATOR_SIZE = Sizes.ICON_LG

// The shimmer inside each line box — a bar shorter than the line it stands for, which is the pattern AAP
// 0.2.5 points at for a loading card (Figma `36:340`: a block for the tile and 14/11-tall bars for the text).
export const LABEL_BAR_HEIGHT = Sizes.SKELETON_BAR

export const SUBCOPY_BAR_HEIGHT = Sizes.SKELETON_BAR_SM

// A label bar stands for a few words, so it is a fixed band rather than the column; a sub-copy line runs the
// column, so its bar stretches and passes the column's own maximum for the sweep to be measured against; the
// last line of a wrapped sentence is a short tail.
export const LABEL_BAR_WIDTH = Sizes.TILE + Sizes.TILE_SM

export const SUBCOPY_BAR_WIDTH = Sizes.CONTENT_MAX_WIDTH

export const SUBCOPY_BAR_TAIL_WIDTH = Sizes.EMPTY_TILE + Sizes.TILE

export default StyleSheet.create({
  // OptionCard's own box model, built from the same tokens: the placeholder is the card's shape, so its
  // height is the card's height by construction instead of by a number copied from a measurement. The
  // unselected fill and hairline stroke are the only state a card can honestly be in before the saved answer
  // says which one is chosen.
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
  textColumn: {
    flex: 1,
    gap: Sizes.OPTION_SUBCOPY_GAP
  },
  // A row the height of the text line it replaces, with the bar centred in it — so the column reserves the
  // text's space while the shimmer keeps the slimmer profile of a placeholder.
  labelLine: {
    height: LABEL_LINE_BOX,
    justifyContent: 'center'
  },
  subcopyLine: {
    height: SUBCOPY_LINE_BOX,
    justifyContent: 'center'
  },
  // Skeleton measures its shimmer sweep from the width prop, so a bar that fills the column passes the
  // column's own maximum there and overrides the width here — the idiom the wizard's other read states use.
  barStretch: {
    width: '100%'
  }
})

import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// Figma 49:669 pads the bar 12/20/22/20 and strokes its top edge only. That 22 px bottom padding is a floor
// beneath the live safe-area inset, never added to it.
export const actionBarPadding = (bottomInset: number): ViewStyle => ({
  paddingBottom: Math.max(bottomInset, Sizes.FOOTER_MIN_BOTTOM)
})

// The row as Figma draws it: a Sizes.CTA-tall control plus the 8 px by which the narrow action sits below the
// wide one (the two centres are 796.000 and 804.000), so the row closes at 60 and not at the control height.
const ACTION_ROW_HEIGHT = Sizes.CTA + Spacing.X_SMALL

// The bar is pinned over the screen's scroll view rather than inside it, so the screen has to reserve the
// bar's own height as scroll padding or its last rows can never be scrolled clear. Derived from the very
// tokens the bar lays itself out with, so the reserve cannot drift from the geometry: the top stroke (Figma
// aligns it INSIDE, so `borderTopWidth` maps 1:1 and the band needs no padding compensation for it), the
// band's top padding, the action row, and the bottom-inset floor — a live safe-area inset only ever exceeds
// that floor, and `actionBarPadding` adds the excess at render time.
const ACTION_BAR_ABOVE_INSET = Stroke.THIN + Spacing.SMALL + ACTION_ROW_HEIGHT

export const ACTION_BAR_RESERVE = ACTION_BAR_ABOVE_INSET + Sizes.FOOTER_MIN_BOTTOM

// The same reserve measured against a live safe-area inset, for a scroll view that can read one. It has to
// track `actionBarPadding`: the band pads its bottom by whichever of the inset and the design floor is
// larger, so a device asking for more than the floor makes the bar taller and the content owes that much more.
export const actionBarReserve = (bottomInset: number): number =>
  ACTION_BAR_ABOVE_INSET + Math.max(bottomInset, Sizes.FOOTER_MIN_BOTTOM)

export default StyleSheet.create({
  bar: {
    paddingTop: Spacing.SMALL,
    paddingHorizontal: Spacing.GUTTER,
    backgroundColor: Theme.colors.background,
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  // The band stays full-bleed — its fill, its hairline and its page gutters span the window — while this row
  // is capped to the same column ContentColumn caps the recipe body to and centred on it, so the actions keep
  // lining up with the ingredients they act on instead of growing to a tablet's window width.
  //
  // Figma 49:670 declares no `alignItems` key, which resolves to MIN there while React Native's own default
  // is `stretch`, so flex-start is emitted explicitly. `alignItems: 'center'` is the one value that matches
  // nothing: combined with the narrow action's drawn offset it halves the stagger to 4 px and pulls the wide
  // action 4 px off the position the comp draws it at.
  splitRow: {
    width: '100%',
    maxWidth: Sizes.CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: ACTION_ROW_HEIGHT,
    columnGap: Spacing.X_SMALL
  },
  // 49:671 declares no width in any framing (`sizing.horizontal: "fill"`), so the wide action takes the
  // remainder rather than a share: the 235 the comp resolves to is 353 − 8 − 110 and holds only at the 393 px
  // reference frame, which is why the pair must never be written as proportional flex weights.
  primarySlot: {
    flex: 1,
    minHeight: Sizes.CTA
  },
  // 49:674 authors both of the narrow action's dimensions (`designedWidth: "110px"`, `designedHeight:
  // "52px"`), so it is a fixed width that neither grows nor shrinks, and 49:677 leaves 8 px empty above it
  // and none below — a drawn offset, reproduced here as the slot's top offset.
  secondarySlot: {
    width: Sizes.ACTION_SECONDARY_W,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: Spacing.X_SMALL,
    minHeight: Sizes.CTA
  }
})

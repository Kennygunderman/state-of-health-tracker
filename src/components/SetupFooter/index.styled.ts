import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// Figma's footer bottom padding (22): a floor beneath the live safe-area inset, never added to it.
export const footerBottomInset = (inset: number): ViewStyle => ({
  paddingBottom: Math.max(inset, Sizes.FOOTER_MIN_BOTTOM)
})

// The measured iOS keyboard lift, kept outside the band so it never reads as part of the band's fill or of
// the bottom inset above: a margin moves the whole footer up and lets the body region shrink with it, where
// padding would grow the painted band downwards into the keyboard.
export const footerKeyboardLift = (lift: number): ViewStyle => ({
  marginBottom: lift
})

// The split row as Figma draws it: a Sizes.CTA-tall control plus the 8 px by which the narrow action sits
// below the wide one, so the row closes at 60 rather than at the control height.
const SPLIT_ROW_HEIGHT = Sizes.CTA + Spacing.X_SMALL

export default StyleSheet.create({
  footer: {
    paddingTop: Spacing.SMALL,
    paddingHorizontal: Spacing.GUTTER,
    backgroundColor: Theme.colors.background
  },
  footerHairline: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  // The band stays full-bleed — its fill, its hairline and its page gutters span the window — while the
  // actions inside it are capped to the same column ContentColumn caps the body to and centred on it. On a
  // tablet a 100%-width action would otherwise grow to the window and stop lining up with the body it acts
  // on. The inter-action gap belongs to this column rather than the band, since it spaces the actions.
  actionCap: {
    width: '100%',
    maxWidth: Sizes.CONTENT_MAX_WIDTH,
    alignSelf: 'center'
  },
  actionColumn: {
    gap: Spacing.X_SMALL
  },
  // Figma's split footer (node 49:669) is a remainder split and not a proportion: its wide action 49:671
  // declares no width in any framing (`sizing.horizontal: "fill"`) while the narrow 49:674 authors both
  // dimensions (`designedWidth: "110px"`, `designedHeight: "52px"`), so the 235 the comp resolves to is
  // 353 − 8 − 110 and holds only at the 393 px reference frame. The row declares no `alignItems` key, which
  // resolves to MIN in Figma while React Native's own default is `stretch`, so flex-start is emitted
  // explicitly; the two actions are drawn on centres 796.000 and 804.000, the narrow one occupying
  // wrapper-local y 8.000→60.000 with 8 px empty above it and none below. That offset is drawn geometry, so
  // it is reproduced as the narrow slot's top offset and the row closes at 60. `alignItems: 'center'` is the
  // one value that matches nothing: with the offset it halves the stagger to 4 px and pulls the wide action
  // 4 px off its drawn position.
  splitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: SPLIT_ROW_HEIGHT,
    columnGap: Spacing.X_SMALL
  },
  splitPrimary: {
    flex: 1,
    minHeight: Sizes.CTA
  },
  splitSecondary: {
    width: Sizes.ACTION_SECONDARY_W,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: Spacing.X_SMALL,
    minHeight: Sizes.CTA
  }
})

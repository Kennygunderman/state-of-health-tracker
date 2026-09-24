import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  // ContentColumn owns the shell's 8px top inset (Figma `46:23`, padding "8px 20px 0px"),
  // so the scroll body carries bottom clearance only.
  scrollContent: {
    paddingBottom: Spacing.LARGE
  },
  // Figma `46:115` ("Container:margin") declares `padding: "8px 0px 0px"` of its own on top of
  // that shell inset, so frame 01 opens at 16px from the status bar to the overline box (`46:24`
  // at y 66) — unlike frame 02, whose first child `46:151` declares no padding and so opens at a
  // single 8px. This rung is load-bearing rather than a duplicate of the shell inset: without it
  // the sample card lands at y 212, where the design measures exactly 220.
  overlineWrapper: {
    paddingTop: Spacing.X_SMALL
  },
  headline: {
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  body: {
    marginTop: Spacing.SMALL,
    fontSize: FontSize.BODY,
    lineHeight: LineHeight.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },
  sampleCardWrapper: {
    marginTop: Spacing.GUTTER
  }
})

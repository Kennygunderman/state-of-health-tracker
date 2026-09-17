import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// A ceiling, never a height: the card keeps hugging its content and only the scaled-text case
// that would outgrow the window is clamped, so the designed 469 px dialog is unaffected.
export const cardMaxHeight = (available: number): ViewStyle => ({
  maxHeight: available
})

export default StyleSheet.create({
  modal: {
    margin: 0
  },
  container: {
    flex: 1,
    justifyContent: 'center'
  },
  card: {
    alignSelf: 'stretch',
    marginHorizontal: Spacing.GUTTER,
    padding: Spacing.GUTTER,
    borderRadius: BorderRadius.MODAL,
    backgroundColor: Theme.colors.card
  },
  // Shrink without grow: the summary region gives way to the pinned actions once the card meets
  // its ceiling, and hugs its content — leaving the dialog its designed size — until then.
  scrollRegion: {
    flexShrink: 1
  },
  title: {
    marginTop: Spacing.MEDIUM,
    fontSize: FontSize.GREETING,
    lineHeight: LineHeight.GREETING,
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
  summaryPanel: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.inset
  },
  notice: {
    marginTop: Spacing.MEDIUM
  },
  primaryAction: {
    marginTop: Spacing.GUTTER
  },
  dismissAction: {
    marginTop: Spacing.X_SMALL
  }
})

import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

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
  primaryAction: {
    marginTop: Spacing.GUTTER
  },
  dismissAction: {
    marginTop: Spacing.X_SMALL
  }
})

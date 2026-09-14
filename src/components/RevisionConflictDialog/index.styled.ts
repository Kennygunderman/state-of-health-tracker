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
    fontSize: FontSize.GREETING,
    lineHeight: LineHeight.GREETING,
    letterSpacing: LetterSpacing.TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  primaryAction: {
    marginTop: Spacing.GUTTER
  },
  dismissAction: {
    marginTop: Spacing.X_SMALL
  }
})

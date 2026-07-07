import {StyleSheet} from 'react-native'

import FontSize from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: Spacing.MEDIUM,
    paddingBottom: Spacing.LARGE
  },
  content: {
    flex: 1
  },
  title: {
    fontSize: FontSize.H1,
    fontWeight: 'bold',
    marginTop: Spacing.SMALL
  },
  pausedBody: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted,
    marginTop: Spacing.X_SMALL,
    lineHeight: 20
  },
  selectorWrapper: {
    marginTop: Spacing.LARGE
  },
  saveWrapper: {
    marginTop: Spacing.LARGE
  },
  footerAction: {
    alignItems: 'center',
    paddingVertical: Spacing.SMALL
  },
  footerActionText: {
    fontSize: FontSize.BODY,
    fontWeight: '600',
    color: Theme.colors.textMuted
  },
  turnOffText: {
    fontSize: FontSize.BODY,
    fontWeight: '600',
    color: Theme.colors.error
  }
})

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
  subtitle: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted,
    marginTop: Spacing.X_SMALL,
    lineHeight: 20
  },
  fieldLabel: {
    fontSize: FontSize.OVERLINE,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.LARGE,
    marginBottom: Spacing.X_SMALL
  },
  heightRow: {
    flexDirection: 'row',
    columnGap: Spacing.SMALL
  },
  heightInput: {
    flex: 1
  },
  buttonWrapper: {
    marginTop: Spacing.MEDIUM
  }
})

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
    lineHeight: 21
  },
  points: {
    marginTop: Spacing.X_LARGE,
    rowGap: Spacing.LARGE
  },
  pointRow: {
    flexDirection: 'row',
    columnGap: Spacing.SMALL
  },
  pointTextWrapper: {
    flex: 1
  },
  pointTitle: {
    fontSize: FontSize.CARD_TITLE,
    fontWeight: '600'
  },
  pointBody: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 20
  },
  buttonWrapper: {
    marginTop: Spacing.MEDIUM
  }
})

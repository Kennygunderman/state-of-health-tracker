import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.ITEM,
    paddingHorizontal: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL,
    marginHorizontal: Spacing.MEDIUM,
    marginBottom: Spacing.SMALL
  },
  textColumn: {
    flex: 1,
    marginRight: Spacing.SMALL
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.X_SMALL
  },
  // The name-plus-serving group. Deliberately without a `gap`: the serving carries its own ' · ' separator,
  // so a row narrow enough to fit measures identically to the single text node this replaced. It shrinks
  // (against the badge beside it) but never grows, leaving the badge its own wrap behaviour in `nameRow`.
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto'
  },
  name: {
    // The row's one truncatable part: the name yields the width the serving and the badge need.
    flexShrink: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.BOLD
  },
  detail: {
    // Never shrunk, so the serving is neither ellipsized nor wrapped mid-amount however long the name is.
    flexShrink: 0,
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted
  },
  subtitle: {
    fontSize: FontSize.CAPTION,
    color: Theme.colors.textMuted,
    marginTop: Spacing.XX_SMALL
  },
  caloriesText: {
    textAlign: 'right'
  },
  caloriesValue: {
    fontSize: FontSize.H3,
    fontWeight: FontWeight.BOLD
  },
  caloriesLabel: {
    fontSize: FontSize.OVERLINE,
    color: Theme.colors.textMuted
  }
})

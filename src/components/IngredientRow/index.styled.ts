import {StyleSheet} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  // Figma authors `alignItems: center` on this row (node 49:616) and declares no column gap -- deliberately
  // the opposite of its neighbour the instruction step row, which is top-aligned with a 12px gap. Both are
  // reproduced as authored: `space-between` alone separates the columns, and a wrapped quantity sits at its
  // block's vertical centre against a one-line name, which is the behaviour the design specifies.
  container: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  name: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.text
  },
  // Capped and shrinkable so a long formatted quantity wraps within its own half instead of
  // collapsing the `flex: 1` name (basis 0) to zero. No line cap: AAP 0.7.4 forbids one on body text.
  quantity: {
    flexShrink: 1,
    maxWidth: '50%',
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    textAlign: 'right',
    color: Theme.colors.textSecondary
  }
})

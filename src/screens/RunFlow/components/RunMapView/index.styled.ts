import { StyleSheet } from 'react-native'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

export default StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: FontSize.H3,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
  },
  legendContainer: {
    position: 'absolute',
    top: Spacing.SMALL,
    right: Spacing.SMALL,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.SMALL,
  },
  legendText: {
    fontSize: FontSize.H1,
    color: 'white',
    fontWeight: '500',
  },
})

import { StyleSheet } from 'react-native'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.LARGE,
    paddingHorizontal: Spacing.MEDIUM,
    position: 'relative',
  },
  headerTitle: {
    fontSize: FontSize.H1,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: FontSize.PARAGRAPH,
    textAlign: 'center',
    marginTop: Spacing.XX_SMALL,
    opacity: 0.8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.MEDIUM,
  },
  controlsContainer: {
    paddingHorizontal: Spacing.MEDIUM,
    paddingTop: Spacing.LARGE,
    backgroundColor: 'transparent',
    minHeight: 80,
  },
  topLeftButton: {
    position: 'absolute',
    top: Spacing.MEDIUM,
    left: Spacing.MEDIUM + 44 + Spacing.SMALL, // Position as second button (to the right)
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  topLeftSecondButton: {
    position: 'absolute',
    top: Spacing.MEDIUM,
    left: Spacing.MEDIUM, // Position as first button (leftmost)
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  topRightButton: {
    position: 'absolute',
    top: Spacing.MEDIUM,
    right: Spacing.MEDIUM,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: Spacing.MEDIUM,
  },
})

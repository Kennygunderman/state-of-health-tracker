import {StyleSheet} from 'react-native'

import FontSize from '@styles/fontSize'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  backdropTouchableArea: {
    flex: 1
  },
  // The sheet's own surface, passed to BottomSheet's backgroundStyle. Named here rather than written inline at
  // the call site so the component carries no style object of its own.
  sheetBackground: {
    backgroundColor: Theme.colors.background
  },
  sheetShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10
  },
  sheetContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20
  },
  title: {
    fontSize: FontSize.H1,
    fontWeight: 'bold'
  },
  desc: {
    marginVertical: 24,
    fontSize: FontSize.PARAGRAPH,
    fontWeight: '200'
  },
  button: {
    marginBottom: 48
  }
})

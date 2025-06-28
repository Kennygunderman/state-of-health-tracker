import {StyleSheet} from 'react-native'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

export default StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  backdropTouchableArea: {
    flex: 1
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

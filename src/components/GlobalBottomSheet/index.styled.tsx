import {StyleSheet} from 'react-native'

export default StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)'
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
    elevation: 10 // Android shadow
  },
  sheetContent: {
    padding: 20
  }
})

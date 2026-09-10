import {StyleSheet, ViewStyle} from 'react-native'

export const spinnerBox = (size: number): ViewStyle => ({
  width: size,
  height: size
})

export default StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  }
})

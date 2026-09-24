import {TextStyle, ViewStyle} from 'react-native'

import {Theme} from '@styles/theme'

export const dropDownContainer = (width?: number): ViewStyle => ({
  width: width ?? '100%',
  backgroundColor: Theme.colors.secondary,
  borderWidth: 0,
  height: 300
})

export const pickerControl = (width: number | undefined, disabled: boolean): ViewStyle => ({
  width: width ?? '100%',
  opacity: disabled ? 0.25 : 1,
  elevation: 100,
  backgroundColor: Theme.colors.secondary,
  borderWidth: 0
})

export const arrowIcon: ViewStyle = {
  tintColor: Theme.colors.secondaryLighter
} as ViewStyle

export const tickIcon: ViewStyle = {
  tintColor: Theme.colors.secondaryLighter
} as ViewStyle

export const pickerText: TextStyle = {
  color: Theme.colors.white
}

export const pickerPlaceholder: TextStyle = {
  color: Theme.colors.white
}

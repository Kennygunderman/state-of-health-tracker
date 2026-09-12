import React from 'react'

import {TouchableOpacity} from 'react-native'

import {Opacity, Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

import CheckIcon from '@components/icons/CheckIcon'

import styles from './index.styled'

const HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.ICON_LG) / 2

interface Props {
  state: 'unchecked' | 'checkedMuted' | 'checkedEmphasis'
  onPress: () => void
  accessibilityLabel: string
  disabled?: boolean
}

const CheckboxSquare = (props: Props) => {
  const {state, onPress, accessibilityLabel, disabled = false} = props

  const tickColor = state === 'checkedEmphasis' ? Theme.colors.white : Theme.colors.textFaint

  return (
    <TouchableOpacity
      style={[
        styles.container,
        state === 'checkedMuted' && styles.containerCheckedMuted,
        state === 'checkedEmphasis' && styles.containerCheckedEmphasis
      ]}
      activeOpacity={Opacity.PRESSED}
      hitSlop={HIT_SLOP}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{checked: state !== 'unchecked', disabled}}
      onPress={onPress}>
      {state !== 'unchecked' && <CheckIcon color={tickColor} size={Sizes.ICON_XS} />}
    </TouchableOpacity>
  )
}

export default CheckboxSquare

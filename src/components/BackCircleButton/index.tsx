import React from 'react'

import {TouchableOpacity} from 'react-native'

import {Opacity, Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import ChevronLeftIcon from '@components/icons/ChevronLeftIcon'

import styles from './index.styled'

const HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.TILE_SM) / 2

export type BackCircleButtonVariant = 'default' | 'scrim'

interface Props {
  onPress: () => void
  variant?: BackCircleButtonVariant
  accessibilityLabel: string
}

const BackCircleButton = ({onPress, variant = 'default', accessibilityLabel}: Props) => (
  <TouchableOpacity
    style={[styles.button, styles[variant]]}
    onPress={onPress}
    activeOpacity={Opacity.PRESSED}
    hitSlop={HIT_SLOP}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}>
    <ChevronLeftIcon color={Theme.colors.text} size={Sizes.ICON_XL} strokeWidth={Stroke.BOLD} />
  </TouchableOpacity>
)

export default BackCircleButton

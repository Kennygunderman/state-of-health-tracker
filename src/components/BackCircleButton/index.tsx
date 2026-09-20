import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import {BACK_CHEVRON_REFERENCE_SIZE} from '@components/icons/ChevronGeometry'
import ChevronLeftIcon from '@components/icons/ChevronLeftIcon'

import styles from './index.styled'

const HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.TILE_SM) / 2

export type BackCircleButtonVariant = 'default' | 'scrim'

interface Props {
  onPress: () => void
  variant?: BackCircleButtonVariant
  accessibilityLabel: string
}

const BackCircleButton = ({onPress, variant = 'default', accessibilityLabel}: Props): React.JSX.Element => (
  <TouchableOpacity
    style={[styles.button, styles[variant]]}
    onPress={onPress}
    activeOpacity={Opacity.PRESSED}
    hitSlop={HIT_SLOP}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}>
    <View style={styles.glyph}>
      <ChevronLeftIcon color={Theme.colors.text} size={BACK_CHEVRON_REFERENCE_SIZE} strokeWidth={Stroke.BOLD} />
    </View>
  </TouchableOpacity>
)

export default BackCircleButton

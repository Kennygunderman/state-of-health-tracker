import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

import CheckIcon from '@components/icons/CheckIcon'
import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  readonly label: string
  readonly selected: boolean
  readonly onPress: () => void
  readonly subcopy?: string
}

const OptionCard = ({label, selected, onPress, subcopy}: Props) => (
  <TouchableOpacity
    style={[styles.card, selected && styles.cardSelected]}
    activeOpacity={Opacity.PRESSED}
    accessibilityRole="radio"
    accessibilityState={{checked: selected}}
    accessibilityLabel={subcopy ? `${label}. ${subcopy}` : label}
    onPress={onPress}>
    <View style={[styles.indicator, selected && styles.indicatorSelected]}>
      {selected && <CheckIcon color={Theme.colors.white} size={Sizes.ICON_XS} />}
    </View>

    <View style={styles.textColumn}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>

      {!!subcopy && <Text style={[styles.subcopy, selected && styles.subcopySelected]}>{subcopy}</Text>}
    </View>
  </TouchableOpacity>
)

export default OptionCard

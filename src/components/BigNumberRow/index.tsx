import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  figure: string
  unit: string
  size?: 'hero' | 'stat'
}

const BigNumberRow = ({figure, unit, size = 'stat'}: Props): React.JSX.Element => {
  return (
    <View style={styles.row}>
      <Text style={[styles.figure, size === 'hero' ? styles.figureHero : styles.figureStat]}>{figure}</Text>

      <Text style={styles.unit}>{unit}</Text>
    </View>
  )
}

export default BigNumberRow

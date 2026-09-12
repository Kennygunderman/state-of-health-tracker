import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  label: string
  tone?: 'neutral' | 'warning'
}

const BadgePill = ({label, tone = 'neutral'}: Props): React.JSX.Element => {
  const isWarning = tone === 'warning'

  return (
    <View style={[styles.pill, isWarning && styles.pillWarning]}>
      <Text style={[styles.label, isWarning && styles.labelWarning]}>{label}</Text>
    </View>
  )
}

export default BadgePill

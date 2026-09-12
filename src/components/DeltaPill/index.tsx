import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  text: string
  tone?: 'negative' | 'positive' | 'danger'
}

const DeltaPill = ({text, tone = 'negative'}: Props) => {
  const containerStyle = [styles.container, tone === 'danger' && styles.containerDanger]
  const labelStyle = [
    styles.label,
    tone === 'positive' && styles.labelPositive,
    tone === 'danger' && styles.labelDanger
  ]

  return (
    <View style={containerStyle}>
      <Text style={labelStyle} numberOfLines={1} adjustsFontSizeToFit>
        {text}
      </Text>
    </View>
  )
}

export default DeltaPill

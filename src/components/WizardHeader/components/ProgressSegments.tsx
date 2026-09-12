import React from 'react'

import {View} from 'react-native'

import styles from '../index.styled'

interface Props {
  total: number
  filled: number
}

const ProgressSegments = ({total, filled}: Props) => (
  <View style={styles.track} importantForAccessibility="no">
    {Array.from({length: total}, (_, index) => (
      <View key={index} style={[styles.segment, index < filled && styles.segmentFilled]} />
    ))}
  </View>
)

export default ProgressSegments

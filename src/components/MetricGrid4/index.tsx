import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

export interface MetricGridItem {
  caption: string
  value: string
}

interface Props {
  items: readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem]
}

const MetricGrid4 = ({items}: Props) => (
  <View style={styles.container}>
    {items.map(item => (
      <View key={item.caption} style={styles.cell}>
        <Text style={styles.caption}>{item.caption}</Text>

        <Text style={styles.value}>{item.value}</Text>
      </View>
    ))}
  </View>
)

export default MetricGrid4

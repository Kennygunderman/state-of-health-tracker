import React from 'react'

import {View} from 'react-native'

import {composeAccessibleName} from '@utility/AccessibilityUtility'

import Text from '@components/Text'

import {MEAL_PLAN_METRIC_ANNOUNCEMENT_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import styles from './index.styled'

export interface MetricGridItem {
  caption: string
  value: string
}

interface Props {
  items: readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem]
}

// One cell is one metric, so it is one reading stop rather than an orphan caption followed by an orphan
// figure. The name is the metric's sentence order ('420 cal'), not the order the cell draws it in, which is
// why it comes from the template rather than from the platform's own read of the two subviews; a grid nested
// inside an `accessible` ancestor (12, 15) hands that ancestor these names in place of the bare text.
const MetricGrid4 = ({items}: Props): React.JSX.Element => (
  <View style={styles.container}>
    {items.map(item => (
      <View
        key={item.caption}
        style={styles.cell}
        accessible
        accessibilityLabel={composeAccessibleName([
          stringWithNamedParameters(MEAL_PLAN_METRIC_ANNOUNCEMENT_TEMPLATE, {
            value: item.value,
            caption: item.caption
          })
        ])}>
        <Text style={styles.caption}>{item.caption}</Text>

        <Text style={styles.value}>{item.value}</Text>
      </View>
    ))}
  </View>
)

export default MetricGrid4

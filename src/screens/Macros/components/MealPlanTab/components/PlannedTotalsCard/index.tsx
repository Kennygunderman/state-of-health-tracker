import React from 'react'

import {View} from 'react-native'

import BigNumberRow from '@components/BigNumberRow'
import MacroLegendRow from '@components/MacroLegendRow'
import SectionOverline from '@components/SectionOverline'
import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  dayName: string
  targetText: string
  figure: string
  unitText: string
  legend: {label: string; valueText: string; dotColor: string}[]
}

const PlannedTotalsCard = ({dayName, targetText, figure, unitText, legend}: Props) => (
  <View style={styles.card}>
    <View style={styles.headerRow}>
      <SectionOverline text={dayName} />

      <Text style={styles.targetText}>{targetText}</Text>
    </View>

    <View style={styles.figureRow}>
      <BigNumberRow size="stat" figure={figure} unit={unitText} />
    </View>

    <View style={styles.divider} />

    <View style={styles.legend}>
      {legend.map((item, index) => (
        <MacroLegendRow
          key={item.label}
          label={item.label}
          valueText={item.valueText}
          dotColor={item.dotColor}
          isFirst={index === 0}
        />
      ))}
    </View>
  </View>
)

export default PlannedTotalsCard

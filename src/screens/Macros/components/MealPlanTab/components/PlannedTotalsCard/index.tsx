import React from 'react'

import {View} from 'react-native'

import {composeAccessibleName} from '@utility/AccessibilityUtility'

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

// The day and the target it is measured against are one fact, and so are the figure and the unit that gives
// it meaning: each pair is one reading stop named from the props rather than two stops a reader has to hold
// together ('Planned for Saturday, Target 1,709' and '1,691, kcal across 3 meals').
const PlannedTotalsCard = ({dayName, targetText, figure, unitText, legend}: Props): React.JSX.Element => (
  <View style={styles.card}>
    <View style={styles.headerRow} accessible accessibilityLabel={composeAccessibleName([dayName, targetText])}>
      <View style={styles.dayNameSlot}>
        <SectionOverline text={dayName} />
      </View>

      <Text style={styles.targetText}>{targetText}</Text>
    </View>

    <View style={styles.figureRow} accessible accessibilityLabel={composeAccessibleName([figure, unitText])}>
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

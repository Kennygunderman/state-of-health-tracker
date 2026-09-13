import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'

import GroceryCartIcon from '@components/icons/GroceryCartIcon'
import SectionOverline from '@components/SectionOverline'
import Text from '@components/Text'

import {MEAL_PLAN_GROCERY_LIST_ACCESSIBILITY_LABEL, MEAL_PLAN_TITLE} from '@constants/strings'

import styles from './index.styled'

interface Props {
  rangeText: string
  onGroceryPressed: () => void
}

const PlanHeader = ({rangeText, onGroceryPressed}: Props): React.JSX.Element => {
  return (
    <View style={styles.row}>
      <View style={styles.titleBlock}>
        <SectionOverline text={rangeText} tone="green" />

        <Text style={styles.title}>{MEAL_PLAN_TITLE}</Text>
      </View>

      <TouchableOpacity
        style={styles.groceryButton}
        activeOpacity={Opacity.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={MEAL_PLAN_GROCERY_LIST_ACCESSIBILITY_LABEL}
        onPress={onGroceryPressed}>
        <View style={styles.groceryDisc}>
          <GroceryCartIcon variant="header" color={Theme.colors.text} />
        </View>
      </TouchableOpacity>
    </View>
  )
}

export default PlanHeader

import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'

import GroceryCartIcon from '@components/icons/GroceryCartIcon'
import SectionOverline from '@components/SectionOverline'
import Text from '@components/Text'

import {
  MEAL_PLAN_GROCERY_LIST_ACCESSIBILITY_LABEL,
  MEAL_PLAN_NEXT_WEEK_LINK_TEXT,
  MEAL_PLAN_THIS_WEEK_LINK_TEXT,
  MEAL_PLAN_TITLE
} from '@constants/strings'

import styles, {GROCERY_BUTTON_HIT_SLOP} from './index.styled'

interface Props {
  rangeText: string
  onGroceryPressed: () => void
  switchLink?: 'next' | 'this'
  onSwitchPressed?: () => void
}

const PlanHeader = ({rangeText, onGroceryPressed, switchLink, onSwitchPressed}: Props): React.JSX.Element => {
  const switchLinkText = switchLink === 'next' ? MEAL_PLAN_NEXT_WEEK_LINK_TEXT : MEAL_PLAN_THIS_WEEK_LINK_TEXT

  return (
    <View style={styles.row}>
      <View style={styles.titleBlock}>
        <SectionOverline text={rangeText} tone="green" />

        <Text style={styles.title}>{MEAL_PLAN_TITLE}</Text>
      </View>

      <View style={styles.actions}>
        {!!switchLink && !!onSwitchPressed && (
          <TouchableOpacity
            activeOpacity={Opacity.PRESSED}
            accessibilityRole="button"
            accessibilityLabel={switchLinkText}
            onPress={onSwitchPressed}>
            <Text style={styles.switchLink} numberOfLines={1}>
              {switchLinkText}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.groceryButton}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={MEAL_PLAN_GROCERY_LIST_ACCESSIBILITY_LABEL}
          hitSlop={GROCERY_BUTTON_HIT_SLOP}
          onPress={onGroceryPressed}>
          <GroceryCartIcon variant="header" color={Theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default PlanHeader

import React from 'react'

import {View} from 'react-native'

import OptionCard from '@components/OptionCard'

import styles from './index.styled'
import {DiaryBucketOption} from '../../index.util'

interface Props {
  options: readonly DiaryBucketOption[]
  selectedMealId: string | null
  onSelect: (mealId: string) => void
  /**
   * The bucket is on record and cannot be changed — an unresolved idempotency key is re-sent with the body it
   * was minted for (0.7.2). Every row is then a reading rather than a choice: the chosen one keeps its full
   * treatment, because it names where the pending write lands, and the rest are dimmed and unreachable.
   */
  disabled?: boolean
}

const SlotPicker = ({options, selectedMealId, onSelect, disabled = false}: Props): React.JSX.Element => {
  return (
    <View style={styles.column}>
      {/* BLITZY [A11Y]: these rows render no colour of their own. Figma authors this picker from the same
          template objects as OptionCard — `38:119` matches `46:170` node for node — so the selected
          indicator carries OptionCard's white-on-accent pair at 2.45:1 and the unselected ring its
          hollow-outline pair at 2.23:1, both upheld and flagged at that component. See the
          accessible-colour register in `@styles/theme`. */}
      {options.map(option => {
        const selected = option.mealId === selectedMealId
        const card = (
          <OptionCard
            key={option.mealId}
            label={option.label}
            selected={selected}
            onPress={() => onSelect(option.mealId)}
          />
        )

        if (!disabled) {
          return card
        }

        // OptionCard is shared across the setup flow and carries no disabled state, so the row is presented
        // instead of offered: this wrapper is the accessible element and says the choice is unavailable, while
        // the card's own touchable is taken out of the accessibility tree so a screen reader cannot reach a
        // control that would do nothing. The label still reads, which is the point — the user must be able to
        // hear which bucket the pending write is going to.
        return (
          <View
            key={option.mealId}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{checked: selected, disabled: true}}
            style={!selected && styles.rowDisabled}>
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {card}
            </View>
          </View>
        )
      })}
    </View>
  )
}

export default SlotPicker

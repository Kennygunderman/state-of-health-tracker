import React, {useCallback} from 'react'

import {FlatList, ListRenderItemInfo} from 'react-native'

import SelectableChip from '@components/SelectableChip'

import styles from './index.styled'
import {SelectedFoodChip} from '../../index.util'

interface Props {
  foods: readonly SelectedFoodChip[]
  onRemove: (id: string) => void
}

const keyExtractor = (food: SelectedFoodChip): string => food.id

/* BLITZY [A11Y]: these chips are the only affordance for removing a selection, so they take the 44px pressable
   rather than relying on hit slop the hugging scroll band would clip. The pill each one draws is unchanged —
   Figma's 32px chip — but the row is 44px tall where Figma draws it 40px (`47:431`, an 8px rung plus one 32px
   chip), which lowers the helper text beneath it; the rationale is recorded once at @components/SelectableChip
   and flagged there for designer review. */
const SelectedChipsRow = ({foods, onRemove}: Props): React.JSX.Element => {
  // A selection can reach the dislike cap of a hundred while the band shows a handful, so the chips are
  // mounted as they are scrolled to and one press handler exists per mounted chip rather than per selection.
  const renderChip = useCallback(
    ({item}: ListRenderItemInfo<SelectedFoodChip>): React.JSX.Element => (
      <SelectableChip label={item.name} selected removable expandTouchTarget onPress={() => onRemove(item.id)} />
    ),
    [onRemove]
  )

  return (
    // ChipCloud takes no style pass-through, so this row's scroll geometry lives in the colocated stylesheet
    // here. Its keyboard handling is preserved: 06b keeps the search field focused with a query typed
    // (`47:463`), so the first tap has to reach the chip.
    <FlatList
      horizontal
      data={foods}
      renderItem={renderChip}
      keyExtractor={keyExtractor}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.row}
      contentContainerStyle={styles.rowContent}
    />
  )
}

export default SelectedChipsRow

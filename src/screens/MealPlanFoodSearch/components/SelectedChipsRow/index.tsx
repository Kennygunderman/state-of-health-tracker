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

/* BLITZY [A11Y]: 47:431 draws this row 40px — its own 8px rung, owned by the screen, over one 32px chip — and
   the chips reach the 44px touch minimum through their own hit slop rather than a taller pressable that would
   render the row 44px. The band reserves the slop inside its own box and hands the height back to the layout
   (see index.styled), so the drawn geometry is unchanged. Residual, flagged for designer review: the reserved
   6px sits outside the band's layout box, so a touch there has to pass the view that wraps this row, and that
   view belongs to the screen — the rationale in full is recorded at @components/SelectableChip. */
const SelectedChipsRow = ({foods, onRemove}: Props): React.JSX.Element => {
  // A selection can reach the dislike cap of a hundred while the band shows a handful, so the chips are
  // mounted as they are scrolled to and one press handler exists per mounted chip rather than per selection.
  const renderChip = useCallback(
    ({item}: ListRenderItemInfo<SelectedFoodChip>): React.JSX.Element => (
      <SelectableChip label={item.name} selected removable onPress={() => onRemove(item.id)} />
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

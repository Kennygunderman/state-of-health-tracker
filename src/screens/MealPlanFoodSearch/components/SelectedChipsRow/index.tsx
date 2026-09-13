import React from 'react'

import ChipCloud from '@components/ChipCloud'
import SelectableChip from '@components/SelectableChip'

interface Props {
  foods: {id: string; name: string}[]
  onRemove: (id: string) => void
}

/* BLITZY [A11Y]: these chips are the only affordance for removing a selection, so they take the 44px pressable
   rather than relying on hit slop the hugging scroll band would clip. The pill each one draws is unchanged —
   Figma's 32px chip — but the row is 44px tall where Figma draws it 40px (`47:431`, an 8px rung plus one 32px
   chip), which lowers the helper text beneath it; the rationale is recorded once at @components/SelectableChip
   and flagged there for designer review. */
const SelectedChipsRow = ({foods, onRemove}: Props): React.JSX.Element => {
  return (
    <ChipCloud variant="scroll">
      {foods.map(food => (
        <SelectableChip
          key={food.id}
          label={food.name}
          selected
          removable
          expandTouchTarget
          onPress={() => onRemove(food.id)}
        />
      ))}
    </ChipCloud>
  )
}

export default SelectedChipsRow

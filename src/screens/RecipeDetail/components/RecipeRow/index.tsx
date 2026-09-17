import React from 'react'

import IngredientRow from '@components/IngredientRow'

import {isSameRecipeRow, RecipeDetailRow} from '../../index.util'
import InstructionStep from '../InstructionStep'

interface Props {
  row: RecipeDetailRow
}

/**
 * One row of frame 12's ingredient or instruction list, as the virtualizer's cell content.
 *
 * MEMOIZED, AND THAT IS ITS PURPOSE. A virtualized cell re-renders whenever the list around it does, so
 * without a memo boundary every mounted ingredient and instruction row — and every `Text` beneath it — would
 * rebuild on each portion-toggle press and on each background refetch.
 *
 * The boundary compares row CONTENT rather than row identity, because identity is not stable: every
 * recompute of `buildRecipeDetailSections` builds fresh objects for both sections, so a portion toggle —
 * which changes only the ingredient amounts — hands each instruction row a new object carrying the same step
 * and text. `React.memo`'s default shallow comparison would see a changed prop and rerender all of them,
 * which is the work this boundary exists to avoid, so `isSameRecipeRow` decides instead.
 *
 * It carries no styles: the row's column and spacing belong to the one place the section headers read them
 * from too (`index.styled.ts`), so the list's geometry has a single authority.
 */
const RecipeRow = ({row}: Props): React.JSX.Element =>
  row.kind === 'ingredient' ? (
    <IngredientRow name={row.name} quantityText={row.quantityText} />
  ) : (
    <InstructionStep index={row.step} text={row.text} />
  )

const arePropsEqual = (previous: Props, next: Props): boolean => isSameRecipeRow(previous.row, next.row)

export default React.memo(RecipeRow, arePropsEqual)

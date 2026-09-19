import React from 'react'

import {GroceryItem, GroceryItemFlag} from '@data/models/GroceryList'

import {GroceryRowVariant} from '../../index.util'
import GroceryFlagRow from '../GroceryFlagRow'
import GroceryItemRow from '../GroceryItemRow'

interface Props {
  item: GroceryItem
  variant: GroceryRowVariant
  isFirst: boolean
  isPending: boolean
  // Forwarded to whichever variant this row resolves to, so the screen's one reader reaches both leaf rows.
  onToggle: (item: GroceryItem) => void
}

const GroceryRow = ({item, variant, isFirst, isPending, onToggle}: Props): React.JSX.Element => {
  if (variant === 'flagged') {
    return <GroceryFlagRow item={item} isFirst={isFirst} isPending={isPending} onToggle={onToggle} />
  }

  return <GroceryItemRow item={item} variant={variant} isFirst={isFirst} isPending={isPending} onToggle={onToggle} />
}

const isSameFlag = (previous: GroceryItemFlag | null, next: GroceryItemFlag | null): boolean => {
  if (previous === null || next === null) {
    return previous === next
  }

  const equalFields: Record<keyof GroceryItemFlag, boolean> = {
    previousDisplayText: previous.previousDisplayText === next.previousDisplayText,
    newDisplayText: previous.newDisplayText === next.newDisplayText,
    deltaDisplayText: previous.deltaDisplayText === next.deltaDisplayText,
    flaggedAt: previous.flaggedAt === next.flaggedAt
  }

  return Object.values(equalFields).every(isEqual => isEqual)
}

const isSameItem = (previous: GroceryItem, next: GroceryItem): boolean => {
  if (previous === next) {
    return true
  }

  // Keyed by `keyof GroceryItem`, so a field added to the model is a compile error here until this comparison
  // accounts for it — a field silently left out would leave a row showing a value the cache no longer holds.
  const equalFields: Record<keyof GroceryItem, boolean> = {
    id: previous.id === next.id,
    catalogFoodId: previous.catalogFoodId === next.catalogFoodId,
    foodState: previous.foodState === next.foodState,
    name: previous.name === next.name,
    quantityGrams: previous.quantityGrams === next.quantityGrams,
    displayText: previous.displayText === next.displayText,
    isChecked: previous.isChecked === next.isChecked,
    category: previous.category === next.category,
    flag: isSameFlag(previous.flag, next.flag)
  }

  return Object.values(equalFields).every(isEqual => isEqual)
}

/**
 * Compares the row by value on its item and by identity on everything else.
 *
 * Identity alone is not enough here, and not because of anything this screen does: ticking a row removes it
 * from its aisle's array, and TanStack's structural sharing walks arrays **by index**, so `replaceEqualDeep`
 * rebuilds every row below the ticked one into a fresh object holding the same fields
 * [node_modules/@tanstack/query-core/build/modern/utils.js:107-137] — the optimistic `setQueryData` write goes
 * through it just as the settle refetch does. An identity comparison reads those rebuilt rows as changed and
 * re-runs a whole aisle of row bodies for a tick that changed one row, which is the cost QA measured (F02).
 * The comparison is bounded — nine scalar compares for the row and four for its flag, against the templated
 * strings and the JSX tree a row body would otherwise rebuild.
 */
const arePropsEqual = (previous: Props, next: Props): boolean =>
  previous.variant === next.variant &&
  previous.isFirst === next.isFirst &&
  previous.isPending === next.isPending &&
  previous.onToggle === next.onToggle &&
  isSameItem(previous.item, next.item)

/**
 * Memoized here rather than at the two leaves it dispatches to, so a row whose values are unchanged stops at
 * this boundary and neither leaf rebuilds its accessibility strings; both leaves keep their own default
 * comparison for the props this one forwards.
 */
export default React.memo(GroceryRow, arePropsEqual)

import React from 'react'

import {GroceryItem} from '@data/models/GroceryList'

import {GroceryRowVariant} from '../../index.util'
import GroceryFlagRow from '../GroceryFlagRow'
import GroceryItemRow from '../GroceryItemRow'

interface Props {
  item: GroceryItem
  variant: GroceryRowVariant
  isFirst: boolean
  isPending: boolean
  onToggle: () => void
}

const GroceryRow = ({item, variant, isFirst, isPending, onToggle}: Props) => {
  if (variant === 'flagged') {
    return <GroceryFlagRow item={item} isFirst={isFirst} isPending={isPending} onToggle={onToggle} />
  }

  return <GroceryItemRow item={item} variant={variant} isFirst={isFirst} isPending={isPending} onToggle={onToggle} />
}

export default GroceryRow

import React, {useCallback} from 'react'

import {BrandedFood} from '@data/models/BrandedFood'
import {CatalogFood} from '@data/models/CatalogFood'

import {CatalogProvenanceBadge} from '../index.util'
import FoodListRow from './FoodListRow'

interface Props {
  // The search result this row draws. It is carried by identity — the object the query cache holds — so this
  // row's props stay equal while the screen re-renders, and it is what the press hands back for mapping: the
  // mapping belongs to the screen, which owns navigation, not to a presentational row.
  result: CatalogFood | BrandedFood
  name: string
  detail?: string | null
  subtitle?: string | null
  calories: number
  // Present on catalog rows only. A branded or library row carries no pill, which is itself the marker that
  // its numbers are not source-backed.
  badge?: CatalogProvenanceBadge
  onPress: (result: CatalogFood | BrandedFood) => void
}

/**
 * One row of catalog or branded search results.
 *
 * It exists to own the row's press closure. Built inline by the list's `renderItem`, that closure would be a
 * fresh function for every visible row on every render of the screen, which is what makes an infinite section
 * expensive; held here behind `React.memo`, it is rebuilt only when this row's own result or handler changes.
 */
const FoodResultRow = ({
  result,
  name,
  detail = null,
  subtitle = null,
  calories,
  badge = undefined,
  onPress
}: Props): React.JSX.Element => {
  const onRowPressed = useCallback(() => onPress(result), [onPress, result])

  return (
    <FoodListRow
      name={name}
      detail={detail}
      subtitle={subtitle}
      calories={calories}
      badge={badge}
      onPress={onRowPressed}
    />
  )
}

export default React.memo(FoodResultRow)

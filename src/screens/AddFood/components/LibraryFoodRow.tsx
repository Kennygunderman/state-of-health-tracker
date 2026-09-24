import React, {useCallback} from 'react'

import {Food, formatServingText} from '@data/models/Food'
import Spacing from '@styles/spacing'
import ListSwipeItemManager from '@utility/ListSwipeItemManager'
import {Swipeable} from 'react-native-gesture-handler'

import SwipeDeleteListItem from '@components/SwipeDeleteListItem'

import {formatMacroSummary} from '../index.util'
import FoodListRow from './FoodListRow'

interface Props {
  food: Food
  // The row's position within its section, which is the key the swipe manager registers the row under
  index: number
  swipeItemManager: ListSwipeItemManager
  onPress: (food: Food) => void
  onDelete: (food: Food) => void
}

/**
 * One row of the user's own food library, with its swipe-to-delete gesture.
 *
 * Four closures bind a library row to its food — the swipeable ref, the swipe-open callback, the delete press
 * and the row press. Held here they are rebuilt only when this row's food, position or handlers change,
 * rather than four fresh functions per visible row on every render of the screen.
 *
 * Deliberately not wrapped in `React.memo`, unlike the search-result row beside it. `ListSwipeItemManager`'s
 * ref registry is rebuilt by `setRows` on every render of the screen, and a row re-registers its `Swipeable`
 * only by rendering — `SwipeDeleteListItem` passes an inline `ref` callback, which React re-invokes on each of
 * its renders. A row that skipped its render would therefore stay out of the rebuilt registry, and
 * "swiping a row open closes the one already open" would stop working after the first swipe.
 *
 * Memoizing it therefore requires moving swipe-reference ownership off the render path — resetting the
 * registry only when the food list itself changes, and registering each ref from an effect keyed to that
 * reset. That reaches `@utility/ListSwipeItemManager`, which five screens share (Runs, Workouts, Progress'
 * body tab, Macros and this one), and gesture behaviour cannot be exercised in this environment, where native
 * execution is unavailable. Redesigning a shared gesture lifecycle with no way to observe the result is a
 * worse trade than the allocation it saves, so it is left for a change that can be run on a device.
 *
 * What the row does remove is the allocation the finding named: held here, the four closures are rebuilt only
 * when this row's food, position or handlers change, instead of four fresh functions per visible row on every
 * render — which is what the list did before this component existed.
 */
const LibraryFoodRow = ({food, index, swipeItemManager, onPress, onDelete}: Props): React.JSX.Element => {
  const setSwipeableRef = useCallback(
    (ref: Swipeable) => swipeItemManager.setRef(ref, food, index),
    [swipeItemManager, food, index]
  )

  const onSwipeActivated = useCallback(() => swipeItemManager.closeRow(food, index), [swipeItemManager, food, index])

  const onDeletePressed = useCallback(() => onDelete(food), [onDelete, food])

  const onRowPressed = useCallback(() => onPress(food), [onPress, food])

  return (
    <SwipeDeleteListItem
      deleteIconRightMargin={Spacing.MEDIUM}
      swipeableRef={setSwipeableRef}
      onSwipeActivated={onSwipeActivated}
      onDeletePressed={onDeletePressed}>
      <FoodListRow
        name={food.name}
        detail={formatServingText(food)}
        subtitle={formatMacroSummary(food.protein, food.carbs, food.fat)}
        calories={food.calories}
        onPress={onRowPressed}
      />
    </SwipeDeleteListItem>
  )
}

export default LibraryFoodRow

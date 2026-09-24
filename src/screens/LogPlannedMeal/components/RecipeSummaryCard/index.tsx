import React from 'react'

import {View} from 'react-native'

import {RecipeIconKey} from '@data/models/Recipe'

import MealIconTile from '@components/MealIconTile'
import Text from '@components/Text'

import {LOG_PLANNED_MEAL_RECIPE_OVERLINE} from '@constants/strings'

import styles from './index.styled'

interface Props {
  name: string
  iconKey: RecipeIconKey
}

const RecipeSummaryCard = ({name, iconKey}: Props): React.JSX.Element => {
  return (
    <View style={styles.card}>
      {/* This glyph carries the optical 1.35 px mark, not the md tile's 1.2 px card weight: the plan
          assigns node 38:38 the heavier stroke it shares with the schedule rows on frame 07. The tile
          translates that target for whichever glyph the recipe names, since the stroke is expressed in
          each glyph's own viewBox units. The Figma export of 38:38 currently reads 1.2 px — recorded as
          a divergence for design review rather than followed, the plan being the frozen contract. */}
      <MealIconTile iconKey={iconKey} size="md" glyphStroke="optical" />

      <View style={styles.textColumn}>
        <Text style={styles.overline}>{LOG_PLANNED_MEAL_RECIPE_OVERLINE}</Text>

        <Text style={styles.name}>{name}</Text>
      </View>
    </View>
  )
}

export default RecipeSummaryCard

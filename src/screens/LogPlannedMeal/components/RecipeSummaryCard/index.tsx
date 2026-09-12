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
      <MealIconTile iconKey={iconKey} size="md" />

      <View style={styles.textColumn}>
        <Text style={styles.overline}>{LOG_PLANNED_MEAL_RECIPE_OVERLINE}</Text>

        <Text style={styles.name}>{name}</Text>
      </View>
    </View>
  )
}

export default RecipeSummaryCard

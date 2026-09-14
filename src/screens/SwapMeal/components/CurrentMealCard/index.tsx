import React from 'react'

import {View} from 'react-native'

import {RecipeIconKey} from '@data/models/Recipe'

import MealIconTile from '@components/MealIconTile'
import SectionOverline from '@components/SectionOverline'
import Text from '@components/Text'

import styles from './index.styled'
import {CurrentMealCardVariant} from '../../index.util'

interface Props {
  name: string
  iconKey: RecipeIconKey
  // Composed by the screen's `buildMealMetaText`, which `AlternativeRow` shares, so the two rows can never
  // format a figure the user compares across them two ways.
  meta: string
  variant: CurrentMealCardVariant
  eyebrow?: string
}

const CurrentMealCard = ({name, iconKey, meta, variant, eyebrow}: Props): React.JSX.Element => {
  const isStillYours = variant === 'stillYours'

  return (
    <View style={[styles.card, isStillYours && styles.cardStillYours]}>
      {!!eyebrow && <SectionOverline text={eyebrow} tone={isStillYours ? 'green' : 'muted'} />}

      <View style={styles.contentRow}>
        <MealIconTile iconKey={iconKey} size="md" />

        <View style={styles.textColumn}>
          <Text style={styles.name}>{name}</Text>

          <Text style={styles.meta}>{meta}</Text>
        </View>
      </View>
    </View>
  )
}

export default CurrentMealCard

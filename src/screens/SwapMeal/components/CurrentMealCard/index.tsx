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
  // Required, because every state that draws this card names the meal it is showing: the screen passes
  // `currentMealEyebrow(variant, slot)`, which answers for all three variants, so there is no eyebrow-less
  // card to represent.
  eyebrow: string
}

// `default` and `unchanged` are one visual state — the only difference the design draws between them is the
// eyebrow copy, which arrives as a prop. The green stroke and the green eyebrow belong to `stillYours` alone:
// they state that the meal was left untouched, which only a confirmed `swap_failed` establishes, so an
// unconfirmed outcome takes `default` and claims nothing about a swap that may have committed.
const CurrentMealCard = ({name, iconKey, meta, variant, eyebrow}: Props): React.JSX.Element => {
  const isStillYours = variant === 'stillYours'

  return (
    <View style={[styles.card, isStillYours && styles.cardStillYours]}>
      <SectionOverline text={eyebrow} tone={isStillYours ? 'green' : 'muted'} />

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

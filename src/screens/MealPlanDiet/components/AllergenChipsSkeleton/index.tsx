import React from 'react'

import {View} from 'react-native'

import BorderRadius from '@styles/borderRadius'

import ChipCloud from '@components/ChipCloud'
import SkeletonBlock from '@components/Skeleton'

import styles, {CHIP_PILL_HEIGHT} from './index.styled'
import {chipPlaceholders} from './index.util'

interface Props {
  readonly count: number
}

/**
 * The read state of the allergy cloud: the shape of the answer without the answer.
 *
 * The chips themselves are fixed copy, so the cloud could be drawn before the saved preferences arrive — but
 * which of them is chosen is the answer, and a cloud of unselected chips both states something the response
 * then contradicts (AAP 0.2.5) and offers a tap that lands on an empty draft. Figma note `47:230` is what
 * makes that more than a cosmetic problem: allergies are never removed automatically, and a tap made against
 * an answer nobody has seen yet is exactly how one would be.
 *
 * It renders through the same ChipCloud as the loaded state, so the wrap, the gaps and the cross-axis
 * centring are the cloud's own rather than a copy of them.
 */
const AllergenChipsSkeleton = ({count}: Props): React.JSX.Element => (
  <ChipCloud>
    {chipPlaceholders(count).map(placeholder => (
      <View key={placeholder.key} style={styles.pillHost}>
        <SkeletonBlock height={CHIP_PILL_HEIGHT} width={placeholder.width} borderRadius={BorderRadius.PILL} />
      </View>
    ))}
  </ChipCloud>
)

export default AllergenChipsSkeleton

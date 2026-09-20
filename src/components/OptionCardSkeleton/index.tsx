import React from 'react'

import {View} from 'react-native'

import BorderRadius from '@styles/borderRadius'

import SkeletonBlock from '@components/Skeleton'

import styles, {INDICATOR_SIZE, LABEL_BAR_HEIGHT, LABEL_BAR_WIDTH, SUBCOPY_BAR_HEIGHT} from './index.styled'
import {OptionCardSkeletonSubcopyLines, subcopyLineDescriptors} from './index.util'

// A caller declaring the shape of each card it is standing in for needs the name of that shape, and a screen
// may not reach into a component's own util (Rule mobile-component-structure), so the type is part of this
// component's public surface.
export type {OptionCardSkeletonSubcopyLines} from './index.util'

interface Props {
  readonly subcopyLines?: OptionCardSkeletonSubcopyLines
}

/**
 * The read state of one option card: the card's shape with the answer still missing from it.
 *
 * A setup step cannot show its cards before the saved answer arrives — an unselected card is a claim the
 * response then contradicts (AAP 0.2.5) — and it cannot show a block that merely occupies the place either,
 * because a block shorter than the card moves everything below it when the answer lands. So this reproduces
 * the card: the same box model from the same tokens, a disc where the indicator goes, and a line box for
 * every text line, which makes its height the card's height rather than a number copied from one.
 *
 * It renders no accessibility markup of its own. The group that mounts it is the element a screen reader
 * reaches, and it names the state once — four placeholders each announcing themselves would say nothing the
 * group has not already said, four times.
 */
const OptionCardSkeleton = ({subcopyLines = 0}: Props): React.JSX.Element => (
  <View style={styles.card}>
    <SkeletonBlock height={INDICATOR_SIZE} width={INDICATOR_SIZE} borderRadius={BorderRadius.PILL} />

    <View style={styles.textColumn}>
      <View style={styles.labelLine}>
        <SkeletonBlock height={LABEL_BAR_HEIGHT} width={LABEL_BAR_WIDTH} borderRadius={BorderRadius.CHECKBOX} />
      </View>

      {subcopyLineDescriptors(subcopyLines).map(line => (
        <View key={line.key} style={styles.subcopyLine}>
          <SkeletonBlock
            height={SUBCOPY_BAR_HEIGHT}
            width={line.width}
            borderRadius={BorderRadius.CHECKBOX}
            style={line.isStretched ? styles.barStretch : undefined}
          />
        </View>
      ))}
    </View>
  </View>
)

export default OptionCardSkeleton

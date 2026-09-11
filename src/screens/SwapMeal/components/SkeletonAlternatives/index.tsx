import React, {useState} from 'react'

import {LayoutChangeEvent, View} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'

import Skeleton from '@components/Skeleton'

import styles from './index.styled'
import {SKELETON_ALTERNATIVE_ROWS, skeletonBarWidth} from '../../index.util'

const SkeletonAlternatives = () => {
  const [textColumnWidth, setTextColumnWidth] = useState(0)

  // Skeleton takes a numeric width and reads it once at mount to size its shimmer, so the bars are measured
  // against the filled column instead of being given a proportional width
  const onTextColumnLayout = (event: LayoutChangeEvent) => setTextColumnWidth(event.nativeEvent.layout.width)

  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {SKELETON_ALTERNATIVE_ROWS.map((row, index) => (
        <View key={index} style={styles.row}>
          <Skeleton
            height={Sizes.TILE_SM}
            width={Sizes.TILE_SM}
            borderRadius={BorderRadius.TILE}
            style={styles.skeletonBlock}
          />

          <View style={styles.textColumn} onLayout={onTextColumnLayout}>
            {textColumnWidth > 0 && (
              <>
                <Skeleton
                  height={Sizes.SKELETON_BAR}
                  width={skeletonBarWidth(textColumnWidth, row.primary)}
                  borderRadius={BorderRadius.CHECKBOX}
                  style={styles.skeletonBar}
                />

                <Skeleton
                  height={Sizes.SKELETON_BAR_SM}
                  width={skeletonBarWidth(textColumnWidth, row.secondary)}
                  borderRadius={BorderRadius.CHECKBOX}
                  style={styles.skeletonBar}
                />
              </>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}

export default SkeletonAlternatives

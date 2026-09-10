import React, {useState} from 'react'

import {LayoutChangeEvent, TouchableOpacity, View} from 'react-native'

import Animated, {SharedValue, useAnimatedStyle} from 'react-native-reanimated'

import Text from '@components/Text'

import styles, {indicatorWidth, TRACK_PADDING} from './index.styled'
import {segmentWidthFor} from './index.util'

export interface SegmentedControlOption<T extends string> {
  key: T
  label: string
}

export type SegmentedControlVariant = 'large' | 'small' | 'unit'

interface Props<T extends string> {
  options: SegmentedControlOption<T>[]
  selected: T
  onChange: (key: T) => void
  // Live page position (0..options.length-1) from a swipeable pager; when
  // provided, the highlight pill tracks the swipe instead of snapping between
  // segments
  scrollProgress?: SharedValue<number>
}

const SegmentedControl = <T extends string>({options, selected, onChange, scrollProgress}: Props<T>) => {
  const [trackWidth, setTrackWidth] = useState(0)

  const segmentWidth = segmentWidthFor(trackWidth, options.length, TRACK_PADDING)

  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)

  // Clamped so overscroll bounce can't drag the pill outside the track
  const indicatorStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(scrollProgress?.value ?? 0, 0), options.length - 1)

    return {
      transform: [{translateX: progress * segmentWidth}]
    }
  })

  return (
    <View style={styles.track} onLayout={onLayout}>
      {scrollProgress && segmentWidth > 0 && (
        <Animated.View style={[styles.indicator, indicatorWidth(segmentWidth), indicatorStyle]} />
      )}

      {options.map(option => {
        const isSelected = option.key === selected

        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.segment, !scrollProgress && isSelected && styles.segmentSelected]}
            activeOpacity={0.7}
            onPress={() => onChange(option.key)}>
            <Text style={[styles.label, isSelected && styles.labelSelected]}>{option.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default SegmentedControl

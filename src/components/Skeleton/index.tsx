import React, {useEffect} from 'react'

import {View, StyleSheet, ViewStyle} from 'react-native'

import LinearGradient from 'react-native-linear-gradient'
import Animated, {useSharedValue, useAnimatedStyle, withTiming, withRepeat} from 'react-native-reanimated'

import styles from './index.styled'

type Props = {
  height: number
  width: number
  borderRadius?: number
  style?: ViewStyle
}

const Skeleton = ({height = 20, width = 50, borderRadius = 8, style = {}}: Props) => {
  const shimmerTranslateX = useSharedValue(-width)

  useEffect(() => {
    shimmerTranslateX.value = withRepeat(withTiming(width, {duration: 750}), -1, false)
  }, [])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{translateX: shimmerTranslateX.value}]
  })) as any

  return (
    <View
      style={[
        styles.container,
        {
          height,
          width,
          borderRadius
        },
        style
      ]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
          start={{
            x: 0,
            y: 0.5
          }}
          end={{
            x: 1,
            y: 0.5
          }}
          style={[styles.gradient]}
        />
      </Animated.View>
    </View>
  )
}

export default Skeleton

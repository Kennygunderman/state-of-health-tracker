import React, {useEffect} from 'react'

import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import Animated, {Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming} from 'react-native-reanimated'

import SpinnerArcIcon from '@components/icons/SpinnerArcIcon'

import {MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL} from '@constants/strings'

import styles from './index.styled'

const ROTATION_DURATION_MS = 900
const FULL_TURN_DEGREES = 360

interface Props {
  size?: 'lg' | 'sm'
}

const IndeterminateSpinner = ({size = 'lg'}: Props) => {
  const rotation = useSharedValue(0)

  const isSmall = size === 'sm'
  const diameter = isSmall ? Sizes.SPINNER : Sizes.SPINNER_LG

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(FULL_TURN_DEGREES, {duration: ROTATION_DURATION_MS, easing: Easing.linear}),
      -1,
      false
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable references
  }, [])

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value}deg`}]
  }))

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}
      style={[styles.container, isSmall ? styles.boxSmall : styles.boxLarge, rotationStyle]}>
      <SpinnerArcIcon variant={size} size={diameter} color={Theme.colors.accentGreen} />
    </Animated.View>
  )
}

export default IndeterminateSpinner

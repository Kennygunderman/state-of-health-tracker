import React, {useEffect, useState} from 'react'

import {Keyboard, Platform, StyleProp, View, ViewStyle} from 'react-native'

import {useSafeAreaInsets} from 'react-native-safe-area-context'

import styles, {footerBottomInset, footerKeyboardLift} from './index.styled'

interface StackedProps {
  readonly children: React.ReactNode
  readonly hairline?: boolean
  readonly variant?: 'stacked'
}

interface SplitProps {
  readonly hairline?: boolean
  readonly primaryAction: React.ReactNode
  readonly secondaryAction: React.ReactNode
  readonly variant: 'split'
}

type Props = StackedProps | SplitProps

const SetupFooter = (props: Props): React.JSX.Element => {
  const {hairline = false} = props
  const insets = useSafeAreaInsets()
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  // Every call site renders this footer as a sibling of its keyboard-aware region, so on iOS — where the
  // keyboard is drawn over the window instead of resizing it — the actions sit under the number pad unless
  // the footer lifts itself. Android is deliberately excluded: with no `softwareKeyboardLayoutMode` set,
  // Expo's default `resize` has already shrunk the window, and lifting again would double-count it and
  // strand the footer mid-screen. The `will*` events are iOS-only and fire with the system animation, so
  // the band travels in step with the keyboard rather than jumping after it settles.
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return undefined
    }

    // A footer mounted while the keyboard is already open receives no `will` event for it, so the current
    // metrics seed the height; they are undefined whenever the keyboard is down.
    setKeyboardHeight(Keyboard.metrics()?.height ?? 0)

    const showSubscription = Keyboard.addListener('keyboardWillShow', event =>
      setKeyboardHeight(event.endCoordinates.height)
    )
    const hideSubscription = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0))

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  // The keyboard covers the home-indicator inset the band already pads for, so that inset is subtracted
  // rather than added: the band lands flush on the keyboard instead of floating a home-indicator's height
  // above it. Derived at render so a rotation that changes the inset re-lifts without re-subscribing.
  const keyboardLift = Math.max(0, keyboardHeight - insets.bottom)

  const shell: StyleProp<ViewStyle> = [
    styles.footer,
    hairline && styles.footerHairline,
    footerBottomInset(insets.bottom),
    footerKeyboardLift(keyboardLift)
  ]

  if (props.variant === 'split') {
    return (
      <View style={shell}>
        <View style={[styles.actionCap, styles.splitRow]}>
          <View style={styles.splitPrimary}>{props.primaryAction}</View>

          <View style={styles.splitSecondary}>{props.secondaryAction}</View>
        </View>
      </View>
    )
  }

  return (
    <View style={shell}>
      <View style={[styles.actionCap, styles.actionColumn]}>{props.children}</View>
    </View>
  )
}

export default SetupFooter

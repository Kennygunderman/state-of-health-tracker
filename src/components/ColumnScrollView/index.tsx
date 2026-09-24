import React, {useCallback, useEffect, useRef} from 'react'

import {Keyboard, ScrollView, ScrollViewProps, StyleSheet, TextInput} from 'react-native'

import Spacing from '@styles/spacing'

// ContentColumn supplies the gutters. Let the viewport reach the screen edges,
// then restore those gutters on the content so the scroll indicator stays outside it.
export const columnScrollStyles = StyleSheet.create({
  viewport: {marginHorizontal: -Spacing.GUTTER},
  content: {paddingHorizontal: Spacing.GUTTER}
})

const ColumnScrollView = ({style, contentContainerStyle, onScroll, onLayout, onFocus, ...props}: ScrollViewProps) => {
  const scrollRef = useRef<ScrollView>(null)
  const offset = useRef(0)
  const frame = useRef<number | null>(null)

  const revealFocusedInput = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput()

      if (!input || !Keyboard.isVisible()) return
      // Measure the actual viewport after SetupFooter has lifted. Adding a second
      // keyboard inset here would create a keyboard-sized blank area in the form.
      scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
          const keyboardTop = Keyboard.metrics()?.screenY ?? Number.POSITIVE_INFINITY
          const visibleBottom = Math.min(top + height, keyboardTop) - Spacing.SMALL
          const visibleTop = top + Spacing.SMALL
          const delta =
            inputTop < visibleTop ? inputTop - visibleTop : Math.max(0, inputTop + inputHeight - visibleBottom)

          if (delta !== 0) scrollRef.current?.scrollTo({y: Math.max(0, offset.current + delta), animated: false})
        })
      })
    })
  }, [])

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', revealFocusedInput)

    return () => {
      subscription.remove()
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [revealFocusedInput])

  return (
    <ScrollView
      {...props}
      ref={scrollRef}
      style={[columnScrollStyles.viewport, style]}
      contentContainerStyle={[columnScrollStyles.content, contentContainerStyle]}
      automaticallyAdjustKeyboardInsets={false}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      scrollEventThrottle={16}
      onScroll={event => {
        offset.current = event.nativeEvent.contentOffset.y
        onScroll?.(event)
      }}
      onLayout={event => {
        onLayout?.(event)
        revealFocusedInput()
      }}
      onFocus={event => {
        onFocus?.(event)
        revealFocusedInput()
      }}
    />
  )
}

export default ColumnScrollView

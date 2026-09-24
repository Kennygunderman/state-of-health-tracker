import React, {useEffect, useState, useRef} from 'react'
import {ReactNode} from 'react'

import {Keyboard, View, TouchableWithoutFeedback} from 'react-native'

import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet'
import {Theme} from '@styles/theme'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Subject} from 'rxjs'

import styles, {sheetContentPadding} from './index.styled'

interface BottomSheetEvent {
  action: 'open' | 'close'
  content?: ReactNode
  maxHeight?: number
}

export const BottomSheetSubject$ = new Subject<BottomSheetEvent>()

export const openGlobalBottomSheet = (content: ReactNode, maxHeight?: number) => {
  // An open keyboard (e.g. from a search bar) would overlap the sheet
  Keyboard.dismiss()
  BottomSheetSubject$.next({
    action: 'open',
    content,
    maxHeight
  })
}

export const closeGlobalBottomSheet = () => {
  BottomSheetSubject$.next({action: 'close'})
}

const GlobalBottomSheet = () => {
  const sheetRef = useRef<BottomSheet>(null)
  const insets = useSafeAreaInsets()

  const [content, setContent] = useState<ReactNode>(null)
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const sub = BottomSheetSubject$.subscribe(({action, content, maxHeight}) => {
      if (action === 'open') {
        setMaxHeight(maxHeight)
        setContent(content || null)
        sheetRef.current?.expand()
        setIsOpen(true)
      } else {
        setIsOpen(false)
        setContent(null)
        sheetRef.current?.close()
      }
    })

    return () => sub.unsubscribe()
  }, [])

  return (
    <>
      {isOpen && (
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={closeGlobalBottomSheet}>
            <View style={styles.backdropTouchableArea} />
          </TouchableWithoutFeedback>
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        index={-1}
        enableDynamicSizing
        maxDynamicContentSize={maxHeight}
        accessible={false}
        enablePanDownToClose
        handleIndicatorStyle={{backgroundColor: Theme.colors.white}}
        backgroundStyle={{backgroundColor: Theme.colors.background}}
        style={styles.sheetShadow}
        onClose={closeGlobalBottomSheet}>
        <BottomSheetView style={[styles.sheetContent, sheetContentPadding(insets.bottom)]}>{content}</BottomSheetView>
      </BottomSheet>
    </>
  )
}

export default GlobalBottomSheet

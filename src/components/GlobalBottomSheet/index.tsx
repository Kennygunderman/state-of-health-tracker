import React, {useEffect, useState, useRef} from 'react'
import {ReactNode} from 'react'

import {View, TouchableWithoutFeedback} from 'react-native'

import BottomSheet from '@gorhom/bottom-sheet'
import {useStyleTheme} from '@theme/Theme'
import {Subject} from 'rxjs'

import styles from './index.styled'

interface BottomSheetEvent {
  action: 'open' | 'close'
  content?: ReactNode
  snapPoints?: string[]
}

export const BottomSheetSubject$ = new Subject<BottomSheetEvent>()

export const openGlobalBottomSheet = (content: ReactNode, snapPoints?: string[]) => {
  BottomSheetSubject$.next({
    action: 'open',
    content,
    snapPoints
  })
}

export const closeGlobalBottomSheet = () => {
  BottomSheetSubject$.next({action: 'close'})
}

const GlobalBottomSheet = () => {
  const theme = useStyleTheme()
  const sheetRef = useRef<BottomSheet>(null)

  const [content, setContent] = useState<ReactNode>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [snapPoints, setSnapPoints] = useState(['25%'])

  useEffect(() => {
    const sub = BottomSheetSubject$.subscribe(({action, content, snapPoints: customSnapPoints}) => {
      if (action === 'open') {
        setContent(content || null)
        setSnapPoints(customSnapPoints || ['25%'])
        sheetRef.current?.expand()
        setIsOpen(true)
      } else {
        setIsOpen(false)
        setContent(null)
        setSnapPoints(['25%'])
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
        snapPoints={snapPoints}
        enablePanDownToClose
        handleIndicatorStyle={{backgroundColor: theme.colors.white}}
        backgroundStyle={{backgroundColor: theme.colors.background}}
        style={styles.sheetShadow}
        onClose={closeGlobalBottomSheet}>
        <View style={styles.sheetContent}>{content}</View>
      </BottomSheet>
    </>
  )
}

export default GlobalBottomSheet

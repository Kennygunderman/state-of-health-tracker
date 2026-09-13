import React from 'react'

import {ScrollView, View} from 'react-native'

import styles from './index.styled'

interface Props {
  children: React.ReactNode
  variant?: 'wrap' | 'scroll'
}

const ChipCloud = ({children, variant = 'wrap'}: Props): React.JSX.Element => {
  if (variant === 'scroll') {
    return (
      // The scroll variant is the row that sits under a focused search field (06b keeps its query, note 47:463),
      // so the scroll view has to hand the first tap to the chip rather than spend it dismissing the keyboard.
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.cloud}>
        {children}
      </ScrollView>
    )
  }

  return <View style={[styles.cloud, styles.wrap]}>{children}</View>
}

export default ChipCloud

import React from 'react'

import {ScrollView, View} from 'react-native'

import styles from './index.styled'

interface Props {
  children: React.ReactNode
  variant?: 'wrap' | 'scroll'
}

const ChipCloud = ({children, variant = 'wrap'}: Props) => {
  if (variant === 'scroll') {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cloud}>
        {children}
      </ScrollView>
    )
  }

  return <View style={[styles.cloud, styles.wrap]}>{children}</View>
}

export default ChipCloud

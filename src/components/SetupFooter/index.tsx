import React from 'react'

import {View} from 'react-native'

import {useSafeAreaInsets} from 'react-native-safe-area-context'

import styles, {footerBottomInset} from './index.styled'

interface Props {
  readonly children: React.ReactNode
  readonly hairline?: boolean
  readonly variant?: 'stacked' | 'split'
}

const SetupFooter = (props: Props) => {
  const {children, hairline = false, variant = 'stacked'} = props
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.footer, hairline && styles.footerHairline, footerBottomInset(insets.bottom)]}>
      {variant === 'split' ? <View style={styles.splitRow}>{children}</View> : children}
    </View>
  )
}

export default SetupFooter

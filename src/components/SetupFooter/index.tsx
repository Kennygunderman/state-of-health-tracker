import React from 'react'

import {StyleProp, View, ViewStyle} from 'react-native'

import {useSafeAreaInsets} from 'react-native-safe-area-context'

import styles, {footerBottomInset} from './index.styled'

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
  const shell: StyleProp<ViewStyle> = [
    styles.footer,
    hairline && styles.footerHairline,
    footerBottomInset(insets.bottom)
  ]

  if (props.variant === 'split') {
    return (
      <View style={shell}>
        <View style={styles.splitRow}>
          <View style={styles.splitPrimary}>{props.primaryAction}</View>

          <View style={styles.splitSecondary}>{props.secondaryAction}</View>
        </View>
      </View>
    )
  }

  return <View style={shell}>{props.children}</View>
}

export default SetupFooter

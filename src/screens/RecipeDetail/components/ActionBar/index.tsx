import React from 'react'

import {View} from 'react-native'

import {useSafeAreaInsets} from 'react-native-safe-area-context'

import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'

import styles, {actionBarPadding} from './index.styled'

interface Props {
  onLogMeal: () => void
  onSwap: () => void
  logLabel: string
  swapLabel: string
  isEnabled: boolean
  bottomInset?: number
}

const ActionBar = ({onLogMeal, onSwap, logLabel, swapLabel, isEnabled, bottomInset}: Props): React.JSX.Element => {
  // The host screen may measure the inset itself; without it the bar reads the live one.
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.bar, actionBarPadding(bottomInset ?? insets.bottom)]}>
      <View style={styles.splitRow}>
        <View style={styles.primarySlot}>
          <PrimaryButton label={logLabel} onPress={onLogMeal} disabled={!isEnabled} />
        </View>

        <View style={styles.secondarySlot}>
          <SecondaryButton variant="dark" label={swapLabel} onPress={onSwap} disabled={!isEnabled} />
        </View>
      </View>
    </View>
  )
}

export default ActionBar

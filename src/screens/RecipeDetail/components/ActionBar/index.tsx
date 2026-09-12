import React from 'react'

import {View} from 'react-native'

import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'

import styles, {actionBarPadding} from './index.styled'

interface Props {
  onLogMeal: () => void
  onSwap: () => void
  logLabel: string
  swapLabel: string
  isEnabled: boolean
  bottomInset: number
}

const ActionBar = ({onLogMeal, onSwap, logLabel, swapLabel, isEnabled, bottomInset}: Props) => {
  return (
    <View style={[styles.bar, actionBarPadding(bottomInset)]}>
      <View style={styles.splitRow}>
        <View style={styles.primarySlot}>
          <PrimaryButton label={logLabel} onPress={onLogMeal} disabled={!isEnabled} />
        </View>

        <View
          style={[styles.secondarySlot, !isEnabled && styles.secondarySlotDisabled]}
          pointerEvents={isEnabled ? 'auto' : 'none'}>
          <SecondaryButton variant="dark" label={swapLabel} onPress={onSwap} />
        </View>
      </View>
    </View>
  )
}

export default ActionBar

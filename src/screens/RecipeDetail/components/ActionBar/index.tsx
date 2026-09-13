import React from 'react'

import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import SetupFooter from '@components/SetupFooter'

interface Props {
  onLogMeal: () => void
  onSwap: () => void
  logLabel: string
  swapLabel: string
  isEnabled: boolean
}

const ActionBar = ({onLogMeal, onSwap, logLabel, swapLabel, isEnabled}: Props) => {
  return (
    <SetupFooter
      hairline
      variant="split"
      primaryAction={<PrimaryButton label={logLabel} onPress={onLogMeal} disabled={!isEnabled} />}
      secondaryAction={<SecondaryButton variant="dark" label={swapLabel} onPress={onSwap} disabled={!isEnabled} />}
    />
  )
}

export default ActionBar

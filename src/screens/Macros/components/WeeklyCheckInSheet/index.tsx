import React from 'react'

import {View} from 'react-native'

import {CoachPlan} from '@data/models/CoachState'
import {useAckCheckInMutation} from '@queries/coach/useAckCheckInMutation'

import {closeGlobalBottomSheet} from '@components/GlobalBottomSheet'
import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'

import {
  COACH_CHECKIN_CALORIES_LABEL,
  COACH_CHECKIN_CARBS_LABEL,
  COACH_CHECKIN_CTA,
  COACH_CHECKIN_EXPENDITURE_TEXT,
  COACH_CHECKIN_FAT_LABEL,
  COACH_CHECKIN_HELD_BODY,
  COACH_CHECKIN_HINT,
  COACH_CHECKIN_PROTEIN_LABEL,
  COACH_CHECKIN_TITLE,
  COACH_CHECKIN_UPDATED_BODY,
  stringWithParameters
} from '@constants/strings'

import styles from './index.styled'

interface Props {
  plan: CoachPlan
}

const formatDelta = (current: number, previous: number | null): string => {
  if (previous === null || current === previous) return ''

  const delta = current - previous

  return delta > 0 ? ` (▲ ${delta})` : ` (▼ ${Math.abs(delta)})`
}

const WeeklyCheckInSheet = ({plan}: Props) => {
  const {mutateAsync: ackAsync, isPending} = useAckCheckInMutation()

  const onSoundsGoodPressed = async () => {
    try {
      await ackAsync(plan.id)
    } finally {
      // Dismiss even if the ack request fails — the sheet will simply
      // reappear on the next launch while the plan is still pending
      closeGlobalBottomSheet()
    }
  }

  const targets = [
    {label: COACH_CHECKIN_CALORIES_LABEL, value: plan.calories.toLocaleString('en-US')},
    {label: COACH_CHECKIN_PROTEIN_LABEL, value: `${plan.proteinG}g`},
    {label: COACH_CHECKIN_CARBS_LABEL, value: `${plan.carbsG}g`},
    {label: COACH_CHECKIN_FAT_LABEL, value: `${plan.fatG}g`}
  ]

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{COACH_CHECKIN_TITLE}</Text>

      <Text style={styles.expenditure}>
        {stringWithParameters(COACH_CHECKIN_EXPENDITURE_TEXT, plan.tdeeKcal.toLocaleString('en-US'))}

        {formatDelta(plan.tdeeKcal, plan.previousTdeeKcal)}
      </Text>

      <Text style={styles.body}>{plan.held ? COACH_CHECKIN_HELD_BODY : COACH_CHECKIN_UPDATED_BODY}</Text>

      <View style={styles.targetsRow}>
        {targets.map(target => (
          <View key={target.label} style={styles.targetCell}>
            <Text style={styles.targetValue}>{target.value}</Text>

            <Text style={styles.targetLabel}>{target.label}</Text>
          </View>
        ))}
      </View>

      <PrimaryButton label={COACH_CHECKIN_CTA} isLoading={isPending} onPress={onSoundsGoodPressed} />

      <Text style={styles.hint}>{COACH_CHECKIN_HINT}</Text>
    </View>
  )
}

export default WeeklyCheckInSheet

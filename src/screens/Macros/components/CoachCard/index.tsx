import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {MaterialCommunityIcons} from '@expo/vector-icons'
import {useCoachStateQuery} from '@queries/coach/useCoachStateQuery'
import {Theme} from '@styles/theme'

import Text from '@components/Text'

import {
  COACH_CARD_EXPENDITURE_TEXT,
  COACH_CARD_MANAGE,
  COACH_CARD_PAUSED_TEXT,
  COACH_CARD_PITCH_BODY,
  COACH_CARD_PITCH_CTA,
  COACH_CARD_TARGET_TEXT,
  COACH_CARD_TITLE,
  stringWithParameters
} from '@constants/strings'

import styles from './index.styled'

const ICON_SIZE = 28
const CHEVRON_SIZE = 22

interface Props {
  onSetUpPressed: () => void
  onManagePressed: () => void
}

const CoachCard = ({onSetUpPressed, onManagePressed}: Props) => {
  const {data: coachState} = useCoachStateQuery()

  const isEnrolled = coachState?.mode === 'coached' || coachState?.mode === 'paused'

  if (!isEnrolled) {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onSetUpPressed}>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name="compass-outline" size={ICON_SIZE} color={Theme.colors.background} />
        </View>

        <View style={styles.textWrapper}>
          <Text style={styles.title}>{COACH_CARD_PITCH_CTA}</Text>

          <Text style={styles.body}>{COACH_CARD_PITCH_BODY}</Text>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={CHEVRON_SIZE} color={Theme.colors.textMuted} />
      </TouchableOpacity>
    )
  }

  const statusText =
    coachState.mode === 'paused'
      ? COACH_CARD_PAUSED_TEXT
      : coachState.activePlan
        ? stringWithParameters(COACH_CARD_TARGET_TEXT, coachState.activePlan.calories.toLocaleString('en-US'))
        : ''
  const expenditureText =
    coachState.tdeeKcal !== null
      ? stringWithParameters(COACH_CARD_EXPENDITURE_TEXT, coachState.tdeeKcal.toLocaleString('en-US'))
      : ''

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onManagePressed}>
      <View style={styles.iconBadge}>
        <MaterialCommunityIcons name="compass-outline" size={ICON_SIZE} color={Theme.colors.background} />
      </View>

      <View style={styles.textWrapper}>
        <Text style={styles.title}>{COACH_CARD_TITLE}</Text>

        {statusText.length > 0 && <Text style={styles.body}>{statusText}</Text>}

        {expenditureText.length > 0 && <Text style={styles.subBody}>{expenditureText}</Text>}
      </View>

      <Text style={styles.manageText}>{COACH_CARD_MANAGE}</Text>
    </TouchableOpacity>
  )
}

export default CoachCard

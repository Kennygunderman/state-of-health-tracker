import React from 'react'

import {View} from 'react-native'

import {Theme} from '@styles/theme'

import EmptyState from '@components/EmptyState'
import EmptyCalendarIcon from '@components/icons/EmptyCalendarIcon'

import styles from './index.styled'

interface Props {
  headline: string
  body: string
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel: string
  onSecondary: () => void
}

const EmptyPlanState = ({headline, body, primaryLabel, onPrimary, secondaryLabel, onSecondary}: Props) => (
  <View style={styles.container}>
    <EmptyState
      icon={<EmptyCalendarIcon color={Theme.colors.accentGreen} />}
      headline={headline}
      body={body}
      primaryLabel={primaryLabel}
      onPrimary={onPrimary}
      secondaryLabel={secondaryLabel}
      onSecondary={onSecondary}
    />
  </View>
)

export default EmptyPlanState

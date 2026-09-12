import React from 'react'

import {View} from 'react-native'

import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'

import styles from './index.styled'

export type EmptyStateVariant = 'tile' | 'badge'

export type EmptyStateBottomInset = 'sm' | 'lg'

interface Props {
  icon: React.JSX.Element
  headline: string
  body: string
  variant?: EmptyStateVariant
  bottomInset?: EmptyStateBottomInset
  primaryLabel?: string
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

const EmptyState = ({
  icon,
  headline,
  body,
  variant = 'tile',
  bottomInset = 'sm',
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary
}: Props): React.JSX.Element => {
  const isBadge = variant === 'badge'
  const hasPrimaryAction = primaryLabel !== undefined && onPrimary !== undefined

  return (
    <View style={[styles.container, bottomInset === 'lg' && styles.containerInsetLg]}>
      <View style={[styles.glyph, isBadge ? styles.badge : styles.tile]}>{icon}</View>

      <Text style={[styles.headline, isBadge ? styles.headlineCompact : styles.headlineLarge]}>{headline}</Text>

      <Text style={styles.body}>{body}</Text>

      {primaryLabel !== undefined && onPrimary !== undefined && (
        <View style={styles.action}>
          {isBadge ? (
            <SecondaryButton variant="dark" label={primaryLabel} onPress={onPrimary} />
          ) : (
            <PrimaryButton label={primaryLabel} onPress={onPrimary} />
          )}
        </View>
      )}

      {secondaryLabel !== undefined && onSecondary !== undefined && (
        <View style={hasPrimaryAction ? styles.actionStacked : styles.action}>
          <TertiaryTextButton label={secondaryLabel} onPress={onSecondary} />
        </View>
      )}
    </View>
  )
}

export default EmptyState

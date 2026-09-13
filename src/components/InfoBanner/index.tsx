import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import FontSize from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import AlertCircleIcon from '@components/icons/AlertCircleIcon'
import BannerCheckIcon from '@components/icons/BannerCheckIcon'
import CheckIcon from '@components/icons/CheckIcon'
import InfoCircleIcon from '@components/icons/InfoCircleIcon'
import WarningTriangleIcon from '@components/icons/WarningTriangleIcon'
import Text from '@components/Text'

import styles from './index.styled'

const LINK_ACTION_HIT_SLOP_V = Math.ceil((Sizes.TOUCH_TARGET - FontSize.LABEL) / 2)

interface Props {
  tone?: 'neutral' | 'success' | 'error'
  glyph?: 'info' | 'tick' | 'disc' | 'warning' | 'alert'
  title?: string
  body: string
  actionLabel?: string
  onAction?: () => void
  isActionPending?: boolean
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  isSecondaryActionPending?: boolean
}

const InfoBanner = ({
  tone = 'neutral',
  glyph,
  title,
  body,
  actionLabel,
  onAction,
  isActionPending = false,
  secondaryActionLabel,
  onSecondaryAction,
  isSecondaryActionPending = false
}: Props): React.JSX.Element => {
  const resolvedGlyph = glyph ?? (tone === 'error' ? 'alert' : 'info')
  const isError = tone === 'error'
  const isCentered = resolvedGlyph === 'tick' || resolvedGlyph === 'disc'
  const hasPrimaryAction = actionLabel !== undefined && onAction !== undefined
  const hasSecondaryAction = secondaryActionLabel !== undefined && onSecondaryAction !== undefined
  const infoColor = tone === 'neutral' ? Theme.colors.textSecondary : Theme.colors.greenOnTint
  const glyphElement =
    resolvedGlyph === 'disc' ? (
      <View style={styles.checkDisc}>
        <CheckIcon color={Theme.colors.white} size={Sizes.ICON_XS} />
      </View>
    ) : resolvedGlyph === 'tick' ? (
      <BannerCheckIcon color={Theme.colors.greenOnTint} size={Sizes.ICON_SM} />
    ) : resolvedGlyph === 'warning' ? (
      <WarningTriangleIcon color={Theme.colors.danger} size={Sizes.ICON} />
    ) : resolvedGlyph === 'alert' ? (
      <AlertCircleIcon variant="lg" color={Theme.colors.danger} size={Sizes.ICON_MD} />
    ) : (
      <InfoCircleIcon color={infoColor} size={Sizes.ICON} />
    )
  const toneStyle = isError
    ? styles.containerError
    : tone === 'success'
      ? styles.containerSuccess
      : styles.containerNeutral
  const bodyStyle = isError
    ? styles.errorBody
    : resolvedGlyph === 'disc'
      ? styles.discBody
      : resolvedGlyph === 'tick'
        ? styles.tickBody
        : tone === 'success'
          ? styles.successBody
          : styles.neutralBody
  const bodyElement = <Text style={bodyStyle}>{body}</Text>
  const handleAction = () => {
    if (!isActionPending) {
      onAction?.()
    }
  }
  const handleSecondaryAction = () => {
    if (!isSecondaryActionPending) {
      onSecondaryAction?.()
    }
  }

  return (
    <View
      style={[
        styles.container,
        toneStyle,
        isCentered ? styles.containerCentered : styles.containerTopAligned,
        resolvedGlyph === 'disc' && styles.containerDisc
      ]}>
      <View style={[styles.iconWrapper, isCentered && styles.iconWrapperCentered]}>{glyphElement}</View>

      <View style={[styles.textWrapper, (isCentered || isError) && styles.textWrapperFlush]}>
        {isError && title !== undefined && <Text style={styles.errorTitle}>{title}</Text>}

        {isError ? <View style={styles.errorBodyWrapper}>{bodyElement}</View> : bodyElement}

        {isError && (hasPrimaryAction || hasSecondaryAction) && (
          <View style={styles.actionRow}>
            {hasPrimaryAction && (
              <TouchableOpacity
                style={[styles.primaryAction, isActionPending && styles.actionPending]}
                activeOpacity={Opacity.PRESSED}
                hitSlop={{top: Spacing.TIGHT, bottom: Spacing.TIGHT}}
                disabled={isActionPending}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                accessibilityState={{disabled: isActionPending, busy: isActionPending}}
                onPress={handleAction}>
                <Text style={styles.primaryActionLabel}>{actionLabel}</Text>
              </TouchableOpacity>
            )}

            {hasSecondaryAction && (
              <TouchableOpacity
                style={[styles.secondaryAction, isSecondaryActionPending && styles.actionPending]}
                activeOpacity={Opacity.PRESSED}
                hitSlop={{top: Spacing.TIGHT, bottom: Spacing.TIGHT}}
                disabled={isSecondaryActionPending}
                accessibilityRole="button"
                accessibilityLabel={secondaryActionLabel}
                accessibilityState={{disabled: isSecondaryActionPending, busy: isSecondaryActionPending}}
                onPress={handleSecondaryAction}>
                <Text style={styles.secondaryActionLabel}>{secondaryActionLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {!isError && hasPrimaryAction && (
        <TouchableOpacity
          activeOpacity={Opacity.PRESSED}
          hitSlop={{
            top: LINK_ACTION_HIT_SLOP_V,
            bottom: LINK_ACTION_HIT_SLOP_V,
            left: Spacing.X_SMALL,
            right: Spacing.X_SMALL
          }}
          disabled={isActionPending}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityState={{disabled: isActionPending, busy: isActionPending}}
          onPress={handleAction}>
          <Text style={[styles.linkAction, isActionPending && styles.actionPending]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default InfoBanner

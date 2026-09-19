import React, {useEffect, useRef} from 'react'

import {AccessibilityInfo, Platform, TouchableOpacity, View} from 'react-native'

import FontSize from '@styles/fontSize'
import {Opacity, Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import Svg, {Circle, Path} from 'react-native-svg'

import AlertCircleIcon from '@components/icons/AlertCircleIcon'
import BannerCheckIcon from '@components/icons/BannerCheckIcon'
import InfoCircleIcon from '@components/icons/InfoCircleIcon'
import WarningTriangleIcon from '@components/icons/WarningTriangleIcon'
import Text from '@components/Text'

import styles from './index.styled'
import {
  BannerGlyph,
  composeStatusMessage,
  resolveDefaultStatusRole,
  resolveStatusSemantics,
  StatusRole
} from './index.util'

const LINK_ACTION_HIT_SLOP_V = Math.ceil((Sizes.TOUCH_TARGET - FontSize.LABEL) / 2)

// The success banner's glyph is a construction rather than an exported asset, so it is drawn here instead of
// under `components/icons`. Figma authors the tick `49:283` as an 8x5 frame with a 2 px bottom and left border
// rotated -45 degrees — the CSS border-checkmark idiom — which leaves no path to transcribe; this is the
// equivalent stroked centreline inside the disc `49:282`'s own 20-unit box. It is deliberately not `CheckIcon`:
// the arms measure 4 and 7 (1:1.75) under a butt cap and a miter join against that glyph's 1:2.2 under round
// ones, and no scale reconciles them — matching the long arm leaves the stroke 55% too thin, matching the
// stroke makes the glyph 2.22x too large. `BannerCheckIcon` (`37:45`, 1:2.5) is no closer.
const DISC_TICK_PATH = 'M6.1109 9.3534L8.9394 12.1819L13.8891 7.2322'

const DISC_VIEW_BOX = '0 0 20 20'

interface Props {
  tone?: 'neutral' | 'success' | 'error'
  glyph?: BannerGlyph
  title?: string
  body: string
  statusRole?: StatusRole
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
  statusRole,
  actionLabel,
  onAction,
  isActionPending = false,
  secondaryActionLabel,
  onSecondaryAction,
  isSecondaryActionPending = false
}: Props): React.JSX.Element => {
  const resolvedGlyph = glyph ?? (tone === 'error' ? 'alert' : 'info')
  const isError = tone === 'error'
  const drawnTitle = isError ? title : undefined
  const isCentered = resolvedGlyph === 'tick' || resolvedGlyph === 'disc'
  const hasPrimaryAction = actionLabel !== undefined && onAction !== undefined
  const hasSecondaryAction = secondaryActionLabel !== undefined && onSecondaryAction !== undefined
  const hasErrorActionRow = isError && (hasPrimaryAction || hasSecondaryAction)
  const infoColor = tone === 'neutral' ? Theme.colors.textSecondary : Theme.colors.greenOnTint
  const glyphElement =
    resolvedGlyph === 'disc' ? (
      /* BLITZY [A11Y]: the disc implements Figma `49:282` exactly and carries `49:283`'s white tick at 2.45:1,
         below the 3:1 non-text minimum for a required glyph. Matched and flagged rather than adjusted:
         Figma specifies the pair, and the project directive's accessibility rule requires exactly that for
         a Figma-specified pair. The remedy is a darker disc or a near-black glyph (`background` on
         `accentGreen` measures 7.67:1). See the accessible-colour register in `@styles/theme`. */
      <Svg width={Sizes.ICON_MD} height={Sizes.ICON_MD} viewBox={DISC_VIEW_BOX} fill="none">
        <Circle cx={10} cy={10} r={10} fill={Theme.colors.accentGreen} />

        <Path
          d={DISC_TICK_PATH}
          stroke={Theme.colors.white}
          strokeWidth={Stroke.BOLD}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      </Svg>
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
  const textBlock = (
    <>
      {drawnTitle !== undefined && <Text style={styles.errorTitle}>{drawnTitle}</Text>}

      {isError ? <View style={styles.errorBodyWrapper}>{bodyElement}</View> : bodyElement}
    </>
  )
  // A glyph the plan draws only for news carries its own status semantics, so the announcement does not depend
  // on the call site asking for it; an explicitly passed `statusRole` still decides.
  const statusSemantics = resolveStatusSemantics(statusRole ?? resolveDefaultStatusRole(resolvedGlyph))
  const statusMessage = composeStatusMessage({title: drawnTitle, body})
  const announcedStatus = statusSemantics === null ? null : statusMessage
  const lastAnnouncedStatus = useRef<string | null>(null)

  useEffect(() => {
    // `accessibilityLiveRegion` on the group below is Android-only in RN 0.86, so the appearing status is
    // announced here for VoiceOver and only there — Android is left to its live region rather than told
    // twice. Guarded by the message announced, so a re-render carrying the same status does not repeat it.
    if (announcedStatus === null || announcedStatus === lastAnnouncedStatus.current) {
      return
    }

    lastAnnouncedStatus.current = announcedStatus

    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(announcedStatus)
    }
  }, [announcedStatus])

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
        resolvedGlyph === 'disc' && styles.containerDisc,
        hasErrorActionRow && styles.containerActionRow
      ]}>
      <View style={[styles.iconWrapper, isCentered && styles.iconWrapperCentered]}>{glyphElement}</View>

      <View style={[styles.textWrapper, (isCentered || isError) && styles.textWrapperFlush]}>
        {statusSemantics === null ? (
          textBlock
        ) : (
          // The role is declared through the ARIA `role` prop rather than `accessibilityRole`: RN 0.86's
          // `accessibilityRole` has no 'status' — Android throws `Invalid accessibility role value` on one it
          // does not know — while `role` accepts both and is mapped to the native role on each platform.
          <View
            accessible
            accessibilityLabel={statusMessage}
            role={statusSemantics.role}
            accessibilityLiveRegion={statusSemantics.liveRegion}>
            {textBlock}
          </View>
        )}

        {hasErrorActionRow && (
          <View style={styles.actionRow}>
            {hasPrimaryAction && (
              // The pressable is the touch-target envelope and the pill inside it is only paint: `hitSlop`
              // cannot reach past this row, so a slopped pill on its edge was clipped to 38 pt.
              <TouchableOpacity
                style={styles.actionEnvelope}
                activeOpacity={Opacity.PRESSED}
                disabled={isActionPending}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                accessibilityState={{disabled: isActionPending, busy: isActionPending}}
                onPress={handleAction}>
                <View style={[styles.primaryAction, isActionPending && styles.actionPending]}>
                  <Text style={styles.primaryActionLabel}>{actionLabel}</Text>
                </View>
              </TouchableOpacity>
            )}

            {hasSecondaryAction && (
              <TouchableOpacity
                style={styles.actionEnvelope}
                activeOpacity={Opacity.PRESSED}
                disabled={isSecondaryActionPending}
                accessibilityRole="button"
                accessibilityLabel={secondaryActionLabel}
                accessibilityState={{disabled: isSecondaryActionPending, busy: isSecondaryActionPending}}
                onPress={handleSecondaryAction}>
                <View style={[styles.secondaryAction, isSecondaryActionPending && styles.actionPending]}>
                  <Text style={styles.secondaryActionLabel}>{secondaryActionLabel}</Text>
                </View>
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

import React from 'react'

import {TouchableOpacity, View} from 'react-native'

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

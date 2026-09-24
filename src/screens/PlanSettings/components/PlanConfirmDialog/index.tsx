import React, {useEffect, useRef, useState} from 'react'

import {AccessibilityInfo, ScrollView, useWindowDimensions, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'
import * as Haptics from 'expo-haptics'
import Modal from 'react-native-modal'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import InfoBanner from '@components/InfoBanner'
import PrimaryButton from '@components/PrimaryButton'
import StatusBadgeCircle from '@components/StatusBadgeCircle'
import SummaryRows, {SummaryRow} from '@components/SummaryRows'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'

import {STATUS_ANNOUNCEMENT_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import styles, {cardMaxHeight} from './index.styled'

/**
 * What a dialog says in place of a confirmation it cannot take, and the read it offers to retry. The copy is
 * the caller's — this component states the reason it is handed and owns no wording of its own.
 */
export interface PlanConfirmNotice {
  readonly body: string
  readonly actionLabel: string
  readonly onAction: () => void
}

interface Props {
  readonly isVisible: boolean
  readonly title: string
  readonly body: string
  readonly summaryRows: SummaryRow[]
  readonly confirmLabel: string
  readonly dismissLabel: string
  readonly onConfirm: () => void
  readonly onDismiss: () => void
  /**
   * The confirmation is already under way — dispatched by an earlier press, or waiting on something that has
   * to answer before one can be taken. The button reads as busy and takes no press, which is what stops a
   * second tap from looking like it was heard (0.7.2).
   */
  readonly isConfirmPending?: boolean
  /** No confirmation may be taken at all. Distinct from pending: nothing resolves this by waiting. */
  readonly isConfirmDisabled?: boolean
  readonly notice?: PlanConfirmNotice
}

const PlanConfirmDialog = (props: Props): React.JSX.Element => {
  const {
    isVisible,
    title,
    body,
    summaryRows,
    confirmLabel,
    dismissLabel,
    onConfirm,
    onDismiss,
    isConfirmPending = false,
    isConfirmDisabled = false,
    notice
  } = props
  const {height: windowHeight} = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // The modal owns the whole window (margin: 0), so the ceiling is the window less the safe-area
  // insets and the card's own gutter — it clears the designed card on every supported size and
  // engages only under scaled text. Both actions sit outside the scroll region so they stay
  // reachable at that point, which also keeps the confirm button's glow clear of the viewport.
  const availableCardHeight = windowHeight - insets.top - insets.bottom - Spacing.GUTTER * 2
  const [heading, setHeading] = useState<View | null>(null)
  const hasAnnouncedRef = useRef(false)
  // The title and the body are two text nodes, and read as two unrelated fragments, so the pair is
  // spoken as one sentence. Announced on both platforms rather than iOS only, as elsewhere in this
  // feature: there is no live region here to carry it on Android, because the card mounts complete
  // and nothing about it afterwards changes for a region to report.
  const announcement = stringWithNamedParameters(STATUS_ANNOUNCEMENT_TEMPLATE, {title, body})

  useEffect(() => {
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) {
      hasAnnouncedRef.current = false

      return
    }

    // The heading mounts a commit later than isVisible turns true — react-native-modal holds its
    // content back until its own show state settles — so the heading arriving is what opens this,
    // not the prop. Once per open: the dialog is re-rendered by every pending and notice change,
    // and none of those is the dialog opening again.
    if (heading === null || hasAnnouncedRef.current) {
      return
    }

    hasAnnouncedRef.current = true
    AccessibilityInfo.announceForAccessibility(announcement)
    // Focus lands on the heading, so the body is the next swipe and the announcement is not the only
    // way the dialog's reason reaches a screen reader.
    AccessibilityInfo.sendAccessibilityEvent(heading, 'focus')
  }, [announcement, heading, isVisible])

  return (
    <Modal
      // react-native-modal margins its own content wrapper by 5% of the device width; margin: 0
      // hands the gutter back to the card so it keeps the designed inset on every screen size.
      style={styles.modal}
      // Defensive: 38:566 draws no input and none is rendered, so no keyboard is reachable from here today,
      // but react-native-modal defaults avoidKeyboard to false and a caller could open this over a focused
      // field — the ceiling below is derived from safe-area insets, which an overlaid keyboard does not move.
      avoidKeyboard={true}
      useNativeDriverForBackdrop={true}
      animationIn="pulse"
      animationOut="fadeOut"
      animationInTiming={300}
      animationOutTiming={100}
      // Supplying a backdrop replaces the TouchableWithoutFeedback react-native-modal wraps its own
      // in, which is a nameless, roleless, full-screen reading stop in front of the dialog for
      // assistive technology; ours is hidden from it outright. The library paints its own wrapper
      // transparent as soon as a custom backdrop is given, so backdropColor would be inert and the
      // scrim colour moves to the stylesheet — backdropOpacity still animates that wrapper, so the
      // composed rgba(0,0,0,0.62) is unchanged.
      customBackdrop={
        <View style={styles.backdrop} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      }
      backdropOpacity={Opacity.SCRIM}
      isVisible={isVisible}
      // onBackdropPress is deliberately not wired, unlike ConfirmModal: the design draws no
      // dismiss affordance on the scrim, so the tertiary action and the platform back gesture
      // are the only ways out.
      onBackButtonPress={onDismiss}>
      <View style={styles.container} pointerEvents="box-none">
        <View style={[styles.card, cardMaxHeight(availableCardHeight)]} accessibilityViewIsModal>
          <ScrollView style={styles.scrollRegion} alwaysBounceVertical={false}>
            <StatusBadgeCircle variant="dialog" />

            <View accessible accessibilityRole="header" ref={setHeading}>
              <Text style={styles.title}>{title}</Text>
            </View>

            <Text style={styles.body}>{body}</Text>

            <View style={styles.summaryPanel}>
              <SummaryRows rows={summaryRows} />
            </View>
          </ScrollView>

          {notice !== undefined && (
            // Outside the scroll region, beside the actions it explains, and announced where it appears: the
            // reason a pinned confirm button is disabled has to reach a screen reader at the moment it
            // arrives, since the button itself only reports that it is unavailable.
            <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <InfoBanner
                tone="error"
                glyph="alert"
                body={notice.body}
                actionLabel={notice.actionLabel}
                onAction={notice.onAction}
              />
            </View>
          )}

          <View style={styles.primaryAction}>
            <PrimaryButton
              label={confirmLabel}
              isLoading={isConfirmPending}
              disabled={isConfirmDisabled}
              onPress={onConfirm}
            />
          </View>

          <View style={styles.dismissAction}>
            <TertiaryTextButton label={dismissLabel} onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default PlanConfirmDialog

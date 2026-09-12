import React, {useEffect} from 'react'

import {View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'
import * as Haptics from 'expo-haptics'
import Modal from 'react-native-modal'

import PrimaryButton from '@components/PrimaryButton'
import StatusBadgeCircle from '@components/StatusBadgeCircle'
import SummaryRows, {SummaryRow} from '@components/SummaryRows'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  readonly isVisible: boolean
  readonly title: string
  readonly body: string
  readonly summaryRows: SummaryRow[]
  readonly confirmLabel: string
  readonly dismissLabel: string
  readonly onConfirm: () => void
  readonly onDismiss: () => void
}

const PlanConfirmDialog = (props: Props) => {
  const {isVisible, title, body, summaryRows, confirmLabel, dismissLabel, onConfirm, onDismiss} = props

  useEffect(() => {
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [isVisible])

  return (
    <Modal
      // react-native-modal margins its own content wrapper by 5% of the device width; margin: 0
      // hands the gutter back to the card so it keeps the designed inset on every screen size.
      style={styles.modal}
      useNativeDriverForBackdrop={true}
      animationIn="pulse"
      animationOut="fadeOut"
      animationInTiming={300}
      animationOutTiming={100}
      backdropColor={Theme.colors.overlayBackdrop}
      backdropOpacity={Opacity.SCRIM}
      isVisible={isVisible}
      // onBackdropPress is deliberately not wired, unlike ConfirmModal: the design draws no
      // dismiss affordance on the scrim, so the tertiary action and the platform back gesture
      // are the only ways out.
      onBackButtonPress={onDismiss}>
      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          <StatusBadgeCircle variant="dialog" />

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.body}>{body}</Text>

          <View style={styles.summaryPanel}>
            <SummaryRows rows={summaryRows} />
          </View>

          <View style={styles.primaryAction}>
            <PrimaryButton label={confirmLabel} onPress={onConfirm} />
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

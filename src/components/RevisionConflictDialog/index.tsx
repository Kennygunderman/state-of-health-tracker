import React, {useEffect} from 'react'

import {View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'
import * as Haptics from 'expo-haptics'
import Modal from 'react-native-modal'

import PrimaryButton from '@components/PrimaryButton'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  readonly isVisible: boolean
  readonly title: string
  readonly keepMineLabel: string
  readonly useTheirsLabel: string
  readonly isKeepMinePending: boolean
  readonly onKeepMine: () => void
  readonly onUseTheirs: () => void
}

/**
 * The prompt a rejected revision raises once the refetched row is known to differ from the draft.
 *
 * `ConfirmModal` cannot serve it: that component's dismiss label is fixed to `CANCEL_BUTTON_TEXT`, so it
 * cannot render "Use theirs", and it is a shipped dialog with five existing callers. This follows the
 * precedent `PlanConfirmDialog` set for the same situation — the same `react-native-modal` base, stacked
 * actions, no backdrop dismissal — because a conflict has no neutral third answer: leaving it unanswered
 * would strand a draft the server has already refused.
 */
const RevisionConflictDialog = (props: Props): React.JSX.Element => {
  const {isVisible, title, keepMineLabel, useTheirsLabel, isKeepMinePending, onKeepMine, onUseTheirs} = props

  useEffect(() => {
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [isVisible])

  return (
    <Modal
      style={styles.modal}
      avoidKeyboard={true}
      useNativeDriverForBackdrop={true}
      animationIn="pulse"
      animationOut="fadeOut"
      animationInTiming={300}
      animationOutTiming={100}
      backdropColor={Theme.colors.overlayBackdrop}
      backdropOpacity={Opacity.SCRIM}
      isVisible={isVisible}
      // The hardware back gesture resolves to "use theirs": it is the answer that discards nothing the
      // server holds, so a dismissal can never be read as a silent re-submission of the refused draft.
      onBackButtonPress={onUseTheirs}>
      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.primaryAction}>
            <PrimaryButton label={keepMineLabel} isLoading={isKeepMinePending} onPress={onKeepMine} />
          </View>

          <View style={styles.dismissAction}>
            <TertiaryTextButton label={useTheirsLabel} disabled={isKeepMinePending} onPress={onUseTheirs} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default RevisionConflictDialog

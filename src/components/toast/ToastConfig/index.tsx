import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {BaseToast, ToastData, ToastProps} from 'react-native-toast-message'

import Text from '@components/Text'
import {composeToastMessage} from '@components/toast/util/ShowToast'

import styles from './index.styled'

export interface ActionToastProps {
  actionLabel: string
  onAction: () => void
}

// The grouped status element is the content container, not `BaseToast`'s root `TouchableOpacity`, for two
// reasons. RN 0.86's `TouchableOpacity` forwards accessibility props one by one and has no `role` among them,
// so a role handed to `touchableContainerProps` never reaches the view; the content container is a plain `View`
// and passes it through. And the root is not pressable here — no call site gives a toast an `onPress` — so it
// is made non-accessible rather than left as a second, nameless stop wrapping the first.
//
// The role itself is declared through the ARIA `role` prop rather than `accessibilityRole`: RN 0.86's
// `accessibilityRole` has no 'status' — Android throws `Invalid accessibility role value` on one it does not
// know — while `role` accepts both and is mapped to the native role on each platform (same as `InfoBanner`).
// 'alert' interrupts what is being read because the toast carries a failed action; 'status' waits its turn.
export default {
  success: (props: ToastProps & ToastData) => (
    <BaseToast
      {...props}
      style={styles.successToast}
      contentContainerStyle={styles.contentContainer}
      contentContainerProps={{
        accessible: true,
        accessibilityLabel: composeToastMessage(props.text1, props.text2),
        role: 'status'
      }}
      touchableContainerProps={{accessible: false}}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
  error: (props: ToastProps & ToastData) => (
    <BaseToast
      {...props}
      style={styles.errorToast}
      contentContainerStyle={styles.contentContainer}
      contentContainerProps={{
        accessible: true,
        accessibilityLabel: composeToastMessage(props.text1, props.text2),
        role: 'alert'
      }}
      touchableContainerProps={{accessible: false}}
      text1NumberOfLines={3}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
  action: ({text1, text2, props}: ToastProps & {text1?: string; text2?: string; props: ActionToastProps}) => (
    <View style={styles.actionToast}>
      <View style={styles.actionTextColumn} accessible accessibilityLabel={composeToastMessage(text1, text2)}>
        <Text style={styles.text1} numberOfLines={1}>
          {text1}
        </Text>

        {!!text2 && (
          <Text style={styles.text2} numberOfLines={2}>
            {text2}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        activeOpacity={Opacity.PRESSED_SUBTLE}
        accessibilityRole="button"
        accessibilityLabel={props.actionLabel}
        onPress={props.onAction}>
        <Text style={styles.actionButtonText}>{props.actionLabel}</Text>
      </TouchableOpacity>
    </View>
  )
}

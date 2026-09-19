import {announceForAccessibility} from '@service/accessibility/AccessibilityAnnouncer'
import * as Haptics from 'expo-haptics'
import Toast from 'react-native-toast-message'

import {STATUS_ANNOUNCEMENT_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

const TOAST_LENGTH = 3_000
const ACTION_TOAST_LENGTH = 7_000

/**
 * A toast's two lines as one spoken sentence.
 *
 * The headline and the detail line are separate text nodes on screen and arrive as two unrelated fragments when
 * read that way, so the pair is spoken as one sentence — the same composition `InfoBanner` gives a status. It is
 * exported because `ToastConfig` labels the toast's container with it: the sentence a reader hears when the
 * toast appears and the one it reads when it reaches the toast must not be two different messages.
 */
export const composeToastMessage = (text1: string | undefined, text2: string | undefined): string => {
  const title = text1?.trim() ?? ''
  const body = text2?.trim() ?? ''

  if (title.length === 0 || body.length === 0) {
    return title.length === 0 ? body : title
  }

  return stringWithNamedParameters(STATUS_ANNOUNCEMENT_TEMPLATE, {title, body})
}

export const showToast = (type: 'success' | 'error', text1: string, text2?: string): void => {
  Toast.show({
    type,
    text1,
    text2,
    visibilityTime: TOAST_LENGTH
  })

  // Announced explicitly, on both platforms, rather than through `accessibilityLiveRegion` on the toast: a live
  // region announces what changes INSIDE an already-mounted region, and a toast mounts already holding its text
  // and then unmounts rather than updating in place, so the prop would be dead on Android — and carrying both
  // would make Android say everything twice. Unconditional, including the error path, because a failure that is
  // reported only visually is a failure the user never hears.
  announceForAccessibility(composeToastMessage(text1, text2), 'allScreenReaders')

  if (type === 'success') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }
}

// Toast with an action button (e.g. "Save to your foods? — Add"). Stays up
// longer than a plain toast so there's time to read and decide; hides itself
// when the action is pressed.
export const showActionToast = (text1: string, text2: string, actionLabel: string, onAction: () => void): void => {
  Toast.show({
    type: 'action',
    text1,
    text2,
    visibilityTime: ACTION_TOAST_LENGTH,
    props: {
      actionLabel,
      onAction: () => {
        Toast.hide()
        onAction()
      }
    }
  })

  announceForAccessibility(composeToastMessage(text1, text2), 'allScreenReaders')

  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}

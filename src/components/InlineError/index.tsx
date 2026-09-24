import React from 'react'

import {View} from 'react-native'

import {useAccessibilityAnnouncement} from '@hooks/useAccessibilityAnnouncement'
import {Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import AlertCircleIcon from '@components/icons/AlertCircleIcon'
import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  message: string
}

const InlineError = ({message}: Props): React.JSX.Element => {
  // The row mounts exactly when validation fails, so its arrival IS the news and is announced for VoiceOver
  // here. No `accessibilityLiveRegion` belongs on this component: it is Android-only in RN 0.86 and announces
  // what changes INSIDE a mounted region, so one arriving already holding its message is never read out —
  // Android is served by the permanently-mounted region each screen wraps this row in.
  useAccessibilityAnnouncement(message, {scope: 'voiceOver'})

  return (
    <View style={styles.container} accessible accessibilityRole="alert" accessibilityLabel={message}>
      <AlertCircleIcon variant="inline" color={Theme.colors.danger} size={Sizes.ICON_XS} strokeWidth={Stroke.DEFAULT} />

      <Text style={styles.message}>{message}</Text>
    </View>
  )
}

export default InlineError

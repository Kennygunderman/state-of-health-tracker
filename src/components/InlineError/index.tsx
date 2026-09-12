import React from 'react'

import {View} from 'react-native'

import {Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import AlertCircleIcon from '@components/icons/AlertCircleIcon'
import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  message: string
}

const InlineError = ({message}: Props): React.JSX.Element => (
  <View style={styles.container}>
    <AlertCircleIcon variant="inline" color={Theme.colors.danger} size={Sizes.ICON_XS} strokeWidth={Stroke.DEFAULT} />

    <Text style={styles.message}>{message}</Text>
  </View>
)

export default InlineError

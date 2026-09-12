import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  message: string
}

const DashedPlaceholder = ({message}: Props) => (
  <View style={styles.container}>
    <Text style={styles.message}>{message}</Text>
  </View>
)

export default DashedPlaceholder

import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  title: string
  caption: string
}

const CheckedSectionHeader = ({title, caption}: Props): React.JSX.Element => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <Text style={styles.caption}>{caption}</Text>
    </View>
  )
}

export default CheckedSectionHeader

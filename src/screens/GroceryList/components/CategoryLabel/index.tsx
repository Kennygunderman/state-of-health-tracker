import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  label: string
  isFirst: boolean
}

const CategoryLabel = ({label, isFirst}: Props) => {
  return (
    <View style={[styles.container, isFirst && styles.containerFirst]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

export default CategoryLabel

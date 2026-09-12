import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  name: string
  quantityText: string
}

const IngredientRow = ({name, quantityText}: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{name}</Text>

      <Text style={styles.quantity} numberOfLines={1}>
        {quantityText}
      </Text>
    </View>
  )
}

export default IngredientRow

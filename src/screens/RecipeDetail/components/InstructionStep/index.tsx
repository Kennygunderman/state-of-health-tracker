import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  index: number
  text: string
}

const InstructionStep = ({index, text}: Props): React.JSX.Element => {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.stepNumber}>{index}</Text>
      </View>

      <Text style={styles.instructionText}>{text}</Text>
    </View>
  )
}

export default InstructionStep

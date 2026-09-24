import React from 'react'

import {View} from 'react-native'

import styles from './index.styled'

interface Props {
  children: React.ReactNode
}

const ContentColumn = ({children}: Props): React.JSX.Element => <View style={styles.container}>{children}</View>

export default ContentColumn

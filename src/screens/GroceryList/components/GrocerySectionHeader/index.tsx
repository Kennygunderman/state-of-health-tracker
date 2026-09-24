import React from 'react'

import {View} from 'react-native'

import CategoryLabel from '../CategoryLabel'
import CheckedSectionHeader from '../CheckedSectionHeader'
import styles from './index.styled'

interface CategoryHeaderProps {
  kind: 'category'
  label: string
  isFirst: boolean
}

interface CheckedHeaderProps {
  kind: 'checked'
  title: string
  caption: string
}

type Props = CategoryHeaderProps | CheckedHeaderProps

const GrocerySectionHeader = (props: Props): React.JSX.Element => {
  if (props.kind === 'category') {
    return (
      <View style={styles.container} accessibilityRole="header">
        <CategoryLabel label={props.label} isFirst={props.isFirst} />
      </View>
    )
  }

  return (
    <View style={styles.container} accessibilityRole="header">
      <CheckedSectionHeader title={props.title} caption={props.caption} />
    </View>
  )
}

export default GrocerySectionHeader

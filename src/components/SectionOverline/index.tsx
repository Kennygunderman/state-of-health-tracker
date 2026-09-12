import React from 'react'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  text: string
  tone?: 'muted' | 'green'
}

const SectionOverline = (props: Props): React.JSX.Element => {
  const {text, tone = 'muted'} = props

  return <Text style={[styles.overline, tone === 'green' && styles.overlineGreen]}>{text}</Text>
}

export default SectionOverline

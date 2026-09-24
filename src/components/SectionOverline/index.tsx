import React from 'react'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  text: string
  tone?: 'muted' | 'green'
  /**
   * Whether this overline heads a section, which is what earns it the `header` role and a stop on the
   * screen-reader heading rotor. Opt-in and false by default: most call sites draw an eyebrow above a title, a
   * status line or the label half of a label/value pair, and a heading rotor full of those is no more
   * navigable than one with nothing in it.
   */
  isHeading?: boolean
}

const SectionOverline = (props: Props): React.JSX.Element => {
  const {text, tone = 'muted', isHeading = false} = props

  return (
    <Text
      style={[styles.overline, tone === 'green' && styles.overlineGreen]}
      accessibilityRole={isHeading ? 'header' : undefined}>
      {text}
    </Text>
  )
}

export default SectionOverline

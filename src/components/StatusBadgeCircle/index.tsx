import React from 'react'

import {View} from 'react-native'

import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

import AlertCircleIcon from '@components/icons/AlertCircleIcon'
import RefreshIcon from '@components/icons/RefreshIcon'
import SearchMinusIcon from '@components/icons/SearchMinusIcon'

import styles from './index.styled'

export type StatusBadgeVariant = 'failure' | 'noMatch' | 'swapEmpty' | 'dialog'

interface Props {
  variant: StatusBadgeVariant
}

// Glyph strokeWidth is never passed: each icon's own default over its own viewBox already renders
// the Figma stroke — SearchMinusIcon's 1.95 over 26 units gives exactly 2.1 at size 28.
const GLYPHS: Record<StatusBadgeVariant, React.JSX.Element> = {
  failure: <AlertCircleIcon variant="lg" size={Sizes.ICON_ALERT} color={Theme.colors.danger} />,
  noMatch: <SearchMinusIcon size={Sizes.ICON_HERO} color={Theme.colors.lime} />,
  swapEmpty: <SearchMinusIcon size={Sizes.ICON_BADGE} color={Theme.colors.lime} />,
  dialog: <RefreshIcon size={Sizes.ICON_XL} color={Theme.colors.danger} />
}

const StatusBadgeCircle = ({variant}: Props): React.JSX.Element => (
  <View
    style={[styles.badge, styles[variant]]}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants">
    {GLYPHS[variant]}
  </View>
)

export default StatusBadgeCircle

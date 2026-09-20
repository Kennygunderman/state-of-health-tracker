import React from 'react'

import {View} from 'react-native'

import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

import AlertCircleIcon from '@components/icons/AlertCircleIcon'
import InfoCircleIcon from '@components/icons/InfoCircleIcon'
import RefreshIcon from '@components/icons/RefreshIcon'
import SearchMinusIcon from '@components/icons/SearchMinusIcon'

import styles from './index.styled'

export type StatusBadgeVariant = 'failure' | 'noMatch' | 'swapEmpty' | 'dialog' | 'unconfirmed'

interface Props {
  variant: StatusBadgeVariant
}

// Glyph strokeWidth is never passed: each icon's own default over its own viewBox already renders
// the Figma stroke — SearchMinusIcon's 1.95 over 26 units gives exactly 2.1 at size 28.
const GLYPHS: Record<StatusBadgeVariant, React.JSX.Element> = {
  failure: <AlertCircleIcon variant="lg" size={Sizes.ICON_ALERT} color={Theme.colors.danger} />,
  noMatch: <SearchMinusIcon size={Sizes.ICON_HERO} color={Theme.colors.lime} />,
  swapEmpty: <SearchMinusIcon size={Sizes.ICON_BADGE} color={Theme.colors.lime} />,
  dialog: <RefreshIcon size={Sizes.ICON_XL} color={Theme.colors.danger} />,
  // INVENTED — no design authority. Figma authors no frame, variant or note for an outcome the client could
  // not confirm; AAP 0.2.5 specifies only its layout (10b's), its copy and its disc (the neutral #1B2620).
  // Disc fill and glyph ink co-vary as one semantic pair everywhere else here — #39241F/#E2685E reads
  // "error", #1B2620/#7ECC53 reads "narrowed search" — so a state that asserts nothing may take neither:
  // the neutral disc carries the neutral ink the design language already pairs with it on InfoBanner's
  // neutral tone, and the info-circle is the file's one glyph that states rather than diagnoses.
  //
  // Size follows this file's own stroke rule above rather than 10b's 30-unit glyph box: 28 fills the 64 disc
  // exactly as its neutral sibling noMatch does, and InfoCircleIcon's 1.53 over an 18-unit viewBox renders
  // 2.38 there — the 2.375 the 10b badge glyph strokes — so substituting this badge for that one leaves the
  // disc's optical weight unchanged, which is what "10b's layout" has to mean at the badge.
  unconfirmed: <InfoCircleIcon size={Sizes.ICON_HERO} color={Theme.colors.textSecondary} />
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

import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: Spacing.SMALL
  },
  // Minimums, not fixed sizes: at 200% type the digit outgrows a 22px box, and a fixed disc could only fit it by
  // shrinking the digit (AAP 0.7.4 forbids). Figma authors a hard 22x22 disc with no padding (node 49:649). For a
  // single digit -- every seeded recipe has 3 to 6 steps -- these minimums hold the disc at exactly 22px wide at
  // every text size, so it renders as the authored 22x22 circle up to 135% and grows only downwards past that,
  // to 22x30 at 200%. It reads as a stadium there rather than a circle; that is accepted, because the only
  // alternative is a digit clipped by the disc around it. A two-digit step would widen the disc instead, which
  // the padding keeps legible by holding the design's horizontal ink clearance.
  badge: {
    minWidth: Sizes.STEP_BADGE,
    minHeight: Sizes.STEP_BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.XX_SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.greenTint
  },
  stepNumber: {
    fontSize: FontSize.CAPTION,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.accentGreen
  },
  instructionText: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.STEP_BODY,
    color: Theme.colors.textSecondary
  }
})

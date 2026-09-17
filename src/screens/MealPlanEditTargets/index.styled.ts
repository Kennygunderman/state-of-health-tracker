import {Insets, StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

/* The recalculate link is a bare text link, as the equivalent action is drawn on the review card (34:40), so
   the 44px target comes from hitSlop and never from padding or minHeight, either of which would move the field
   ladder below it. recalculateLink pins its line box to LineHeight.LABEL, so the drawn height is exactly 16
   rather than whatever the platform measures for 13px, and 16 + MEDIUM + MEDIUM is 48. Both of those edges sit
   inside the row's own clearance — GUTTER above from this row's padding, GUTTER below from bannerWrapper — so
   the target never extends past a sibling's. */
export const RECALCULATE_HIT_SLOP: Insets = {
  top: Spacing.MEDIUM,
  right: Spacing.MEDIUM,
  bottom: Spacing.MEDIUM,
  left: Spacing.MEDIUM
}

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.X_LARGE
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    minHeight: Sizes.TILE_SM
  },
  headerLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },
  // The two block insets below carry the whole ladder beneath them. Figma pins
  // this screen's headline and sub-copy line heights to the fractions 34.5 and
  // 21.75, then declares each block's wrapper at the ceiling of padding plus
  // that fraction (34:208 = 51, 34:211 = 30). Honouring only the fractions
  // leaves every field label, input row, inline error and banner 0.75 short of
  // Figma's integral ladder, so both are reconciled here instead of rounding
  // line heights that are shared with every other screen.
  headline: {
    paddingTop: Spacing.MEDIUM,
    paddingBottom: Sizes.TITLE_BLOCK_INSET_B,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  subCopy: {
    paddingTop: Spacing.X_SMALL,
    paddingBottom: Sizes.SUBCOPY_BLOCK_INSET_B,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.BODY,
    color: Theme.colors.textSecondary
  },
  fieldGroup: {
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.MEDIUM
  },
  fieldBlock: {
    alignSelf: 'stretch'
  },
  /* The line height is pinned rather than left automatic because it is load-bearing here: Figma's field
     group (node 34:214) is a fixed 380 tall that closes only as 20 + 4 blocks of 16 + 8 + 48 plus the
     error row, so a platform-resolved 15 shortens every block by one and drifts the rows, the error and
     the banner by up to 5 by the bottom of the group. */
  fieldLabel: {
    paddingBottom: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textSecondary
  },
  bannerWrapper: {
    paddingTop: Spacing.GUTTER
  },
  recalculateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    paddingTop: Spacing.GUTTER
  },
  recalculateLabel: {
    flex: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  recalculateLink: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.accentGreen
  },
  skeletonGroup: {
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.MEDIUM
  },
  skeletonStretch: {
    width: '100%'
  },
  /* Figma fixes the primary CTA at 52 tall (node 34:285) and declares no padding on it, so the height is
     authored rather than derived from the label. PrimaryButton sizes itself from paddingVertical plus its
     label box instead, which lands on 50 and leaves the footer 2 short. Correcting that here rather than in
     the shared component keeps the pre-existing callers outside this feature at the height they ship with. */
  ctaHeight: {
    minHeight: Sizes.CTA,
    justifyContent: 'center'
  }
})

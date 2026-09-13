import {Insets, StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

/* BLITZY [A11Y]: 34:40/34:41 draw this action as a bare 25x16 text link with no surface, so it is smaller than
   Sizes.TOUCH_TARGET and Figma stays authoritative for the drawn size — the 44px target comes from hitSlop,
   never from padding or minHeight, both of which would grow this hug-height row and the card with it.
   The target is arithmetic, not an assumption about font metrics: editLink pins its line box to
   LineHeight.LABEL, so the drawn height is exactly the 16 Figma resolves rather than whatever the platform
   font measures for 13px, and 16 + GUTTER + X_SMALL is exactly Sizes.TOUCH_TARGET. Those two edges are also
   the real clearances above and below the link (the card's own padding and the figure shim), so the target
   stays inside the card. MEDIUM on each side clears 44 horizontally for either label the screen passes.
   headerRow carries matching slop because a child's hitSlop cannot extend past its parent's bounds: both
   platforms gate the search for a touch target on the ancestor's own hit rect first. */
export const TARGETS_EDIT_HIT_SLOP: Insets = {
  top: Spacing.GUTTER,
  right: Spacing.MEDIUM,
  bottom: Spacing.X_SMALL,
  left: Spacing.MEDIUM
}

export const TARGETS_HEADER_ROW_HIT_SLOP: Insets = {
  top: Spacing.GUTTER,
  right: Spacing.MEDIUM,
  bottom: Spacing.X_SMALL
}

export default StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: Spacing.GUTTER,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  // Figma 34:36 declares gap 0, but it also leaves 195px of slack under space-between, so a 12px floor is
  // invisible at the reference size and is what keeps the overline and the action apart once the text grows.
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    flexWrap: 'wrap',
    columnGap: Spacing.SMALL,
    rowGap: Spacing.XX_SMALL
  },
  labelSlot: {
    flexGrow: 0,
    flexShrink: 1
  },
  editAction: {
    flexShrink: 0,
    marginLeft: 'auto'
  },
  editLink: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    // Pinned so 34:41's box is the 16 Figma resolves instead of the platform font's own 13px line box, which
    // both reproduces the drawn 25x16 link exactly and closes the hitSlop arithmetic above.
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.accentGreen
  },
  figureWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  estimatePairRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: Spacing.X_SMALL,
    flexWrap: 'wrap',
    rowGap: Spacing.XX_SMALL
  },
  estimateFigure: {
    flexShrink: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  dividerWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.SMALL
  },
  divider: {
    alignSelf: 'stretch',
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  legendWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  captionWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  // 13px multi-line meta, so LineHeight.META: Figma sizes 34:80 against the 353px page column, where it fits
  // on one line, but this card nests it at the 313px content measure, where it wraps — and a wrapping 13px
  // caption is what text-meta's 18.85 is for. Nothing constrains the growth: captionWrapper hugs, unlike the
  // fixed 24px wrapper 34:79 gives it in the frame.
  caption: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  }
})

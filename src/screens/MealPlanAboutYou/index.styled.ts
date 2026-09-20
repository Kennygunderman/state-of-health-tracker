import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    paddingBottom: Spacing.LARGE
  },
  headline: {
    paddingTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  subCopy: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.BODY,
    color: Theme.colors.textSecondary
  },
  form: {
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.MEDIUM
  },
  // Figma 46:297 gives the field groups no gap of their own: the 8 between a label and its control, and the 8
  // between a control and its caption or error row, each belong to the lower element (the control's margin
  // wrapper, the caption, the error row). InlineError already carries that padding, so a group-level gap
  // would double it.
  fieldGroup: {},
  controlSlot: {
    paddingTop: Spacing.X_SMALL
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL
  },
  /* The same automatic 13px box prefillCaption below pins, for the same reason: Figma leaves these labels'
     line height unset and resolves it to 16 (the Age label's wrapper is what establishes the value), so
     leaving it unset here would hand the box to the platform font's 1.21 multiplier — 15.73 — and shrink
     every field group under it. */
  fieldLabel: {
    flexShrink: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textSecondary
  },
  // The group that names a unit toggle for a screen reader. SegmentedControl's compact envelope aligns itself
  // to the start of the label row, so the wrapper takes that alignment over rather than centring the toggle
  // once the label grows taller than the 29-tall track.
  unitToggleGroup: {
    alignSelf: 'flex-start'
  },
  heightRow: {
    flexDirection: 'row',
    columnGap: Spacing.SMALL,
    paddingTop: Spacing.X_SMALL
  },
  heightField: {
    flex: 1
  },
  /* Figma leaves this caption's line height automatic, which resolves to a 16 box and makes the row exactly
     X_SMALL + 16 = 24 as drawn (node 46:359). LineHeight.META's 18.85 is the multi-line meta leading and would
     stretch the row to 26.85, pushing the Sex group below it off its drawn position. */
  prefillCaption: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },
  sexOptions: {
    paddingTop: Spacing.X_SMALL,
    rowGap: Spacing.X_SMALL
  },
  skeletonGroup: {
    paddingTop: Spacing.MEDIUM,
    rowGap: Spacing.MEDIUM
  },
  skeletonStretch: {
    width: '100%'
  },
  /* Figma fixes the primary CTA at 52 tall (node 46:388 on 03, 46:547 on 03b) and declares no padding on it,
     so the height is authored rather than derived from the label. PrimaryButton sizes itself from
     paddingVertical plus its label box instead, which lands on 50 and leaves the footer 2 short. Correcting
     that here rather than in the shared component keeps the 19 pre-existing callers outside this feature at
     the height they ship with; the style prop is merged last over PrimaryButton's own inner style, and
     centring goes with the minimum height so the label stays on the box centre as drawn. */
  ctaHeight: {
    minHeight: Sizes.CTA,
    justifyContent: 'center'
  }
})

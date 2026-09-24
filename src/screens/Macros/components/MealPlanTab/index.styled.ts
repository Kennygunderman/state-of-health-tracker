import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// The bottom padding the host Macros screen puts on its scroll content (`Macros/index.styled.ts`
// `scrollContent.paddingBottom`). The empty region is the last thing that screen lays out, so filling the whole
// remainder below the region's top would push that padding past the viewport and leave the state scrollable by
// it. It is therefore given back *below* the region rather than deducted from the height above: deducting it
// shortens the centring box, and `justifyContent: 'center'` then biases the block up by half of it.
const HOST_SCROLL_BOTTOM_PADDING = Spacing.X_LARGE

// The height is measured at runtime — what the viewport has left below the segmented control — so the style
// is a factory, the form `PrimaryButton/index.styled.ts` uses for its measured width.
export const emptyRegion = (minHeight: number): ViewStyle => ({
  minHeight,
  justifyContent: 'center',
  marginBottom: -HOST_SCROLL_BOTTOM_PADDING
})

export default StyleSheet.create({
  body: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: Sizes.CONTENT_MAX_WIDTH
  },
  dayStripContainer: {
    marginTop: Spacing.MEDIUM
  },
  totalsCardContainer: {
    marginTop: Spacing.MEDIUM
  },
  bannerContainer: {
    marginTop: Spacing.MEDIUM
  },
  mealCardContainer: {
    marginTop: Spacing.SMALL
  },
  mealCardContainerFirst: {
    marginTop: Spacing.MEDIUM
  },
  planSettingsRowContainer: {
    marginTop: Spacing.MEDIUM
  },
  lastDayCardContainer: {
    marginTop: Spacing.MEDIUM
  },
  captionContainer: {
    marginTop: Spacing.X_SMALL
  },
  macrosHeader: {
    alignSelf: 'flex-start',
    marginTop: Spacing.MEDIUM
  },
  screenTitle: {
    marginTop: Spacing.XX_SMALL,
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  // The negative bottom margin is the other half of the envelope below: the body block that follows opens with
  // its own Spacing.MEDIUM top margin, and this gives that much back, so the envelope's reachable tail costs
  // the layout the 4 px by which Sizes.TOUCH_TARGET exceeds the 8 + 16 + 16 the switch used to occupy — and no
  // more. The two cancel exactly, so the following content starts at the envelope's edge and never over it.
  planSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: -Spacing.MEDIUM
  },
  // A real envelope rather than hitSlop: the row is only as tall as its label, and RN never extends slop past
  // a parent's bounds. The label keeps the exact inset the row's former marginTop gave it — hence top-aligned
  // with that same padding rather than centred, which would drop it 6 px — and the envelope's remaining height
  // is reachable transparent space below it.
  planSwitchButton: {
    minHeight: Sizes.TOUCH_TARGET,
    justifyContent: 'flex-start',
    paddingTop: Spacing.X_SMALL
  },
  planSwitchLink: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    marginTop: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    borderRadius: BorderRadius.TIP,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.dangerBorder,
    backgroundColor: Theme.colors.dangerTint
  },
  errorTitle: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  retryPill: {
    height: Sizes.PILL_SM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.accentGreen
  },
  /* BLITZY [A11Y]: the retry pill's label is white on the accent fill above at 600/13px, which measures
     2.45:1 against the 4.5:1 AA default (13px/600 is not WCAG large text). The inline retry card is an
     inferred state — no Figma frame draws it — so the project directive's rule for inferred states applies:
     build it from the design language the file already uses, and that language pairs an accent pill with a
     white 600/13px label at the error banner's action (`38:396` + `38:397`), the one pill this card is
     modelled on. This label previously read `onInverse`, which is the remedy the accessible-colour register
     *proposes* for this pair rather than a value anything draws. That is the defect recorded here: applying
     a proposed remedy at one of the two identical accent pills in this feature left them rendering at
     7.67:1 and 2.45:1 and forked the pill language, and the directive is explicit for exactly this case —
     match the drawn pair, emit this flag for designer review, and never adjust a colour unilaterally to
     reach the minimum. So the pair is matched and flagged, not adjusted. White is already maximum contrast,
     so only the pill can move (`background` on `accentGreen` measures 7.67:1); whoever approves entry 1 of
     the register moves both pills together, and the remedy and its reach are recorded there. See the
     accessible-colour register in `@styles/theme`. */
  retryLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.white
  },
  unavailableCard: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  unavailableText: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },
  staleCaption: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },
  skeletonStretch: {
    alignSelf: 'stretch'
  },
  skeletonHeaderRow: {
    rowGap: Spacing.XX_SMALL,
    marginTop: Spacing.MEDIUM
  },
  skeletonDayStrip: {
    flexDirection: 'row',
    columnGap: Spacing.TIGHT,
    marginTop: Spacing.MEDIUM
  },
  skeletonCard: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.GUTTER,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.X_SMALL
  }
})

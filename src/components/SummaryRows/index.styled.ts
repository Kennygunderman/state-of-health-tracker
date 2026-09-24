import {StyleSheet, TextStyle} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const valueTextColor = (color: string): TextStyle => ({
  color
})

export default StyleSheet.create({
  container: {
    alignSelf: 'stretch'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  rowInline: {
    justifyContent: 'space-between'
  },
  rowSpaced: {
    marginTop: Spacing.SMALL
  },
  rowStacked: {
    paddingVertical: Spacing.SMALL
  },
  rowDivider: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  textColumn: {
    flex: 1
  },
  /* BLITZY [A11Y]: the label implements the `textMuted` Figma authors for every card this component draws
     (400 13, node 38:531 and its siblings). On the `card` fill that the three screen call sites give it —
     MealPlanTargets, MealPlanCookingBudget, MealPlanGenerating — it measures 4.75:1 and clears the 4.5:1 AA
     default; inside PlanConfirmDialog's `summaryPanel`, whose fill is `inset`, the same paint measures
     4.12:1 and misses it. Figma specifies the label and that panel fill and outranks the default, so the
     colour is matched rather than lightened; `textSecondary` reaches 6.01:1 on `inset`. The operative fill
     is the panel's, not this component's — see the marker on `PlanConfirmDialog/index.styled` and entry 9
     of the accessible-colour register in `@styles/theme`. */
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },
  labelInline: {
    flexShrink: 1,
    lineHeight: LineHeight.META
  },
  value: {
    fontWeight: FontWeight.SEMIBOLD
  },
  valueLabel: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.LABEL
  },
  valueBody: {
    fontSize: FontSize.BODY,
    lineHeight: LineHeight.BODY_COMPACT
  },
  // The stacked variant is the Review answers card (34:98) — the one node where Figma authors a line height on
  // the value, 19.5, and the box its 2/0.5 insets close on at 22. Every other card leaves the value automatic,
  // so the authored box belongs here with those insets rather than on the size variant.
  valueStacked: {
    paddingTop: Sizes.ROW_VALUE_INSET_T,
    paddingBottom: Sizes.ROW_VALUE_INSET_B,
    lineHeight: LineHeight.ROW_VALUE
  },
  // No textAlign: every label and value across the three cards is drawn LEFT/TOP, and the right-hand look is
  // the row's own space-between against a hug-width value. Right-aligning would only show up once a value
  // wraps, and then against the design.
  valueInline: {
    flexShrink: 1
  },
  /* BLITZY [A11Y]: the overline carries the same `textMuted` as the label, so it reads 4.75:1 on the `card`
     call sites and would read 4.12:1 on PlanConfirmDialog's `inset` panel — no panel call site passes an
     overline today. Same disposition and same remedy as the label above; entry 9 of the register in
     `@styles/theme`. */
  overline: {
    marginBottom: Spacing.SMALL,
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    lineHeight: LineHeight.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  }
})

import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    // The pill hugs its label and the label never truncates (Figma declares no clamp), so at large text
    // sizes a long label such as "Estimated from ingredients" has to wrap instead of outgrowing the row it
    // sits in. Shrinking lets the pill give way so its label is re-measured against the narrower box and
    // wraps; the percentage caps it at the parent's inner width for the case where it is alone on a line.
    flexShrink: 1,
    maxWidth: '100%',
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.tile
  },
  pillWarning: {
    backgroundColor: Theme.colors.dangerTint
  },
  label: {
    flexShrink: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  /* The neutral tone above is the only BadgePill Figma draws (`49:551`): `tile` fill, `textSecondary`
     label, 6.40:1. The warning tone carries the catalog provenance estimates and is an inferred state with
     no Figma counterpart at all, so no drawn value governs its label and the WCAG 2.1 AA default does — at
     13px/600 the label is not large text, so it needs 4.5:1. `danger` on the `dangerTint` fill above
     reaches only 4.41:1, so the label is `text` instead, at 12.91:1. That is the pairing Figma already
     draws on this fill for the error banner's title, so the tone still uses only the drawn design
     language. `danger` on `dangerTint` remains correct where Figma does draw it — DeltaPill's grocery
     delta pill `37:273` + `37:274` — and is kept there; see the accessible-colour register in
     `@styles/theme`. `__tests__/index.styled.test.ts` pins both tones above 4.5:1. */
  labelWarning: {
    color: Theme.colors.text
  }
})

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
  /* BLITZY [A11Y]: the warning tone carries `danger` on the `dangerTint` fill above at 4.41:1, below the
     4.5:1 AA default. Unlike the rest of this register the pair is not drawn for a badge in Figma — the
     file contains no warning-tone pill and draws BadgePill only in its neutral form (`49:551`). The tone
     exists to carry the estimate labels the AAP requires in search and detail, and takes its colours from
     the one red-on-red pill the design does draw, the grocery delta pill `37:273` + `37:274`, because an
     inferred state must use only the drawn design language. It is upheld so the two pills stay one
     language: giving this label a different red, or the compliant `textSecondary` (5.95:1 on `dangerTint`),
     would leave two pills sharing a tint with different text colours — the isolated per-component change
     this review asked to avoid. Being inferred rather than specified, this is the easier of the two to move
     if a designer prefers. See the accessible-colour register in `@styles/theme`. */
  labelWarning: {
    color: Theme.colors.danger
  }
})

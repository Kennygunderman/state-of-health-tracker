import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    gap: Spacing.SMALL,
    borderRadius: BorderRadius.ITEM,
    borderWidth: Stroke.THIN,
    backgroundColor: Theme.colors.card,
    borderColor: Theme.colors.hairline
  },
  cardSelected: {
    backgroundColor: Theme.colors.greenTint,
    borderColor: Theme.colors.accentGreen
  },
  /* BLITZY [A11Y]: the unselected indicator implements Figma `46:180` exactly — a stroke-only `textDisabled`
     ring with no fill of its own, so the surface behind it shows through and the boundary measures 2.23:1
     against the `card` fill above (2.49:1 for a row sitting directly on the page), below the 3:1 non-text
     minimum. Figma specifies the ring and outranks that default, so it is matched rather than lightened;
     `textMuted` would clear the threshold at 4.75:1. WCAG 1.4.1 still holds: selection is carried by the
     card fill, the card stroke, the filled disc and tick that replace this ring, and the label weight —
     never by colour alone. The coordinated decision this shares with CheckboxSquare is recorded in the
     accessible-colour register in `@styles/theme`. */
  indicator: {
    width: Sizes.ICON_LG,
    height: Sizes.ICON_LG,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    borderWidth: Stroke.DEFAULT,
    borderColor: Theme.colors.textDisabled
  },
  /* BLITZY [A11Y]: the selected indicator implements Figma `46:172` exactly — an accent-green disc under
     `46:173`'s white check — which measures 2.45:1, below the 3:1 non-text minimum for a required glyph.
     Figma is the authoritative contract for this pair, so the values are matched rather than adjusted. The
     same accent-and-white pair is the checked-emphasis state of the shared CheckboxSquare and the added
     state of the food-search row, so changing it here alone would fork the selection language. Either
     remedy clears the threshold if a designer chooses one: a near-black glyph on the accent surface
     (`background` on `accentGreen` measures 7.67:1), or a darker selected surface keeping the white glyph.
     See the accessible-colour register in `@styles/theme`. */
  indicatorSelected: {
    backgroundColor: Theme.colors.accentGreen,
    borderColor: Theme.colors.accentGreen
  },
  textColumn: {
    flex: 1,
    gap: Spacing.MICRO
  },
  label: {
    fontSize: FontSize.H3,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  labelSelected: {
    fontWeight: FontWeight.BOLD
  },
  subcopy: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.OPTION_SUBCOPY,
    color: Theme.colors.textMuted
  },
  subcopySelected: {
    color: Theme.colors.textSecondary
  }
})

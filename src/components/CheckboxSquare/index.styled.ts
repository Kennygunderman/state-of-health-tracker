import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes, Stroke, Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  /* BLITZY [A11Y]: the unchecked box implements Figma `37:218` exactly — a stroke-only `textDisabled`
     outline with no fill — so it measures 2.23:1 against the `card` surface its rows sit on, below the 3:1
     non-text minimum. Figma specifies it and outranks that default, so it is matched rather than lightened
     (`textMuted` would reach 4.75:1). WCAG 1.4.1 holds: Figma gives the unchecked node no children at all,
     so checking the box adds both a fill and a tick rather than only changing a colour. The coordinated
     decision this shares with OptionCard is recorded in the register in `@styles/theme`. */
  container: {
    width: Sizes.ICON_LG,
    height: Sizes.ICON_LG,
    borderRadius: BorderRadius.CHECKBOX,
    borderWidth: Stroke.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Theme.colors.textDisabled
  },
  containerCheckedMuted: {
    backgroundColor: Theme.colors.track,
    borderColor: Theme.colors.track
  },
  /* BLITZY [A11Y]: the checked-emphasis fill implements Figma `37:262` exactly and carries `37:263`'s white
     tick at 2.45:1, below the 3:1 non-text minimum. Matched rather than adjusted because Figma specifies
     the pair, and because this is the shared selection language also rendered by OptionCard's selected
     indicator, the grocery flag row and the food-search added state — changing it here alone would fork
     that language. Remedies: a near-black glyph on the accent surface (`background` on `accentGreen`
     measures 7.67:1), or a darker checked surface keeping the white tick. See the register in
     `@styles/theme`. */
  containerCheckedEmphasis: {
    backgroundColor: Theme.colors.accentGreen,
    borderColor: Theme.colors.accentGreen
  },
  containerPending: {
    opacity: Opacity.DISABLED
  }
})

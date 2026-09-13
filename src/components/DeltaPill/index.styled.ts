import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.greenTint
  },
  containerDanger: {
    backgroundColor: Theme.colors.dangerTint
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.greenOnTint
  },
  labelPositive: {
    color: Theme.colors.text
  },
  /* BLITZY [A11Y]: the danger tone implements Figma `37:273` + `37:274` exactly — `danger` on the
     `dangerTint` fill above at 600/13px — measuring 4.41:1 against the 4.5:1 AA default, short by 0.09. The
     same label on the bare `card` surface measures 5.12:1, so the pill's own tint is what drops it below
     the threshold. Figma specifies the pair and outranks that default, so it is matched rather than
     lightened; `textSecondary` on `dangerTint` measures 5.95:1 but gives up the red semantic that marks an
     increase. BadgePill's warning tone carries this same pair, so a change belongs to both at once — see
     the accessible-colour register in `@styles/theme`. */
  labelDanger: {
    color: Theme.colors.danger
  }
})

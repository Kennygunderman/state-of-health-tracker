import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.MEDIUM,
    paddingBottom: Spacing.LARGE
  },
  eyebrow: {
    fontSize: FontSize.CAPTION,
    fontWeight: FontWeight.BOLD,
    letterSpacing: LetterSpacing.EYEBROW,
    color: Theme.colors.accentGreen
  },
  title: {
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    marginTop: Spacing.XX_SMALL
  },
  subtitle: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted,
    marginTop: Spacing.XX_SMALL
  },

  macroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG,
    padding: Spacing.GUTTER,
    marginTop: Spacing.GUTTER
  },
  legend: {
    flex: 1,
    marginLeft: Spacing.LARGE
  },
  provenanceCaption: {
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },

  servingsCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG,
    padding: Spacing.MEDIUM,
    marginTop: Spacing.SMALL
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  servingsLabel: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textSecondary
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  stepperButton: {
    width: Sizes.CONTROL_SM,
    height: Sizes.CONTROL_SM,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.inset,
    borderRadius: BorderRadius.TILE
  },
  stepperButtonText: {
    fontSize: FontSize.H2,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  stepperValue: {
    minWidth: Sizes.STEPPER_VALUE_MIN_W,
    textAlign: 'center',
    fontSize: FontSize.STAT,
    fontWeight: FontWeight.BOLD
  },

  fractionChipsRow: {
    flexDirection: 'row',
    marginTop: Spacing.MEDIUM
  },
  fractionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.X_SMALL,
    marginHorizontal: Spacing.XX_SMALL,
    backgroundColor: Theme.colors.inset,
    borderRadius: BorderRadius.PILL,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.inset
  },
  fractionChipSelected: {
    backgroundColor: Theme.colors.greenTint,
    borderColor: Theme.colors.accentGreen
  },
  fractionChipText: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textSecondary
  },
  fractionChipTextSelected: {
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },

  addsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.inset,
    borderRadius: BorderRadius.ITEM,
    paddingHorizontal: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL,
    marginTop: Spacing.SMALL
  },
  addsLabel: {
    fontSize: FontSize.LABEL,
    color: Theme.colors.textMuted
  },
  addsDetail: {
    fontSize: FontSize.LABEL,
    color: Theme.colors.textMuted
  },
  addsCalories: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },

  button: {
    marginTop: Spacing.MEDIUM
  }
})

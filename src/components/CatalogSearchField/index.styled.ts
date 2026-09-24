import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import {
  chevronInkOffsetAt,
  chevronInkShiftMargins,
  chevronSlotCollapse,
  ROW_CHEVRON,
  ROW_CHEVRON_REFERENCE_SIZE
} from '@components/icons/ChevronGeometry'

// Figma gives the trailing chevron a square 8px slot (`Sizes.CHEVRON_SLOT`, wrapper `47:283`, fixed on both
// axes) while the glyph itself paints larger than that slot and overhangs it on every side — neither the slot
// nor the glyph's own frame clips, and the overhang on the right is the arrow's point. Symmetric negative
// margins are what reconcile the two: they collapse the icon's reference-size layout footprint to the 8px
// square the row should reserve, while leaving the icon's own box its natural size so no ancestor of the
// artwork becomes a clipping parent. Both axes matter, and for different reasons — horizontally the collapse
// is what restores the label's 278px track, and vertically it is what stops the glyph's canvas from being the
// tallest item in the row: with it the row's content is the 18px label and the field measures Figma's 44px,
// without it the canvas sets the content height and the field stands 2px too tall. A fixed 8px wrapper would
// be the obvious alternative and is the wrong one: Android has clipped children to their parent's bounds
// regardless of `overflow`, and here that would square off the apex.
const CHEVRON_SLOT_OVERHANG = chevronSlotCollapse(ROW_CHEVRON_REFERENCE_SIZE, Sizes.CHEVRON_SLOT)

// Collapsing the footprint centres the ink in the 8px slot, and Figma does not centre it there: its rotated
// frame is centred on the slot but paints only the two edges facing the apex, leaving the ink 2.1213px to the
// right of the slot's centre and its point overhanging the field's padding edge by 1.6569px. Centred ink puts
// the point two whole pixel columns short of that and widens the visible right margin by 13.8%, so the
// difference is applied here rather than left in place. It belongs at this call site and not in the glyph:
// the artwork is shared with nine other rows whose slots are built differently, and shifting it there would
// move all of them on the evidence of this one node.
const CHEVRON_INK_SHIFT = chevronInkOffsetAt('right', ROW_CHEVRON, ROW_CHEVRON_REFERENCE_SIZE)

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.SMALL
  },
  /* BLITZY [A11Y]: the default boundary implements Figma `47:275` exactly — an `inputBorder` stroke on the
     `inset` fill — measuring 1.12:1, and the field is 1.28:1 against the page, so the resting field has no
     boundary identifiable at the 3:1 non-text minimum. Figma specifies both values, and every
     surface-to-surface pair in this palette sits below 1.5:1 by design, so only the stroke can move:
     `textFaint` as the border measures 3.31:1 and `textMuted` 4.12:1. The focused state below clears the
     threshold at 5.98:1, so this affects the resting state only. Shared with TextField — see the
     accessible-colour register in `@styles/theme`. */
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Sizes.CONTROL,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    gap: Spacing.X_SMALL,
    borderRadius: BorderRadius.PILL,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.inputBorder,
    backgroundColor: Theme.colors.inset
  },
  fieldFocused: {
    borderColor: Theme.colors.accentGreen
  },
  input: {
    flex: 1,
    padding: 0,
    borderRadius: 0,
    borderWidth: 0,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    backgroundColor: 'transparent'
  },
  valueLabel: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.text
  },
  /* BLITZY [A11Y]: the tap-target placeholder implements Figma `47:280` exactly and measures 3.31:1 on the
     `inset` fill, below the 4.5:1 AA default. The input mode reaches the same colour through the shared
     TextInput's `placeholderTextColor`, so both modes render one paint. Figma specifies it and outranks
     that default, so it is matched rather than lightened; `textSecondary` measures 6.01:1 here. See the
     accessible-colour register in `@styles/theme`. */
  placeholderLabel: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textFaint
  },
  /* BLITZY [A11Y]: the clear control implements Figma `47:369` + `47:370` exactly and misses the 3:1
     non-text minimum on both of its relationships — the `textDisabled` disc measures 1.94:1 against the
     field fill, and the `background` glyph below 2.49:1 against that disc. Figma specifies both, so they
     are matched rather than adjusted. Inverting the glyph to `white` on the existing disc measures 7.56:1
     and would clear the glyph relationship without touching the disc; lifting the disc itself needs a
     fill lighter than `textDisabled`. See the accessible-colour register in `@styles/theme`. */
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: Sizes.ICON,
    height: Sizes.ICON,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.textDisabled
  },
  clearGlyph: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.background
  },
  chevronSlot: {
    marginTop: CHEVRON_SLOT_OVERHANG,
    marginBottom: CHEVRON_SLOT_OVERHANG,
    ...chevronInkShiftMargins(CHEVRON_SLOT_OVERHANG, CHEVRON_INK_SHIFT)
  },
  cancelLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  }
})

import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

import hostStyles from '@screens/Macros/index.styled'

import planHeaderStyles from '../components/PlanHeader/index.styled'
import styles, {emptyRegion} from '../index.styled'

// The plan-week switch has no derivation of its own: whether its target reaches 44 — and whether the label and
// the plan content below it stay where they were drawn — is decided entirely by the style objects it renders,
// because RN clips a hitSlop at the parent's bounds and the row is label-height.
const planSwitchRow = StyleSheet.flatten<ViewStyle>(styles.planSwitchRow)
const planSwitchButton = StyleSheet.flatten<ViewStyle>(styles.planSwitchButton)
const planSwitchLink = StyleSheet.flatten<TextStyle>(styles.planSwitchLink)
const dayStripContainer = StyleSheet.flatten<ViewStyle>(styles.dayStripContainer)
const bannerContainer = StyleSheet.flatten<ViewStyle>(styles.bannerContainer)

// PlanHeader's own stylesheet is read here, across the folder boundary, because the requirement is that the
// four variants this tab renders into one header slot agree on their top offset: only the parent that owns the
// slot sees all four, and a per-component test could never state it. The host's stylesheet is read for the
// same reason: the empty region's give-back is only correct while it equals the padding the host actually has.
const planHeaderRow = StyleSheet.flatten<ViewStyle>(planHeaderStyles.row)
const planHeaderTitleBlock = StyleSheet.flatten<ViewStyle>(planHeaderStyles.titleBlock)
const macrosHeader = StyleSheet.flatten<ViewStyle>(styles.macrosHeader)
const skeletonHeaderRow = StyleSheet.flatten<ViewStyle>(styles.skeletonHeaderRow)
const hostDateOverlineTouchable = StyleSheet.flatten<ViewStyle>(hostStyles.dateOverlineTouchable)
const hostScrollContent = StyleSheet.flatten<ViewStyle>(hostStyles.scrollContent)

// Guarded rather than cast, and read inside the tests rather than at module scope: a style value that stops
// being a number — dropped, or authored as a percentage string — has to fail the assertion that states what it
// is for, instead of being scored as `undefined` or crashing the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const switchMinHeight = (): number =>
  resolvedNumber(planSwitchButton.minHeight, "the plan switch envelope's minimum height")

const switchLabelInset = (): number =>
  resolvedNumber(planSwitchButton.paddingTop, "the plan switch envelope's top inset, which draws the label")

const rowMarginBottom = (): number =>
  resolvedNumber(planSwitchRow.marginBottom, "the plan switch row's bottom margin, which offsets the envelope")

const dayStripMarginTop = (): number => resolvedNumber(dayStripContainer.marginTop, "the day strip's top margin")

const headerOffsetAboveRow = (): number =>
  resolvedNumber(planHeaderRow.marginTop, "the plan header row's top margin, which opens the header slot")

const headerOffsetInsideTitleBlock = (): number =>
  resolvedNumber(planHeaderTitleBlock.paddingTop, "the plan header title block's own top padding")

// What the eye reads as the header's top offset: everything between the slot boundary and the overline's text
// box, wherever it is declared.
const planHeaderTopOffset = (): number => headerOffsetAboveRow() + headerOffsetInsideTitleBlock()

const hostScrollBottomPadding = (): number =>
  resolvedNumber(hostScrollContent.paddingBottom, "the host scroll content's bottom padding")

// A height with no relationship to any token or to the padding under test, so a factory that dropped the
// measurement, clamped it or folded the padding into it cannot coincidentally satisfy the assertion.
const MEASURED_REGION_HEIGHT = 515

const measuredRegion = (): ViewStyle => StyleSheet.flatten<ViewStyle>(emptyRegion(MEASURED_REGION_HEIGHT))

const regionMarginBottom = (): number =>
  resolvedNumber(measuredRegion().marginBottom, "the empty region's bottom margin, which returns the host padding")

// The geometry the switch had before it became a real target: `Spacing.X_SMALL` was the row's `marginTop`,
// `LineHeight.LABEL` is the box a single line of `FontSize.LABEL` text resolves to, and `Spacing.MEDIUM` opens
// the plan content that follows the switch in every state where the switch renders.
const PREVIOUS_LABEL_INSET: number = Spacing.X_SMALL
const PREVIOUS_CONTENT_OFFSET: number = PREVIOUS_LABEL_INSET + LineHeight.LABEL + Spacing.MEDIUM

// Where that content opens now: the envelope's height, less what the row gives back, plus the margin the
// content opens with.
const contentOffset = (): number => switchMinHeight() + rowMarginBottom() + dayStripMarginTop()

describe('the header slot the tab renders every state into', () => {
  // The finding this pins is a jump, not a static offset: the slot holds PlanHeader on 11/11b, the loading
  // skeleton's header and the Macros header, and the Diary the tab switches to opens its own header in the
  // host, so any variant that disagrees shifts the title on loading→plan, empty→plan or Diary→Meal Plan.
  it('opens every variant at one offset, so switching state never moves the title', () => {
    expect(planHeaderTopOffset()).toBe(Spacing.MEDIUM)
    expect(macrosHeader.marginTop).toBe(Spacing.MEDIUM)
    expect(skeletonHeaderRow.marginTop).toBe(Spacing.MEDIUM)
    expect(hostDateOverlineTouchable.marginTop).toBe(Spacing.MEDIUM)
  })

  // Half above, half inside — the split Figma authors — and it is load-bearing rather than cosmetic: the row
  // centres the grocery target on the title block's hug, so an offset moved inside the block is halved by that
  // centring and lifts the disc. Pinning both halves keeps a future change from silently redistributing them.
  it('keeps half of that offset above the row, where it cannot move the grocery target', () => {
    expect(headerOffsetInsideTitleBlock()).toBe(Spacing.X_SMALL)
    expect(headerOffsetAboveRow()).toBe(Spacing.X_SMALL)
  })

  it('supplies its half once, as a margin above the row rather than padding inside it', () => {
    expect(planHeaderRow.padding).toBeUndefined()
    expect(planHeaderRow.paddingVertical).toBeUndefined()
    expect(planHeaderRow.paddingTop).toBeUndefined()
  })
})

describe('the plan week switch envelope', () => {
  it('is a full 44 px target rather than a label-height row with hit slop', () => {
    expect(switchMinHeight()).toBe(Sizes.TOUCH_TARGET)
  })

  // Centring a 16 px label in 44 would drop it 6 px below where the row's margin drew it, which is half of the
  // displacement the review reported: the envelope is therefore top-aligned on that same inset.
  it('draws the label at exactly the inset the row margin it replaced gave it', () => {
    expect(planSwitchButton.justifyContent).toBe('flex-start')
    expect(switchLabelInset()).toBe(PREVIOUS_LABEL_INSET)
  })

  it('contains the whole label box inside the target, so none of the text sits outside it', () => {
    expect(switchLabelInset() + LineHeight.LABEL).toBeLessThanOrEqual(switchMinHeight())
  })

  it('grows with the text size instead of pinning a height that would clip a scaled label', () => {
    expect(planSwitchButton.height).toBeUndefined()
    expect(planSwitchButton.maxHeight).toBeUndefined()
  })

  it('adds no horizontal padding, keeping the label flush with the gutter edge the row aligns to', () => {
    expect(planSwitchButton.padding).toBeUndefined()
    expect(planSwitchButton.paddingHorizontal).toBeUndefined()
    expect(planSwitchButton.paddingLeft).toBeUndefined()
    expect(planSwitchButton.paddingRight).toBeUndefined()
  })
})

describe('the row that holds it', () => {
  it('still right-aligns the single link it lays out', () => {
    expect(planSwitchRow.flexDirection).toBe('row')
    expect(planSwitchRow.justifyContent).toBe('flex-end')
  })

  it('no longer carries the top margin the envelope inset now supplies', () => {
    expect(planSwitchRow.margin).toBeUndefined()
    expect(planSwitchRow.marginTop).toBeUndefined()
    expect(planSwitchRow.marginVertical).toBeUndefined()
  })

  it('gives back exactly the margin the plan content below opens with', () => {
    expect(rowMarginBottom()).toBe(-dayStripMarginTop())
  })

  it('hosts the label the switch actually draws, at the label type size', () => {
    expect(planSwitchLink.fontSize).toBe(FontSize.LABEL)
    expect(switchMinHeight()).toBeGreaterThan(LineHeight.LABEL)
  })
})

describe('the plan content that follows the switch', () => {
  // The review's finding was a 20 px displacement: a 44 px envelope added on top of the space the switch already
  // occupied. What the layout may honestly gain is the amount by which the mandated target exceeds that space,
  // and nothing beyond it — 4 px here, and provably the floor, since both of the switch's neighbours (the
  // segmented control above, the day chips below) are themselves pressable and may not be overlapped.
  it('sits no further down than the 44 px target itself requires', () => {
    expect(PREVIOUS_CONTENT_OFFSET).toBe(Spacing.X_SMALL + LineHeight.LABEL + Spacing.MEDIUM)
    expect(contentOffset()).toBe(Sizes.TOUCH_TARGET)
    expect(contentOffset() - PREVIOUS_CONTENT_OFFSET).toBe(Sizes.TOUCH_TARGET - PREVIOUS_CONTENT_OFFSET)
  })

  // An envelope that only stacked on top of the switch's former space — a 44 px box whose own bottom margin the
  // following block then added to — is the displacement the review reported, and it stays a failure here.
  it('gains a fraction of what stacking the envelope on the old spacing would have cost', () => {
    const stackedOffset = Sizes.TOUCH_TARGET + dayStripMarginTop()

    expect(contentOffset()).toBeLessThan(stackedOffset)
    expect(stackedOffset - contentOffset()).toBe(dayStripMarginTop())
  })

  it('opens at the envelope edge, so nothing is drawn over the target', () => {
    expect(contentOffset()).toBeGreaterThanOrEqual(switchMinHeight())
  })

  // The negative margin is only safe while every first child of the plan body opens with the margin it cancels.
  // Both of them do, and a change to either has to fail here rather than silently overlap the target.
  it('opens with that same margin whichever block the plan body leads with', () => {
    expect(dayStripMarginTop()).toBe(Spacing.MEDIUM)
    expect(bannerContainer.marginTop).toBe(Spacing.MEDIUM)
  })
})

describe('the region the no-plan state centres in', () => {
  it('centres the block in exactly the height the tab measured for it', () => {
    expect(measuredRegion().minHeight).toBe(MEASURED_REGION_HEIGHT)
    expect(measuredRegion().justifyContent).toBe('center')
  })

  // The measurement runs from the region's top to the tab bar's top edge, which is where the frame draws the
  // block's box. Deducting the host's scroll padding from it instead — what left the block half that padding
  // high with the rest dead below — has to fail here: the height is passed through untouched and the padding
  // comes back as a margin under the region, which is the last thing the host lays out.
  it('returns the host scroll padding below itself rather than deducting it from that height', () => {
    expect(regionMarginBottom()).toBe(-hostScrollBottomPadding())
    expect(measuredRegion().minHeight).not.toBe(MEASURED_REGION_HEIGHT - hostScrollBottomPadding())
  })

  it('leaves the block free to outgrow the measurement when the text scales up', () => {
    expect(measuredRegion().height).toBeUndefined()
    expect(measuredRegion().maxHeight).toBeUndefined()
  })
})

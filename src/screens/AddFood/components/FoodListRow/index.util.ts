import {ADD_FOOD_ROW_LABEL_SEPARATOR, CAL_LABEL} from '@constants/strings'

// Must stay in step with BadgePill's tone prop — FoodListRow passes this value straight through
export type FoodListRowBadgeTone = 'neutral' | 'warning'

export interface FoodListRowBadge {
  label: string
  tone: FoodListRowBadgeTone
}

export type FoodListRowBadgeVariant = 'none' | FoodListRowBadgeTone

export const resolveBadgeVariant = (badge?: FoodListRowBadge | null): FoodListRowBadgeVariant =>
  badge ? badge.tone : 'none'

export interface FoodListRowLabelParts {
  name: string
  detail?: string | null
  subtitle?: string | null
  calories: number
  badge?: FoodListRowBadge | null
}

const isSpokenPart = (part: string | null | undefined): part is string =>
  typeof part === 'string' && part.trim().length > 0

/**
 * The row's accessible name, in the order a sighted user reads it: the food, its serving detail, its
 * provenance pill, its second line, then its calories.
 *
 * A pressable row is one accessible element, so assistive technology announces a single name rather than the
 * five text nodes inside it — the name therefore has to restate every one of them, including the pill, which
 * would otherwise be the one fact only sighted users get. Parts the row does not draw are dropped together
 * with their separator, and the calorie value is rounded exactly as the row rounds it.
 */
export const foodListRowAccessibilityLabel = ({
  name,
  detail,
  badge,
  subtitle,
  calories
}: FoodListRowLabelParts): string =>
  [name, detail, badge?.label, subtitle, `${Math.round(calories)} ${CAL_LABEL}`]
    .filter(isSpokenPart)
    .join(ADD_FOOD_ROW_LABEL_SEPARATOR)

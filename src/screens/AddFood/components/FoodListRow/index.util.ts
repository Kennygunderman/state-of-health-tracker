// Must stay in step with BadgePill's tone prop — FoodListRow passes this value straight through
export type FoodListRowBadgeTone = 'neutral' | 'warning'

export interface FoodListRowBadge {
  label: string
  tone: FoodListRowBadgeTone
}

export type FoodListRowBadgeVariant = 'none' | FoodListRowBadgeTone

export const resolveBadgeVariant = (badge?: FoodListRowBadge | null): FoodListRowBadgeVariant =>
  badge ? badge.tone : 'none'

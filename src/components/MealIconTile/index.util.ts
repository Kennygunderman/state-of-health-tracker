import {ComponentType} from 'react'

import {RecipeIconKey} from '@data/models/Recipe'
import {Sizes, Stroke} from '@styles/sizes'

import HeroClocheIcon from '@components/icons/HeroClocheIcon'
import HeroPotIcon from '@components/icons/HeroPotIcon'
import {IconProps} from '@components/icons/IconProps'
import MealBowlDashIcon from '@components/icons/MealBowlDashIcon'
import MealBowlIcon from '@components/icons/MealBowlIcon'
import MealCircleWaveIcon from '@components/icons/MealCircleWaveIcon'
import MealCrosshairIcon from '@components/icons/MealCrosshairIcon'
import MealDomeLargeIcon from '@components/icons/MealDomeLargeIcon'
import MealForkKnifeIcon from '@components/icons/MealForkKnifeIcon'
import MealWrapIcon from '@components/icons/MealWrapIcon'

const ICON_COMPONENTS: Record<RecipeIconKey, ComponentType<IconProps>> = {
  crosshair: MealCrosshairIcon,
  fork_knife: MealForkKnifeIcon,
  bowl: MealBowlIcon,
  wrap: MealWrapIcon,
  dome: MealDomeLargeIcon,
  salad: MealCircleWaveIcon,
  bowl_dash: MealBowlDashIcon,
  pot: HeroPotIcon,
  cloche: HeroClocheIcon
}

// The seven flat glyphs draw in a 24-unit viewBox but render at the hero tile,
// so their stroke scales by 24/76 to hold the hero stroke-to-size ratio.
const FLAT_GLYPH_HERO_STROKE: number = (Stroke.HERO_ART * Sizes.ICON_XL) / Sizes.HERO_TILE

export const iconComponentFor = (key: RecipeIconKey | string): ComponentType<IconProps> =>
  ICON_COMPONENTS[key as RecipeIconKey] ?? MealBowlIcon

export const heroStrokeFor = (key: RecipeIconKey | string): number => {
  if (key === 'pot') return Stroke.HERO_ART
  if (key === 'cloche') return Stroke.HERO_ART_CLOCHE

  return FLAT_GLYPH_HERO_STROKE
}

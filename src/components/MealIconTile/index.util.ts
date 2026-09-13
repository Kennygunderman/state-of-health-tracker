import {ComponentType} from 'react'

import {RecipeIconKey} from '@data/models/Recipe'
import {Sizes, Stroke} from '@styles/sizes'

import HeroClocheIcon, {CLOCHE_CARD_STROKE} from '@components/icons/HeroClocheIcon'
import HeroPotIcon, {POT_CARD_STROKE} from '@components/icons/HeroPotIcon'
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

// strokeWidth is in viewBox units, so a glyph's tile stroke is its own value for a Sizes.ICON_XL
// canvas: Stroke.MEAL_GLYPH for the 24-unit flat glyphs, and for pot and cloche the 76- and 70-unit
// equivalents they export. A tile that renders the glyph smaller scales all three by the same factor,
// so the mark keeps one weight across the tile sizes. This is the card weight the plan and swap tiles
// draw — 1.6 px on the lg tile (nodes 46:60, 49:185, 46:91) and 1.2 px on the md tile (frames 13, 13d
// and 13e). Frames 07 and 15 draw the same glyphs a step heavier; that is opticalTileStrokeFor.
export const tileStrokeFor = (key: RecipeIconKey | string): number => {
  if (key === 'pot') return POT_CARD_STROKE
  if (key === 'cloche') return CLOCHE_CARD_STROKE

  return Stroke.MEAL_GLYPH
}

// The schedule rows (frame 07) and the Log-meal recipe card (frame 15, node 38:38) carry the heavier
// Stroke.MEAL_GLYPH_TILE mark rather than the card weight above. That is a target measured on screen,
// and strokeWidth is in viewBox units — a stroke of w drawn on a canvas of glyphSize renders at
// w * glyphSize / viewBoxUnits — so the number differs per glyph family and per tile size. Dividing
// each family's viewBox by the canvas it is drawn on inverts that relation, so the mark lands at
// exactly Stroke.MEAL_GLYPH_TILE whichever glyph and tile a screen asks for, and no caller outside
// this component has to know a glyph's viewBox to request the optical weight.
export const opticalTileStrokeFor = (key: RecipeIconKey | string, glyphSize: number): number => {
  if (key === 'pot') return (Stroke.MEAL_GLYPH_TILE * Sizes.HERO_TILE) / glyphSize
  if (key === 'cloche') return (Stroke.MEAL_GLYPH_TILE * Sizes.HERO_TILE_SM) / glyphSize

  return (Stroke.MEAL_GLYPH_TILE * Sizes.ICON_XL) / glyphSize
}

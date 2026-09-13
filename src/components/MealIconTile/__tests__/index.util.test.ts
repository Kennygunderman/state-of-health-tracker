import {RECIPE_ICON_KEYS, RecipeIconKey} from '@data/models/Recipe'
import {Sizes, Stroke} from '@styles/sizes'

import HeroClocheIcon, {CLOCHE_CARD_STROKE} from '@components/icons/HeroClocheIcon'
import HeroPotIcon, {POT_CARD_STROKE} from '@components/icons/HeroPotIcon'
import MealBowlDashIcon from '@components/icons/MealBowlDashIcon'
import MealBowlIcon from '@components/icons/MealBowlIcon'
import MealCircleWaveIcon from '@components/icons/MealCircleWaveIcon'
import MealCrosshairIcon from '@components/icons/MealCrosshairIcon'
import MealDomeLargeIcon from '@components/icons/MealDomeLargeIcon'
import MealForkKnifeIcon from '@components/icons/MealForkKnifeIcon'
import MealWrapIcon from '@components/icons/MealWrapIcon'

import {heroStrokeFor, iconComponentFor, opticalTileStrokeFor, tileStrokeFor} from '../index.util'

// Each glyph declares its own viewBox, and strokeWidth is expressed in those units.
const GLYPH_VIEW_BOX: number = Sizes.ICON_XL
const POT_VIEW_BOX: number = Sizes.HERO_TILE
const CLOCHE_VIEW_BOX: number = Sizes.HERO_TILE_SM

// The card weight the md tile (Sizes.ICON canvas) must put on screen for every key: 1.2 px, which is
// what frames 13, 13d and 13e draw. Frames 07 and 15 ask for the heavier optical mark instead, and
// that target is Stroke.MEAL_GLYPH_TILE — asserted against opticalTileStrokeFor below.
const MD_TILE_RENDERED_STROKE: number = (Stroke.MEAL_GLYPH * Sizes.ICON) / Sizes.ICON_XL

const viewBoxFor = (key: RecipeIconKey): number => {
  if (key === 'pot') return POT_VIEW_BOX
  if (key === 'cloche') return CLOCHE_VIEW_BOX

  return GLYPH_VIEW_BOX
}

describe('iconComponentFor', () => {
  it('maps crosshair to the crosshair glyph', () => {
    expect(iconComponentFor('crosshair')).toBe(MealCrosshairIcon)
  })

  it('maps fork_knife to the fork-and-knife glyph', () => {
    expect(iconComponentFor('fork_knife')).toBe(MealForkKnifeIcon)
  })

  it('maps bowl to the bowl glyph', () => {
    expect(iconComponentFor('bowl')).toBe(MealBowlIcon)
  })

  it('maps wrap to the wrap glyph', () => {
    expect(iconComponentFor('wrap')).toBe(MealWrapIcon)
  })

  it('maps dome to the large dome glyph, not the cloche', () => {
    expect(iconComponentFor('dome')).toBe(MealDomeLargeIcon)
  })

  it('maps salad to the circle-wave glyph', () => {
    expect(iconComponentFor('salad')).toBe(MealCircleWaveIcon)
  })

  it('maps bowl_dash to the dashed bowl glyph, not the plain bowl', () => {
    expect(iconComponentFor('bowl_dash')).toBe(MealBowlDashIcon)
  })

  it('maps pot to the hero pot glyph', () => {
    expect(iconComponentFor('pot')).toBe(HeroPotIcon)
  })

  it('maps cloche to the hero cloche glyph', () => {
    expect(iconComponentFor('cloche')).toBe(HeroClocheIcon)
  })

  it('falls back to the bowl glyph for an unknown key', () => {
    expect(iconComponentFor('taco')).toBe(MealBowlIcon)
  })

  it('falls back to the bowl glyph for an empty key', () => {
    expect(iconComponentFor('')).toBe(MealBowlIcon)
  })

  it('is case-sensitive and falls back for a capitalised key', () => {
    expect(iconComponentFor('Bowl')).toBe(MealBowlIcon)
  })
})

describe('heroStrokeFor', () => {
  it('returns the hero art stroke for the pot glyph', () => {
    expect(heroStrokeFor('pot')).toBe(Stroke.HERO_ART)
  })

  it('returns the cloche hero stroke for the cloche glyph', () => {
    expect(heroStrokeFor('cloche')).toBe(Stroke.HERO_ART_CLOCHE)
  })

  it('scales the hero art stroke to the flat glyph viewBox for an unrecognised key', () => {
    expect(heroStrokeFor('taco')).toBeCloseTo((Stroke.HERO_ART * Sizes.ICON_XL) / Sizes.HERO_TILE, 5)
  })
})

describe('tileStrokeFor', () => {
  it('returns the pot card stroke for the pot glyph, not its hero stroke', () => {
    expect(tileStrokeFor('pot')).toBe(POT_CARD_STROKE)
  })

  it('returns the cloche card stroke for the cloche glyph, not its hero stroke', () => {
    expect(tileStrokeFor('cloche')).toBe(CLOCHE_CARD_STROKE)
  })

  it('returns the meal glyph stroke for a flat glyph', () => {
    expect(tileStrokeFor('crosshair')).toBe(Stroke.MEAL_GLYPH)
  })

  it('falls back to the flat glyph stroke for an unknown key, matching the bowl glyph it renders', () => {
    expect(tileStrokeFor('taco')).toBe(Stroke.MEAL_GLYPH)
  })

  it('falls back to the flat glyph stroke for an empty key', () => {
    expect(tileStrokeFor('')).toBe(Stroke.MEAL_GLYPH)
  })

  it.each(RECIPE_ICON_KEYS)('renders the md tile card stroke for %s, as frames 13 and 13e draw it', key => {
    expect((tileStrokeFor(key) * Sizes.ICON) / viewBoxFor(key)).toBeCloseTo(MD_TILE_RENDERED_STROKE, 5)
  })

  it.each(RECIPE_ICON_KEYS)('renders the full meal glyph stroke on the lg tile for %s', key => {
    expect((tileStrokeFor(key) * Sizes.ICON_XL) / viewBoxFor(key)).toBeCloseTo(Stroke.MEAL_GLYPH, 5)
  })

  it.each(RECIPE_ICON_KEYS)('draws %s lighter than the optical mark frames 07 and 15 carry', key => {
    expect(tileStrokeFor(key)).toBeLessThan(opticalTileStrokeFor(key, Sizes.ICON))
  })
})

describe('opticalTileStrokeFor', () => {
  // Node 38:38 (frame 15) and the frame 07 schedule rows carry Stroke.MEAL_GLYPH_TILE on screen. The
  // helper answers in viewBox units, so what matters is what those units render to on the tile's canvas.
  it.each(RECIPE_ICON_KEYS)('puts the optical mark on screen for %s on the md tile', key => {
    expect((opticalTileStrokeFor(key, Sizes.ICON) * Sizes.ICON) / viewBoxFor(key)).toBeCloseTo(
      Stroke.MEAL_GLYPH_TILE,
      5
    )
  })

  it.each(RECIPE_ICON_KEYS)('holds the optical mark for %s when the tile draws the glyph larger', key => {
    expect((opticalTileStrokeFor(key, Sizes.ICON_XL) * Sizes.ICON_XL) / viewBoxFor(key)).toBeCloseTo(
      Stroke.MEAL_GLYPH_TILE,
      5
    )
  })

  it('scales the flat glyph viewBox to the md canvas', () => {
    expect(opticalTileStrokeFor('crosshair', Sizes.ICON)).toBeCloseTo(
      (Stroke.MEAL_GLYPH_TILE * Sizes.ICON_XL) / Sizes.ICON,
      5
    )
  })

  it('scales the pot and cloche viewBoxes, which are neither the flat glyphs nor each other', () => {
    expect(opticalTileStrokeFor('pot', Sizes.ICON)).toBeCloseTo(
      (Stroke.MEAL_GLYPH_TILE * Sizes.HERO_TILE) / Sizes.ICON,
      5
    )
    expect(opticalTileStrokeFor('cloche', Sizes.ICON)).toBeCloseTo(
      (Stroke.MEAL_GLYPH_TILE * Sizes.HERO_TILE_SM) / Sizes.ICON,
      5
    )
    expect(opticalTileStrokeFor('pot', Sizes.ICON)).not.toBeCloseTo(opticalTileStrokeFor('cloche', Sizes.ICON), 5)
  })

  it('falls back to the flat glyph scaling for an unknown key, matching the bowl glyph it renders', () => {
    expect(opticalTileStrokeFor('taco', Sizes.ICON)).toBe(opticalTileStrokeFor('bowl', Sizes.ICON))
    expect(opticalTileStrokeFor('', Sizes.ICON)).toBe(opticalTileStrokeFor('bowl', Sizes.ICON))
  })
})

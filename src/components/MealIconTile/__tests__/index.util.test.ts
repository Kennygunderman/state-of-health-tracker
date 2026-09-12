import {Sizes, Stroke} from '@styles/sizes'

import HeroClocheIcon from '@components/icons/HeroClocheIcon'
import HeroPotIcon from '@components/icons/HeroPotIcon'
import MealBowlDashIcon from '@components/icons/MealBowlDashIcon'
import MealBowlIcon from '@components/icons/MealBowlIcon'
import MealCircleWaveIcon from '@components/icons/MealCircleWaveIcon'
import MealCrosshairIcon from '@components/icons/MealCrosshairIcon'
import MealDomeLargeIcon from '@components/icons/MealDomeLargeIcon'
import MealForkKnifeIcon from '@components/icons/MealForkKnifeIcon'
import MealWrapIcon from '@components/icons/MealWrapIcon'

import {heroStrokeFor, iconComponentFor} from '../index.util'

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

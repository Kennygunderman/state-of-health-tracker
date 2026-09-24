import {CHIP_PILL_WIDTHS} from './index.styled'

export interface ChipPlaceholder {
  readonly key: string
  readonly width: number
}

/**
 * One placeholder per chip the loaded cloud will hold, each carrying the width it renders at.
 *
 * The widths cycle rather than repeat, so the placeholder cloud wraps like the answer it stands for instead
 * of like a row of identical blocks. A count of zero yields nothing: a cloud with no chips has nothing to
 * stand in for, and a placeholder for it would occupy space the loaded state never will.
 */
export const chipPlaceholders = (count: number): ChipPlaceholder[] =>
  Array.from({length: Math.max(count, 0)}, (_unused, index) => ({
    key: `allergen-placeholder-${index}`,
    width: CHIP_PILL_WIDTHS[index % CHIP_PILL_WIDTHS.length]
  }))

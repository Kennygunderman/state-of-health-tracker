import {SUBCOPY_BAR_TAIL_WIDTH, SUBCOPY_BAR_WIDTH} from './index.styled'

// How many sub-copy lines a placeholder card reserves. Two is the most any option in the setup flow wraps to
// at the reference width, and none is the plain label row the diet cards and the log screen's slot picker
// draw — so the union is the set of card shapes that exist rather than an open count.
export type OptionCardSkeletonSubcopyLines = 0 | 1 | 2

export interface SubcopyLineDescriptor {
  readonly key: string
  readonly width: number
  readonly isStretched: boolean
}

// Keys rather than indices, so a line's identity does not change when a card's line count does.
const SUBCOPY_LINE_KEYS: readonly string[] = Object.freeze(['first', 'second'])

/**
 * The sub-copy placeholder lines a card of this shape renders, in order.
 *
 * Every line but the last of several fills the column; the last of several is the short tail a wrapped
 * sentence ends on. A placeholder that ran the full width on both lines would read as text breaking exactly
 * at the column on every line, which no sentence does — and a single-line card has no tail, because its one
 * line is the sentence.
 */
export const subcopyLineDescriptors = (lines: OptionCardSkeletonSubcopyLines): SubcopyLineDescriptor[] =>
  SUBCOPY_LINE_KEYS.slice(0, lines).map((key, index) => {
    const isTail = lines > 1 && index === lines - 1

    return {
      key,
      width: isTail ? SUBCOPY_BAR_TAIL_WIDTH : SUBCOPY_BAR_WIDTH,
      isStretched: !isTail
    }
  })

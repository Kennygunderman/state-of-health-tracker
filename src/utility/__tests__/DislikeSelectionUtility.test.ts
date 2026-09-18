import {isDislikeSelectionAtCap, MAX_DISLIKED_FOOD_IDS, refusesDislikeSelection} from '@utility/DislikeSelectionUtility'

const ids = (count: number, prefix = 'food'): string[] =>
  Array.from({length: count}, (_, index) => `${prefix}-${index}`)

describe('MAX_DISLIKED_FOOD_IDS', () => {
  it('is the hundred distinct ids the dislikes save accepts', () => {
    expect(MAX_DISLIKED_FOOD_IDS).toBe(100)
  })
})

describe('isDislikeSelectionAtCap', () => {
  it('leaves room below the cap', () => {
    expect(isDislikeSelectionAtCap(ids(MAX_DISLIKED_FOOD_IDS - 1))).toBe(false)
  })

  it('reports the cap once it is reached', () => {
    expect(isDislikeSelectionAtCap(ids(MAX_DISLIKED_FOOD_IDS))).toBe(true)
  })

  // A selection stored before this bound existed, or raised by an answer landing mid-visit, is already past
  // it — the notice belongs on screen there too, not only at exactly the cap.
  it('reports the cap for a selection already past it', () => {
    expect(isDislikeSelectionAtCap(ids(MAX_DISLIKED_FOOD_IDS + 5))).toBe(true)
  })

  it('leaves room for an empty selection', () => {
    expect(isDislikeSelectionAtCap([])).toBe(false)
  })
})

// Both setup screens that add dislikes — the suggestions cloud on 06 and the search list on 06b — render the
// cap caption from this one predicate, so its lifecycle over a selection that reaches the bound and then comes
// back under it is what decides whether the caption appears and clears on either screen.
describe('the cap notice the dislike screens render', () => {
  it('appears once the selection reaches the cap and clears after a removal', () => {
    const atCap = ids(MAX_DISLIKED_FOOD_IDS)

    expect(isDislikeSelectionAtCap(atCap)).toBe(true)
    expect(isDislikeSelectionAtCap(atCap.slice(1))).toBe(false)
  })

  // One removal from a selection stored above the bound lands back on the cap, which is still the state the
  // caption describes: the next addition is refused. It clears only once the selection is genuinely below.
  it('stays for the removal that only brings a selection past the cap back to it', () => {
    const pastCap = ids(MAX_DISLIKED_FOOD_IDS + 1)

    expect(isDislikeSelectionAtCap(pastCap)).toBe(true)
    expect(isDislikeSelectionAtCap(pastCap.slice(1))).toBe(true)
    expect(isDislikeSelectionAtCap(pastCap.slice(2))).toBe(false)
  })

  it('agrees with the reducers about what the next addition does', () => {
    const atCap = ids(MAX_DISLIKED_FOOD_IDS)
    const underCap = atCap.slice(1)

    expect(isDislikeSelectionAtCap(atCap)).toBe(refusesDislikeSelection([...atCap, 'one-more'], atCap))
    expect(isDislikeSelectionAtCap(underCap)).toBe(refusesDislikeSelection([...underCap, 'one-more'], underCap))
  })
})

describe('refusesDislikeSelection', () => {
  describe('additions', () => {
    it('allows the one that fills the last place', () => {
      const current = ids(MAX_DISLIKED_FOOD_IDS - 1)

      expect(refusesDislikeSelection([...current, 'one-more'], current)).toBe(false)
    })

    it('refuses the one past the cap', () => {
      const current = ids(MAX_DISLIKED_FOOD_IDS)

      expect(refusesDislikeSelection([...current, 'one-too-many'], current)).toBe(true)
    })

    // Distinctness is what the server counts, so a proposal that grows the array without growing the set of
    // ids is not over the bound.
    it('counts distinct ids rather than entries', () => {
      const current = ids(MAX_DISLIKED_FOOD_IDS)

      expect(refusesDislikeSelection([...current, current[0]], current)).toBe(false)
    })
  })

  describe('everything that does not grow the selection', () => {
    it('allows a removal at the cap', () => {
      const current = ids(MAX_DISLIKED_FOOD_IDS)

      expect(refusesDislikeSelection(current.slice(1), current)).toBe(false)
    })

    // The way back under the bound has to stay open for a selection stored above it.
    it('allows a removal from a selection already past the cap', () => {
      const current = ids(MAX_DISLIKED_FOOD_IDS + 3)

      expect(refusesDislikeSelection(current.slice(1), current)).toBe(false)
    })

    it('allows a swap that keeps the size', () => {
      const current = ids(MAX_DISLIKED_FOOD_IDS)

      expect(refusesDislikeSelection([...current.slice(1), 'replacement'], current)).toBe(false)
    })

    it('allows an unchanged selection past the cap', () => {
      const current = ids(MAX_DISLIKED_FOOD_IDS + 1)

      expect(refusesDislikeSelection([...current], current)).toBe(false)
    })
  })

  describe('a selection replaced wholesale', () => {
    it('allows exactly the cap', () => {
      expect(refusesDislikeSelection(ids(MAX_DISLIKED_FOOD_IDS, 'next'), [])).toBe(false)
    })

    it('refuses one more than the cap', () => {
      expect(refusesDislikeSelection(ids(MAX_DISLIKED_FOOD_IDS + 1, 'next'), [])).toBe(true)
    })
  })
})

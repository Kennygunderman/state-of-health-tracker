import {SUBCOPY_BAR_TAIL_WIDTH, SUBCOPY_BAR_WIDTH} from '../index.styled'
import {subcopyLineDescriptors} from '../index.util'

describe('subcopyLineDescriptors', () => {
  it('reserves no sub-copy line for a card that has none, which is the diet and slot cards', () => {
    expect(subcopyLineDescriptors(0)).toEqual([])
  })

  it('fills the column on a single line, because that line is the whole sentence', () => {
    expect(subcopyLineDescriptors(1)).toEqual([{key: 'first', width: SUBCOPY_BAR_WIDTH, isStretched: true}])
  })

  it('ends a wrapped sentence on a short tail rather than breaking both lines at the column', () => {
    expect(subcopyLineDescriptors(2)).toEqual([
      {key: 'first', width: SUBCOPY_BAR_WIDTH, isStretched: true},
      {key: 'second', width: SUBCOPY_BAR_TAIL_WIDTH, isStretched: false}
    ])
  })

  it('gives the tail a narrower band than the line above it, so the two are told apart', () => {
    expect(SUBCOPY_BAR_TAIL_WIDTH).toBeLessThan(SUBCOPY_BAR_WIDTH)
  })

  it('keeps a line on the same key whatever the card shape, so a re-render moves no line', () => {
    const [firstOfOne] = subcopyLineDescriptors(1)
    const [firstOfTwo] = subcopyLineDescriptors(2)

    expect(firstOfOne.key).toBe(firstOfTwo.key)
  })

  it('names every line distinctly, so two lines cannot share a key', () => {
    const keys = subcopyLineDescriptors(2).map(line => line.key)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('returns an equal result for repeated calls, and a fresh array the caller may keep', () => {
    const first = subcopyLineDescriptors(2)
    const second = subcopyLineDescriptors(2)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })
})

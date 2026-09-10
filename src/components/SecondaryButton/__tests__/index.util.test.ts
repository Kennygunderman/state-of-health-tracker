import {isDarkVariant, showsPlusIcon} from '../index.util'

describe('showsPlusIcon', () => {
  it('shows the plus icon for the default variant', () => {
    expect(showsPlusIcon('default')).toBe(true)
  })

  it('hides the plus icon for the dark variant', () => {
    expect(showsPlusIcon('dark')).toBe(false)
  })
})

describe('isDarkVariant', () => {
  it('applies dark styling to the dark variant', () => {
    expect(isDarkVariant('dark')).toBe(true)
  })

  it('does not apply dark styling to the default variant', () => {
    expect(isDarkVariant('default')).toBe(false)
  })
})

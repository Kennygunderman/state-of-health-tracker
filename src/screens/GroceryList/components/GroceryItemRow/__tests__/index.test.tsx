import React from 'react'

import {GroceryItem} from '@data/models/GroceryList'
import {ReactTestInstance, ReactTestRenderer, ReactTestRendererJSON, act, create} from 'react-test-renderer'

import GroceryFlagRow from '@screens/GroceryList/components/GroceryFlagRow'

import CheckboxSquare from '@components/CheckboxSquare'

import {
  GROCERY_FLAG_ROW_ACCESSIBILITY_TEMPLATE,
  GROCERY_ITEM_ACCESSIBILITY_TEMPLATE,
  GROCERY_UNCHECK_ITEM_ACCESSIBILITY_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import GroceryItemRow from '../index'

const UNCHECKED_ITEM: GroceryItem = {
  id: 'grocery-row-1',
  catalogFoodId: 'catalog-food-1',
  foodState: 'raw',
  name: 'Chicken breast',
  quantityGrams: 907.18,
  displayText: '2 lb',
  isChecked: false,
  flag: null,
  category: 'protein'
}

const FLAGGED_ITEM: GroceryItem = {
  ...UNCHECKED_ITEM,
  isChecked: true,
  flag: {
    previousDisplayText: '1.4 lb',
    newDisplayText: '2 lb',
    deltaDisplayText: '+0.6 lb',
    flaggedAt: '2026-02-10T09:15:00.000Z'
  }
}

const ITEM_CHECKBOX_LABEL = stringWithNamedParameters(GROCERY_ITEM_ACCESSIBILITY_TEMPLATE, {
  name: UNCHECKED_ITEM.name,
  quantity: UNCHECKED_ITEM.displayText
})

const FLAG_CHECKBOX_LABEL = stringWithNamedParameters(GROCERY_UNCHECK_ITEM_ACCESSIBILITY_TEMPLATE, {
  name: FLAGGED_ITEM.name
})

const FLAG_STATEMENT_LABEL = stringWithNamedParameters(GROCERY_FLAG_ROW_ACCESSIBILITY_TEMPLATE, {
  name: FLAGGED_ITEM.name,
  newAmount: '2 lb',
  oldAmount: '1.4 lb',
  delta: '+0.6 lb'
})

// A Touchable hands its press handling to the platform through the responder system rather than through an
// `onPress` prop on the mounted view, so a row root that is still a Touchable is recognised by these keys as
// well as by `onPress`/`activeOpacity` surviving on the React element.
const RESPONDER_PROP_PATTERN = /^(on(Responder|StartShouldSet|MoveShouldSet|Touch|Click)|onPress)/

const renderRow = (element: React.JSX.Element): ReactTestRenderer => {
  let renderer!: ReactTestRenderer

  act(() => {
    renderer = create(element)
  })

  return renderer
}

const rootNode = (renderer: ReactTestRenderer): ReactTestRendererJSON => {
  const root = renderer.toJSON()

  if (root === null || Array.isArray(root)) {
    throw new Error('Expected the row to render exactly one root node')
  }

  return root
}

// Counted over host nodes — the views the platform actually mounts — because that is the tree a screen reader
// walks; the composite elements above them carry the same props as their React-side source.
const announcedAs = (renderer: ReactTestRenderer, role: string): ReactTestInstance[] =>
  renderer.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === role)

const pressablesInside = (instance: ReactTestInstance): Set<ReactTestInstance> =>
  new Set<ReactTestInstance>([instance, ...instance.findAll(() => true)])

const allPressHandlers = (renderer: ReactTestRenderer): ReactTestInstance[] =>
  renderer.root.findAll(node => typeof node.props.onPress === 'function')

// The checkbox's Touchable is composed of an outer forwarding element and its implementation, so the role is
// carried by more than one composite element; one distinct handler behind them is what proves they are one
// control rather than two nested pressables.
const pressTheCheckbox = (renderer: ReactTestRenderer): void => {
  const pressables = renderer.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      node.props.accessibilityRole === 'checkbox' &&
      typeof node.props.onPress === 'function'
  )
  const handlers = new Set(pressables.map(node => node.props.onPress))

  expect(pressables.length).toBeGreaterThan(0)
  expect(handlers.size).toBe(1)

  act(() => {
    pressables[0].props.onPress()
  })
}

describe('GroceryItemRow press affordance', () => {
  it('renders the row as a plain layout view, so no part of it presses or dims', () => {
    const renderer = renderRow(
      <GroceryItemRow item={UNCHECKED_ITEM} variant="unchecked" isFirst isPending={false} onToggle={jest.fn()} />
    )
    const root = rootNode(renderer)
    const responderProps = Object.keys(root.props).filter(key => RESPONDER_PROP_PATTERN.test(key))

    expect(root.type).toBe('View')
    expect(root.props.activeOpacity).toBeUndefined()
    expect(root.props.opacity).toBeUndefined()
    expect(responderProps).toEqual([])

    act(() => {
      renderer.unmount()
    })
  })

  it('leaves the checkbox as the only control, labelled and reachable through its own hit slop', () => {
    const renderer = renderRow(
      <GroceryItemRow item={UNCHECKED_ITEM} variant="unchecked" isFirst isPending={false} onToggle={jest.fn()} />
    )
    const root = rootNode(renderer)
    const checkboxes = announcedAs(renderer, 'checkbox')
    const insideCheckbox = pressablesInside(renderer.root.findByType(CheckboxSquare))
    const pressHandlers = allPressHandlers(renderer)

    expect(root.props.accessibilityRole).toBeUndefined()
    expect(checkboxes).toHaveLength(1)
    expect(checkboxes[0].props.accessibilityLabel).toBe(ITEM_CHECKBOX_LABEL)
    expect(checkboxes[0].props.accessibilityState).toEqual({checked: false, disabled: false})
    expect(checkboxes[0].props.hitSlop).toBe(11)
    expect(new Set(pressHandlers.map(node => node.props.onPress)).size).toBe(1)
    pressHandlers.forEach(node => {
      expect(insideCheckbox.has(node)).toBe(true)
    })

    act(() => {
      renderer.unmount()
    })
  })

  it('hands the row back to the screen when the checkbox is pressed', () => {
    const onToggle = jest.fn()
    const renderer = renderRow(
      <GroceryItemRow item={UNCHECKED_ITEM} variant="unchecked" isFirst isPending={false} onToggle={onToggle} />
    )

    pressTheCheckbox(renderer)

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(UNCHECKED_ITEM)

    act(() => {
      renderer.unmount()
    })
  })

  it('swallows a press while a toggle is in flight and announces the checkbox as disabled', () => {
    const onToggle = jest.fn()
    const renderer = renderRow(
      <GroceryItemRow item={UNCHECKED_ITEM} variant="unchecked" isFirst isPending onToggle={onToggle} />
    )

    pressTheCheckbox(renderer)

    expect(onToggle).not.toHaveBeenCalled()
    expect(announcedAs(renderer, 'checkbox')[0].props.accessibilityState).toEqual({checked: false, disabled: true})

    act(() => {
      renderer.unmount()
    })
  })
})

describe('GroceryFlagRow press affordance', () => {
  it('renders the flagged row as a plain layout view, so no part of it presses or dims', () => {
    const renderer = renderRow(<GroceryFlagRow item={FLAGGED_ITEM} isFirst isPending={false} onToggle={jest.fn()} />)
    const root = rootNode(renderer)
    const responderProps = Object.keys(root.props).filter(key => RESPONDER_PROP_PATTERN.test(key))

    expect(root.type).toBe('View')
    expect(root.props.activeOpacity).toBeUndefined()
    expect(root.props.opacity).toBeUndefined()
    expect(responderProps).toEqual([])

    act(() => {
      renderer.unmount()
    })
  })

  it('announces the flag as one statement and the checkbox as the only control', () => {
    const renderer = renderRow(<GroceryFlagRow item={FLAGGED_ITEM} isFirst isPending={false} onToggle={jest.fn()} />)
    const root = rootNode(renderer)
    const checkboxes = announcedAs(renderer, 'checkbox')
    const insideCheckbox = pressablesInside(renderer.root.findByType(CheckboxSquare))
    const pressHandlers = allPressHandlers(renderer)
    const statements = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props.accessibilityLabel === FLAG_STATEMENT_LABEL
    )

    expect(root.props.accessibilityRole).toBeUndefined()
    expect(root.props.accessibilityLabel).toBeUndefined()
    expect(checkboxes).toHaveLength(1)
    expect(checkboxes[0].props.accessibilityLabel).toBe(FLAG_CHECKBOX_LABEL)
    expect(checkboxes[0].props.accessibilityState).toEqual({checked: true, disabled: false})
    expect(statements).toHaveLength(1)
    expect(statements[0].props.accessible).toBe(true)
    expect(statements[0].props.accessibilityRole).toBeUndefined()
    expect(new Set(pressHandlers.map(node => node.props.onPress)).size).toBe(1)
    pressHandlers.forEach(node => {
      expect(insideCheckbox.has(node)).toBe(true)
    })

    act(() => {
      renderer.unmount()
    })
  })

  it('clears the flag through the checkbox, handing the row back to the screen', () => {
    const onToggle = jest.fn()
    const renderer = renderRow(<GroceryFlagRow item={FLAGGED_ITEM} isFirst isPending={false} onToggle={onToggle} />)

    pressTheCheckbox(renderer)

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(FLAGGED_ITEM)

    act(() => {
      renderer.unmount()
    })
  })

  it('swallows a press while its own toggle is in flight and announces the checkbox as disabled', () => {
    const onToggle = jest.fn()
    const renderer = renderRow(<GroceryFlagRow item={FLAGGED_ITEM} isFirst isPending onToggle={onToggle} />)

    pressTheCheckbox(renderer)

    expect(onToggle).not.toHaveBeenCalled()
    expect(announcedAs(renderer, 'checkbox')[0].props.accessibilityState).toEqual({checked: true, disabled: true})

    act(() => {
      renderer.unmount()
    })
  })
})

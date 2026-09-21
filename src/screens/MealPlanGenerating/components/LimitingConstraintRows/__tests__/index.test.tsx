import React from 'react'

import {ReactTestRenderer, ReactTestRendererJSON, act, create} from 'react-test-renderer'

import {
  MEAL_PLAN_CONSTRAINT_EDIT_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES,
  MEAL_PLAN_EDIT_LINK_TEXT,
  MEAL_PLAN_LIMITING_CONSTRAINT_LABELS,
  PLAN_SETTINGS_NOT_SET_VALUE,
  stringWithNamedParameters
} from '@constants/strings'

import LimitingConstraintRows from '../index'

// Taken from the card's own contract rather than from the screen's `index.util`, so this suite stays inside
// the component it renders: the row shape is what the card accepts, whoever derived it.
type ConstraintRow = React.ComponentProps<typeof LimitingConstraintRows>['rows'][number]

const COOKING_TIME_LABEL = MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.cooking_time

const SLOT_COVERAGE_LABEL = MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.slot_coverage

const DISLIKES_LABEL = MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.dislikes

const COOKING_TIME_MEASUREMENT = stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.minutes, {value: 30})

const editLabelFor = (label: string): string =>
  stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_EDIT_ACCESSIBILITY_TEMPLATE, {label})

const row = (overrides: Partial<ConstraintRow> = {}): ConstraintRow => ({
  constraintKey: 'cooking_time',
  label: COOKING_TIME_LABEL,
  value: COOKING_TIME_MEASUREMENT,
  editStep: 'cooking',
  editLabel: MEAL_PLAN_EDIT_LINK_TEXT,
  editAccessibilityLabel: editLabelFor(COOKING_TIME_LABEL),
  ...overrides
})

const renderCard = (rows: ConstraintRow[]): ReactTestRenderer => {
  let renderer!: ReactTestRenderer

  act(() => {
    renderer = create(<LimitingConstraintRows rows={rows} onEditConstraint={jest.fn()} />)
  })

  return renderer
}

const rootNode = (renderer: ReactTestRenderer): ReactTestRendererJSON => {
  const root = renderer.toJSON()

  if (root === null || Array.isArray(root)) {
    throw new Error('Expected the card to render exactly one root node')
  }

  return root
}

const childNodes = (node: ReactTestRendererJSON): ReactTestRendererJSON[] =>
  (node.children ?? []).filter((child): child is ReactTestRendererJSON => typeof child !== 'string')

const mountedTree = (node: ReactTestRendererJSON): ReactTestRendererJSON[] => [
  node,
  ...childNodes(node).flatMap(mountedTree)
]

// The grouped column is the element a screen reader stops on, so its text children are what the row
// announces. Asserted over the mounted host tree, because that is the tree a screen reader walks. The Edit
// pill's own view is accessible too — a Touchable makes itself one — so the column is the accessible view
// that carries no role of its own.
const groupedColumns = (renderer: ReactTestRenderer): ReactTestRendererJSON[] =>
  mountedTree(rootNode(renderer)).filter(
    node => node.props.accessible === true && node.props.accessibilityRole === undefined
  )

const editPills = (renderer: ReactTestRenderer): ReactTestRendererJSON[] =>
  mountedTree(rootNode(renderer)).filter(node => node.props.accessibilityRole === 'button')

const linesOf = (node: ReactTestRendererJSON): string[] =>
  mountedTree(node)
    .filter(descendant => descendant.type === 'Text')
    .flatMap(descendant => (descendant.children ?? []).filter((child): child is string => typeof child === 'string'))

describe('LimitingConstraintRows', () => {
  describe('a row whose measurement the analysis withheld', () => {
    // The finding's own case: a `cooking_time` constraint whose `value` and `unit` were both null derives an
    // empty value, and drawn as-is that removed the second line and left the row stating only its name.
    it('draws the placeholder rather than dropping the value line for an empty value', () => {
      const renderer = renderCard([row({value: ''})])
      const columns = groupedColumns(renderer)

      expect(columns).toHaveLength(1)
      expect(linesOf(columns[0])).toEqual([COOKING_TIME_LABEL, PLAN_SETTINGS_NOT_SET_VALUE])

      act(() => {
        renderer.unmount()
      })
    })

    it('draws the placeholder the derivation supplies as the second line', () => {
      const renderer = renderCard([row({value: PLAN_SETTINGS_NOT_SET_VALUE})])

      expect(linesOf(groupedColumns(renderer)[0])).toEqual([COOKING_TIME_LABEL, PLAN_SETTINGS_NOT_SET_VALUE])

      act(() => {
        renderer.unmount()
      })
    })

    it('keeps the Edit pill beside the placeholder, so the row still states its recovery', () => {
      const renderer = renderCard([row({value: ''})])
      const pills = editPills(renderer)

      expect(pills).toHaveLength(1)
      expect(pills[0].props.accessibilityLabel).toBe(editLabelFor(COOKING_TIME_LABEL))
      expect(linesOf(pills[0])).toEqual([MEAL_PLAN_EDIT_LINK_TEXT])

      act(() => {
        renderer.unmount()
      })
    })

    it('hands the row back to the screen when its Edit pill is pressed', () => {
      const onEditConstraint = jest.fn()
      const placeholderRow = row({value: ''})
      let renderer!: ReactTestRenderer

      act(() => {
        renderer = create(<LimitingConstraintRows rows={[placeholderRow]} onEditConstraint={onEditConstraint} />)
      })

      const pill = renderer.root.find(
        node => typeof node.type !== 'string' && node.props.accessibilityRole === 'button'
      )

      act(() => {
        pill.props.onPress()
      })

      expect(onEditConstraint).toHaveBeenCalledTimes(1)
      expect(onEditConstraint).toHaveBeenCalledWith(placeholderRow)

      act(() => {
        renderer.unmount()
      })
    })
  })

  describe('a row whose measurement arrived', () => {
    it('draws the measurement it was given and never the placeholder', () => {
      const renderer = renderCard([row()])
      const lines = linesOf(groupedColumns(renderer)[0])

      expect(lines).toEqual([COOKING_TIME_LABEL, COOKING_TIME_MEASUREMENT])
      expect(lines).not.toContain(PLAN_SETTINGS_NOT_SET_VALUE)

      act(() => {
        renderer.unmount()
      })
    })

    it('draws two lines for every row, whichever of them carries a measurement', () => {
      const renderer = renderCard([
        row(),
        row({
          constraintKey: 'slot_coverage',
          label: SLOT_COVERAGE_LABEL,
          value: '',
          editStep: 'schedule',
          editAccessibilityLabel: editLabelFor(SLOT_COVERAGE_LABEL)
        })
      ])
      const columns = groupedColumns(renderer)

      expect(columns).toHaveLength(2)
      expect(columns.map(column => linesOf(column))).toEqual([
        [COOKING_TIME_LABEL, COOKING_TIME_MEASUREMENT],
        [SLOT_COVERAGE_LABEL, PLAN_SETTINGS_NOT_SET_VALUE]
      ])

      act(() => {
        renderer.unmount()
      })
    })
  })

  it('draws nothing when the analysis named no constraint', () => {
    const renderer = renderCard([])

    expect(renderer.toJSON()).toBeNull()

    act(() => {
      renderer.unmount()
    })
  })

  it('draws one row per constraint inside a single card', () => {
    const renderer = renderCard([
      row(),
      row({
        constraintKey: 'dislikes',
        label: DISLIKES_LABEL,
        value: stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.foods, {value: 9}),
        editStep: 'dislikes',
        editAccessibilityLabel: editLabelFor(DISLIKES_LABEL)
      })
    ])
    const root = rootNode(renderer)

    expect(root.type).toBe('View')
    expect(childNodes(root)).toHaveLength(2)

    act(() => {
      renderer.unmount()
    })
  })
})
